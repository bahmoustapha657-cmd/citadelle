// Ouvrir la fenêtre « Dispenses » depuis le tableau de bord de la Direction.
//
// L'alerte « demandes de dispense à examiner » mène droit aux demandes : elle
// dépose ici la section à ouvrir puis bascule sur la Comptabilité, qui
// démarre sur l'onglet Mensualités de cette section et ouvre la fenêtre.
// sessionStorage : l'intention ne survit pas à l'onglet du navigateur, et
// elle est effacée dès que la fenêtre s'est ouverte.
const CLE = "LC_ouvrirDispenses";
const TOUTES = "*";

export function demanderOuvertureDispenses(section = "") {
  try { sessionStorage.setItem(CLE, section || TOUTES); } catch { /* stockage indisponible : on ouvre la Comptabilité seulement */ }
}

// La section demandée ("" : aucune préférence), ou null s'il n'y a rien à ouvrir.
export function intentionDispenses() {
  try {
    const valeur = sessionStorage.getItem(CLE);
    if (!valeur) return null;
    return valeur === TOUTES ? "" : valeur;
  } catch {
    return null;
  }
}

export function oublierIntentionDispenses() {
  try { sessionStorage.removeItem(CLE); } catch { /* rien à faire */ }
}
