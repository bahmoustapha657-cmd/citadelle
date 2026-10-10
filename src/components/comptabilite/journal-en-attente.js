// ══════════════════════════════════════════════════════════════════════════
//  Journal de caisse — lignes gardées sur l'appareil en attendant d'être écrites
// ══════════════════════════════════════════════════════════════════════════
// La ligne de journal s'écrit APRÈS la fiche élève (payment-actions). Si elle
// échoue (base locale indisponible, réseau coupé sans miroir hors ligne…), le
// paiement reste acquis sur la fiche — mais sa ligne était perdue, seul un
// avertissement le disait. Constaté le 2026-10-09 : 923 encaissements sans
// ligne au journal (G.S. Fatoumata Falilou Diallo, La Citadelle), dont 21
// encore le 08/10, après la mise hors ligne du journal.
//
// Désormais la ligne refusée est GARDÉE sur l'appareil (par école), puis
// renvoyée à l'ouverture de la Comptabilité, au retour du réseau et après
// chaque ligne écrite. Son id est fixé à la saisie : si la base l'avait en
// fait reçue (réponse perdue en route), le renvoi ne crée pas de doublon.
//
// Logique pure : stockage injecté, testable sous Node.

const PREFIXE = "LC_journal_attente_";
export const cleAttente = (ecole) => `${PREFIXE}${ecole || ""}`;

export function lireAttente(ecole, stockage = globalThis.localStorage) {
  try {
    const lignes = JSON.parse(stockage?.getItem(cleAttente(ecole)) || "[]");
    return Array.isArray(lignes) ? lignes : [];
  } catch {
    return [];
  }
}

function ecrireAttente(ecole, lignes, stockage) {
  try {
    if (lignes.length) stockage?.setItem(cleAttente(ecole), JSON.stringify(lignes));
    else stockage?.removeItem(cleAttente(ecole));
  } catch { /* stockage plein ou indisponible : rien de mieux à faire */ }
}

const nouvelId = () => globalThis.crypto.randomUUID();

// Garde une ligne pour plus tard. `createdAt` date le geste du caissier : au
// renvoi, c'est lui qui ordonne la ligne parmi les autres (cf.
// lignesNeutralisees), pas l'heure du renvoi.
export function mettreEnAttente(ecole, ligne, stockage = globalThis.localStorage) {
  const lignes = lireAttente(ecole, stockage);
  if (!lignes.some((l) => l._id === ligne._id)) {
    lignes.push({ createdAt: Date.now(), ...ligne });
    ecrireAttente(ecole, lignes, stockage);
  }
  return lignes.length;
}

// Un seul renvoi à la fois par école : l'ouverture de l'écran, le retour du
// réseau et un encaissement peuvent le déclencher ensemble.
const renvoisEnCours = new Map();

// Renvoie les lignes en attente, dans l'ordre de saisie. Une ligne qui échoue
// encore reste en attente ; les suivantes sont tentées quand même. Renvoie
// { envoyees, restantes }.
export function renvoyerAttente(ecole, ajouter, stockage = globalThis.localStorage) {
  if (renvoisEnCours.has(ecole)) return renvoisEnCours.get(ecole);
  const renvoi = (async () => {
    let envoyees = 0;
    for (const ligne of lireAttente(ecole, stockage)) {
      try {
        await ajouter(ligne);
      } catch {
        continue;
      }
      envoyees += 1;
      ecrireAttente(ecole, lireAttente(ecole, stockage).filter((l) => l._id !== ligne._id), stockage);
    }
    return { envoyees, restantes: lireAttente(ecole, stockage).length };
  })().finally(() => renvoisEnCours.delete(ecole));
  renvoisEnCours.set(ecole, renvoi);
  return renvoi;
}

// Écrit une ligne au journal. En cas d'échec, elle est gardée sur l'appareil
// et le résultat le dit : { enAttente: true, erreur }. L'id est fixé ici, une
// fois pour toutes, pour que tout renvoi soit sans doublon.
export async function inscrireAuJournal(ecole, ajouter, ecriture, stockage = globalThis.localStorage) {
  const ligne = ecriture._id ? ecriture : { ...ecriture, _id: nouvelId() };
  try {
    return { ...(await ajouter(ligne)), enAttente: false };
  } catch (erreur) {
    mettreEnAttente(ecole, ligne, stockage);
    return { enAttente: true, erreur };
  }
}
