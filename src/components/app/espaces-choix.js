// Choix d'espace proposé d'office UNE fois, juste après une connexion par le
// formulaire (pas à chaque ouverture de l'app) : drapeau de session posé par
// use-connexion.js, lu puis effacé par EspacesUtilisateur.jsx.
const CLE_CHOIX = "lc-choisir-espace";

export const demanderChoixEspace = () => {
  try { sessionStorage.setItem(CLE_CHOIX, "1"); } catch { /* stockage refusé */ }
};
export const choixDemande = () => {
  try { return sessionStorage.getItem(CLE_CHOIX) === "1"; } catch { return false; }
};
export const oublierChoix = () => {
  try { sessionStorage.removeItem(CLE_CHOIX); } catch { /* stockage refusé */ }
};
