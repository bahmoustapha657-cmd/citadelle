// ── Saisies hors ligne mises de côté ────────────────────────────────────────
// Le miroir PowerSync est vidé quand un AUTRE compte se connecte sur
// l'appareil (proprietaire.js), et sa file d'envoi partait avec lui : les
// saisies faites hors ligne par le compte précédent, pas encore envoyées,
// étaient perdues sans trace. Cas typique : le comptable encaisse sans
// réseau, se déconnecte, puis le directeur se connecte sur le même poste.
//
// Elles sont désormais MISES DE CÔTÉ avant la purge, au nom de leur auteur,
// et renvoyées quand il se reconnecte sur cet appareil, avec SA session
// (connector.js) : la RLS juge chaque écriture au nom de celui qui l'a faite,
// jamais au nom du compte suivant.
//
// localStorage : il survit au rechargement et aux mises à jour (le service
// worker supprime les caches qu'il ne connaît pas), et il est protégé avec
// le reste par protegerDonneesLocales(). Module sans dépendance, testé seul.

const CLE = "LC_saisies_de_cote";

// Code de l'erreur levée quand le miroir garde des saisies non envoyées qui
// n'ont pas pu être mises de côté (stockage plein ou indisponible) : il n'est
// alors PAS vidé, et l'autre compte ne doit pas ouvrir l'app sur l'appareil.
export const SAISIES_NON_GARDEES = "saisies-non-gardees";

function lireTout() {
  try {
    const tout = JSON.parse(localStorage.getItem(CLE) || "{}");
    return tout && typeof tout === "object" && !Array.isArray(tout) ? tout : {};
  } catch {
    return {};
  }
}

// Lève si le stockage refuse (plein, indisponible).
function ecrireTout(tout) {
  if (Object.keys(tout).length) localStorage.setItem(CLE, JSON.stringify(tout));
  else localStorage.removeItem(CLE);
}

// Une entrée de la file PowerSync (CrudEntry) réduite à ce que l'envoi lit
// (envoi-operation.js, garde-refus.js). Les colonnes jsonb restent en texte,
// comme dans la file : connector.js les re-parse à l'envoi.
export function entreeDeCote(op) {
  const entree = { op: op.op, table: op.table, id: op.id };
  if (op.opData) entree.opData = op.opData;
  if (op.previousValues) entree.previousValues = op.previousValues;
  return entree;
}

export function saisiesDeCote(uid) {
  const liste = uid ? lireTout()[uid] : null;
  return Array.isArray(liste) ? liste : [];
}

export const compterSaisiesDeCote = (uid) => saisiesDeCote(uid).length;

// Ajoute `entrees` (dans l'ordre de la file) aux saisies de côté de `uid`.
// Renvoie false si elles n'ont pas pu être gardées : auteur inconnu ou
// stockage refusé. L'appelant ne doit alors PAS vider le miroir.
export function mettreDeCote(uid, entrees) {
  if (!entrees?.length) return true;
  if (!uid) return false;
  try {
    const tout = lireTout();
    tout[uid] = [...saisiesDeCote(uid), ...entrees.map(entreeDeCote)];
    ecrireTout(tout);
    return true;
  } catch {
    return false;
  }
}

// Retire la plus ancienne saisie de côté de `uid` (envoyée ou refusée).
function retirerPremiere(uid) {
  try {
    const tout = lireTout();
    const reste = saisiesDeCote(uid).slice(1);
    if (reste.length) tout[uid] = reste;
    else delete tout[uid];
    ecrireTout(tout);
    return true;
  } catch {
    return false;
  }
}

// Un seul renvoi à la fois (connecteur et minuterie de client.js) : une
// saisie n'est jamais envoyée deux fois en parallèle.
let enchainement = Promise.resolve();

// Renvoie les saisies de côté de `uid`, de la plus ancienne à la plus
// récente, avec les règles du connecteur :
//   • envoyer(op)          : envoi au serveur, lève en cas d'échec ;
//   • estPassagere(err)    : réseau, session… → on s'arrête, tout ce qui
//                            reste repartira au prochain essai, dans l'ordre ;
//   • surRefus(op, err)    : refus définitif (RLS, fiche supprimée…) → gardé
//                            dans le journal (garde-refus.js), puis abandonné
//                            pour ne pas bloquer les suivantes.
// Chaque saisie traitée est retirée aussitôt : une coupure en plein renvoi
// ne fait rien repartir en double.
export function renvoyerSaisiesDeCote(uid, { envoyer, estPassagere, surRefus }) {
  const tache = async () => {
    let envoyees = 0;
    let refusees = 0;
    for (const op of saisiesDeCote(uid)) {
      try {
        await envoyer(op);
        envoyees += 1;
      } catch (err) {
        if (estPassagere(err)) break;
        refusees += 1;
        try { await surRefus?.(op, err); } catch { /* la garde ne bloque pas le renvoi */ }
      }
      if (!retirerPremiere(uid)) break;
    }
    return { envoyees, refusees, restantes: compterSaisiesDeCote(uid) };
  };
  const etape = enchainement.then(tache, tache);
  enchainement = etape.catch(() => {});
  return etape;
}
