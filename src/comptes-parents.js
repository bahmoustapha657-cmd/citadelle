// ── Comptes parents : un foyer, un compte, tous ses enfants ────────────────
// Module PUR (testé par tests/comptes-parents.test.js) : identifiant
// suggéré, charge utile envoyée à account-manage, recherche d'un compte et
// messages. Les appels au serveur vivent dans backend/compte-parent.js ; la
// règle « même parent », côté serveur, dans
// supabase/functions/account-manage/foyer.ts.
import { normaliserTelGuinee } from "../shared/phone.js";

// Identifiant valide côté serveur : minuscules, sans accents, [a-z0-9]
// uniquement (le pattern d'API rejette é/è/à et les espaces).
export const slugLogin = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "");

// Numéro national à 9 chiffres (« 622123456 »), ou null.
export const numeroNational = (brut) => normaliserTelGuinee(brut)?.slice(4) || null;

// Identifiant proposé pour un compte parent : son numéro, facile à retenir ;
// à défaut (numéro absent ou illisible), parent.<nom de l'élève>.
export const loginParentSuggere = (nom, telephone) =>
  numeroNational(telephone) || `parent.${slugLogin(nom).slice(0, 12)}`;

// Identifiant saisi à la connexion : un numéro écrit à sa façon
// (« 622 12 34 56 », « +224 622… ») devient l'identifiant à 9 chiffres ; un
// identifiant ordinaire ou un e-mail reste tel quel. Miroir de
// supabase/functions/_shared/telephone.ts (« Mot de passe oublié »).
export function identifiantConnexion(saisie) {
  const s = String(saisie ?? "").trim();
  if (/[a-z@]/i.test(s)) return s;
  return numeroNational(s) ?? s;
}

// « +224 622 12 34 56 » ; un numéro illisible est rendu tel quel.
export function telephoneLisible(tel) {
  const n = numeroNational(tel);
  return n ? `+224 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}` : String(tel || "");
}

// Lien de parenté d'un rattachement (contrainte parent_eleves_lien_check).
export const LIENS_PARENT = [
  { id: "pere", label: "Père" },
  { id: "mere", label: "Mère" },
  { id: "tuteur", label: "Tuteur / tutrice" },
  { id: "autre", label: "Autre" },
];
export const libelleLien = (id) => LIENS_PARENT.find((l) => l.id === id)?.label || "";

const nomComplet = (e) => `${e.prenom || ""} ${e.nom || ""}`.trim();

// Charge utile de account-manage (action create, rôle parent) : `eleves` =
// [{ _id, nom, prenom, classe, section, tuteur, contactTuteur, filiation }]
// — un élève depuis sa fiche, plusieurs depuis la saisie rapide. `parent` :
// { nom, telephone, lien } du parent titulaire ; à défaut, le tuteur du
// premier élève. Pas de section au compte : un parent suit ses enfants dans
// toutes les sections (chaque lien porte celle de l'enfant).
export function payloadCompteParent({ schoolId, login, mdp, eleves, parent = {} }) {
  const [premier] = eleves;
  const nom = String(parent.nom ?? premier.tuteur ?? "").trim();
  const telephone = String(parent.telephone ?? premier.contactTuteur ?? "").trim();
  return {
    schoolId,
    login: String(login || "").trim().toLowerCase(),
    mdp,
    role: "parent",
    label: "Parent",
    nom: nom || `Parent de ${premier.prenom}`,
    eleveId: premier._id,
    eleveNom: nomComplet(premier),
    eleveClasse: premier.classe || "",
    eleveIds: eleves.map((e) => e._id),
    elevesAssocies: eleves.map((e) => ({
      eleveId: e._id, eleveNom: nomComplet(e), eleveClasse: e.classe || "", section: e.section || null,
    })),
    tuteur: nom,
    contactTuteur: telephone,
    telephone,
    filiation: premier.filiation || "",
    lien: parent.lien || null,
    statut: "Actif",
  };
}

// Recherche d'un compte parent (fiche élève → « Rattacher à un compte
// existant ») : par numéro, quelle que soit son écriture, ou par
// identifiant / nom (sans casse ni accents).
const pourRecherche = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export function chercherComptesParents(comptes, saisie, max = 8) {
  const texte = pourRecherche(saisie);
  if (texte.length < 2) return [];
  const tel = normaliserTelGuinee(saisie);
  return comptes.filter((c) => {
    if (tel && [c.telephone, c.extra?.contactTuteur].some((t) => normaliserTelGuinee(t) === tel)) return true;
    return [c.login, c.nom, c.extra?.tuteur].some((v) => pourRecherche(v).includes(texte));
  }).slice(0, max);
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
