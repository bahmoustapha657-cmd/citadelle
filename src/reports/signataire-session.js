// ── Compte qui imprime ──────────────────────────────────────────────────────
// Un poste peut porter plusieurs comptes (deux comptables, deux
// administrateurs) : chacun signe à SON nom les documents qu'il imprime pour ce
// poste. Ce module retient, pour la session en cours, le poste du compte
// connecté et le nom qu'il imprime (comptes.extra.nomSignature, réglé dans
// Comptes & Postes). Sans nom : le responsable du poste, comme avant.
//
// Tenu hors de schoolInfo à dessein : certains écrans enregistrent un objet de
// réglages entier dans ecoles.extra, et le signataire courant y finirait écrit
// — tout le monde imprimerait alors son nom. Sans dépendance : App.jsx
// l'importe sans tirer le code des documents dans le bundle principal.
let courant = null;

// `compte` : { cle, nom } — clé du poste du compte, nom qu'il imprime.
// Poste ou nom manquant : aucun signataire de session.
export function definirSignataireSession(compte) {
  const cle = String(compte?.cle || "").trim();
  const nom = String(compte?.nom || "").trim();
  courant = cle && nom ? { cle, nom } : null;
}

export const signataireSession = () => courant;
