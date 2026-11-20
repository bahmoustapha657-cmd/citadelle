// Ouvrir la fenêtre « Départs signalés » depuis le tableau de bord.
//
// L'alerte « départs signalés à confirmer » mène droit à la liste : elle
// dépose ici l'intention puis bascule sur la Comptabilité, qui démarre sur
// l'onglet Élèves et ouvre la fenêtre (même mécanisme que les dispenses,
// cf. comptabilite/ouvrir-dispenses.js). sessionStorage : l'intention ne
// survit pas à l'onglet du navigateur, et elle est effacée dès que la
// fenêtre s'est ouverte.
const CLE = "LC_ouvrirDepartsSignales";

export function demanderOuvertureDepartsSignales() {
  try { sessionStorage.setItem(CLE, "1"); } catch { /* stockage indisponible : on ouvre la Comptabilité seulement */ }
}

export function intentionDepartsSignales() {
  try { return sessionStorage.getItem(CLE) === "1"; } catch { return false; }
}

export function oublierIntentionDepartsSignales() {
  try { sessionStorage.removeItem(CLE); } catch { /* rien à faire */ }
}
