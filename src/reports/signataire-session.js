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

// Taille du cachet à l'impression, réglée par son titulaire
// (comptes.cachet_taille) : facteur appliqué à la hauteur que chaque document
// prévoit (1 = taille d'origine). Bornes identiques à la contrainte SQL.
export const TAILLE_CACHET = Object.freeze({ min: 0.8, max: 2, pas: 0.1 });
export function normaliserTailleCachet(valeur) {
  const n = Number(valeur);
  if (valeur === null || valeur === "" || !Number.isFinite(n)) return 1;
  return Math.round(Math.min(TAILLE_CACHET.max, Math.max(TAILLE_CACHET.min, n)) * 100) / 100;
}
// Part du débordement placée AU-DESSUS de l'espace à signer : 30 % à la
// taille d'origine (le nom reste lisible), jusqu'à 50 % à ×2 (un grand
// tampon chevauche le nom plutôt que de sortir sous le document).
export const partDessusCachet = (taille) =>
  Math.round((0.3 + 0.2 * Math.min(1, Math.max(0, normaliserTailleCachet(taille) - 1))) * 100) / 100;

// `compte` : { cle, nom, cachet, taille } — clé du poste du compte, nom qu'il
// imprime, URL de son cachet et sa taille. Poste manquant, ou ni nom ni
// cachet : aucun signataire de session.
export function definirSignataireSession(compte) {
  const cle = String(compte?.cle || "").trim();
  const nom = String(compte?.nom || "").trim();
  const cachet = String(compte?.cachet || "").trim();
  const taille = normaliserTailleCachet(compte?.taille);
  courant = cle && (nom || cachet) ? { cle, nom, cachet, taille } : null;
}

export const signataireSession = () => courant;
