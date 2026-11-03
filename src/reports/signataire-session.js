// ── Compte qui imprime ──────────────────────────────────────────────────────
// Un poste peut porter plusieurs comptes (deux comptables, deux
// administrateurs) : chacun signe à SON nom les documents qu'il imprime pour ce
// poste. Ce module retient, pour la session en cours, le poste du compte
// connecté et le nom qu'il imprime (comptes.extra.nomSignature, réglé dans
// Comptes & Postes). Sans nom : le responsable du poste, comme avant.
//
// Il retient aussi son cachet personnel (comptes.cachet_url, déposé par le
// titulaire lui-même depuis son menu profil) : l'image n'est apposée que sur
// les documents que CE compte imprime pour son poste — jamais sur ceux qu'un
// autre imprime, même pour le même poste.
//
// Tenu hors de schoolInfo à dessein : certains écrans enregistrent un objet de
// réglages entier dans ecoles.extra, et le signataire courant y finirait écrit
// — tout le monde imprimerait alors son nom. Sans dépendance : App.jsx
// l'importe sans tirer le code des documents dans le bundle principal.
let courant = null;

// Postes qui déposent leur cachet : la comptabilité et les chefs de section
// (Direction primaire, préscolaire compris ; Bureau collège, lycée compris).
// La Direction générale garde la signature de l'école (Paramètres →
// Évaluations).
export const POSTES_CACHET = ["comptable", "primaire", "college"];
export const peutDeposerCachet = (cle) => POSTES_CACHET.includes(String(cle || ""));

// `compte` : { cle, nom, cachet } — clé du poste du compte, nom qu'il imprime,
// URL de son cachet. Poste manquant, ou ni nom ni cachet : aucun signataire de
// session.
export function definirSignataireSession(compte) {
  const cle = String(compte?.cle || "").trim();
  const nom = String(compte?.nom || "").trim();
  const cachet = String(compte?.cachet || "").trim();
  courant = cle && (nom || cachet) ? { cle, nom, cachet } : null;
}

export const signataireSession = () => courant;
