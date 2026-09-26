// ── Comptes parents : un foyer, un compte, tous ses enfants ────────────────
// Module PUR (testé par tests/comptes-parents.test.js) : identifiant
// suggéré, charge utile envoyée à account-manage et message de résultat.
// L'appel au serveur vit dans backend/compte-parent.js ; la règle « même
// foyer », côté serveur, dans supabase/functions/account-manage/foyer.ts.

// Identifiant valide côté serveur : minuscules, sans accents, [a-z0-9]
// uniquement (le pattern d'API rejette é/è/à et les espaces).
export const slugLogin = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "");

export const loginParentSuggere = (nom) => `parent.${slugLogin(nom).slice(0, 12)}`;

const nomComplet = (e) => `${e.prenom || ""} ${e.nom || ""}`.trim();

// Charge utile de account-manage (action create, rôle parent) pour une
// fratrie : `eleves` = [{ _id, nom, prenom, classe, section, tuteur,
// contactTuteur, filiation }] — un élève depuis sa fiche, plusieurs depuis
// la saisie rapide. Le tuteur est celui du premier. Pas de section au
// compte : un parent suit ses enfants dans toutes les sections (chaque lien
// porte celle de l'enfant).
export function payloadCompteParent({ schoolId, login, mdp, eleves }) {
  const [premier] = eleves;
  return {
    schoolId,
    login: String(login || "").trim().toLowerCase(),
    mdp,
    role: "parent",
    label: "Parent",
    nom: premier.tuteur || `Parent de ${premier.prenom}`,
    eleveId: premier._id,
    eleveNom: nomComplet(premier),
    eleveClasse: premier.classe || "",
    eleveIds: eleves.map((e) => e._id),
    elevesAssocies: eleves.map((e) => ({
      eleveId: e._id, eleveNom: nomComplet(e), eleveClasse: e.classe || "", section: e.section || null,
    })),
    tuteur: premier.tuteur || "",
    contactTuteur: premier.contactTuteur || "",
    filiation: premier.filiation || "",
    statut: "Actif",
  };
}

// Accord : « ajoutée » pour une fille, « ajoutés » pour plusieurs enfants.
const accord = (eleves) =>
  (eleves.length && eleves.every((e) => e.sexe === "F") ? "e" : "") + (eleves.length > 1 ? "s" : "");

// Message de résultat. `r` : { login, rattache, dejaRattache } (voir
// backend/compte-parent.js).
export function messageCompteParent(r, eleves = []) {
  const qui = eleves.map((e) => e.prenom || nomComplet(e)).filter(Boolean).join(", ");
  if (r.dejaRattache) return `${qui} : déjà rattaché${accord(eleves)} au compte parent « ${r.login} ».`;
  if (r.rattache) {
    return `Même foyer : ${qui} ajouté${accord(eleves)} au compte parent « ${r.login} ». Le mot de passe du parent ne change pas.`;
  }
  return `Compte parent « ${r.login} » créé pour ${qui}. Remettez l'identifiant et le mot de passe au tuteur.`;
}
