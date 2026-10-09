// ══════════════════════════════════════════════════════════════════════════
//  Ce qu'un versement peut payer — logique pure, partagée navigateur/serveur
// ══════════════════════════════════════════════════════════════════════════
// Le comptable (fenêtre « Encaisser ») et le paiement en ligne (Edge Function
// `paiement`, copie générée dans supabase/functions/_shared/app) partent de
// la MÊME liste de cibles et du même reste dû : un parent ne peut pas payer
// en ligne autre chose, ni un autre montant, que ce que la caisse accepterait.
//
// Extension explicite des imports : module aussi chargé par Node (tests) et,
// via sa copie, par Deno (Edge Function).

import {
  acompteInscription, getFraisAnnexesEleve, getTarifConfigForClasse,
  getTarifInscriptionForEleve, getTarifMensuelForClasse, montantDuInscription,
} from "./mensualite-utils.js";
import { partiAvantAnnee } from "./depart-utils.js";
import { etatsMois, ordreEncaissement, periodeTranche } from "./paiements-scolarite.js";

// Les mensualités (inscription d'abord si elle n'est pas soldée, puis le
// dernier mois, puis du 1er au suivant — cf. ordreEncaissement), chaque
// tranche, l'inscription et chaque frais annexe pas encore soldé, avec le
// reste dû de chacun. Élève parti : seuls les mois entamés avant son départ,
// et rien d'une année qu'il n'a pas fréquentée.
export function ciblesVersement({ eleve, moisAnnee, annee, tarifsClasses, tranches = [] }) {
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const etats = etatsMois(eleve, moisAnnee, mensualite, annee);
  const rienDu = partiAvantAnnee(eleve, moisAnnee, annee);
  const resteDe = (mois) => etats.filter((e) => mois.includes(e.mois)).reduce((s, e) => s + e.reste, 0);
  let inscription = null;
  if (!eleve.inscriptionPayee && !rienDu) {
    const duNet = montantDuInscription(eleve, getTarifInscriptionForEleve(eleve, tarifsClasses));
    const reste = Math.max(0, duNet - acompteInscription(eleve));
    const label = eleve.typeInscription === "Réinscription" ? "Réinscription" : "Inscription";
    if (reste > 0) inscription = { label, duNet, reste };
  }
  const dernier = moisAnnee[moisAnnee.length - 1] || "";
  const cibles = [{
    cle: "mois", type: "mois", label: "Mensualités",
    detail: inscription
      ? `${inscription.label} d'abord, puis ${dernier}, puis à partir du 1er mois impayé`
      : `${dernier} d'abord, puis à partir du 1er mois impayé`,
    mois: ordreEncaissement(moisAnnee), inscription,
    reste: resteDe(moisAnnee) + (inscription?.reste || 0),
  }];
  tranches.forEach((t, i) => cibles.push({
    cle: `tranche-${i}`, type: "mois", label: t.nom, detail: periodeTranche(t), mois: t.mois, reste: resteDe(t.mois),
  }));
  if (inscription) {
    cibles.push({ cle: "inscription", type: "poste", poste: "inscription", label: inscription.label, duNet: inscription.duNet, reste: inscription.reste });
  }
  for (const frais of getFraisAnnexesEleve(eleve, getTarifConfigForClasse(tarifsClasses, eleve.classe))) {
    if (frais.paye || rienDu) continue;
    cibles.push({ cle: `frais-${frais.id}`, type: "poste", poste: frais.id, label: frais.label, duNet: frais.duNet, reste: frais.reste });
  }
  return { cibles, etats, mensualite };
}

// Montant proposé en choisissant une cible : pour les mensualités, le reste
// de l'inscription (si due) plus un mois — le cas le plus courant ; tout le
// reste pour une tranche ou un frais.
export function montantPropose(cible, etats) {
  if (!cible) return "";
  if (cible.cle === "mois") {
    const prochain = cible.mois.map((m) => etats.find((e) => e.mois === m)).find((e) => e?.reste > 0);
    const total = (cible.inscription?.reste || 0) + (prochain?.reste || 0);
    return total > 0 ? String(total) : "";
  }
  return cible.reste > 0 ? String(cible.reste) : "";
}
