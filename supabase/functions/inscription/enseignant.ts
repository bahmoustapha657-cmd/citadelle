// ════════════════════════════════════════════════════════════════════════
//  Inscription d'un ENSEIGNANT INDÉPENDANT — règles pures
// ════════════════════════════════════════════════════════════════════════
// Un enseignant seul ouvre son propre espace, gratuit, même si son école
// n'utilise pas EduGest (décision du 2026-11-18). L'espace est une petite
// école (ecoles.type_espace = 'enseignant') dont il est l'unique compte.
//
// Son NUMÉRO DE TÉLÉPHONE sert à la fois de code de l'espace et
// d'identifiant : une seule chose à retenir. Un numéro guinéen écrit à sa
// façon (« +224 622 12 34 56 ») devient les 9 chiffres nationaux ; un numéro
// étranger garde ses seuls chiffres.
//
// Module SANS dépendance : index.ts l'importe, tests/espace-enseignant.test.js
// le charge tel quel.
import { numeroNational } from "../_shared/telephone.ts";

export const SECTIONS_ENSEIGNANT = ["prescolaire", "primaire", "college", "lycee"];

// Code de l'espace = identifiant de connexion. null si le numéro est
// inexploitable.
export function codeEspaceEnseignant(telephone: unknown): string | null {
  const national = numeroNational(telephone);
  if (national) return national;
  const chiffres = String(telephone ?? "").replace(/[^0-9]/g, "");
  return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null;
}

type Corps = Record<string, unknown>;
const texte = (v: unknown) => String(v ?? "").trim();

export type InscriptionEnseignant = {
  code: string;
  login: string;
  nomEnseignant: string;
  etablissement: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  sections: string[];
  mdp: string;
};

// Valide le formulaire ; renvoie { error, status } ou les champs nettoyés.
export function validerInscriptionEnseignant(corps: Corps): { error: string; status: number } | InscriptionEnseignant {
  const nomEnseignant = texte(corps.nomEnseignant);
  const etablissement = texte(corps.etablissement);
  const ville = texte(corps.ville);
  const email = texte(corps.email);
  const mdp = String(corps.mdp ?? "");
  if (nomEnseignant.length < 3) return { error: "Votre nom et prénom sont requis.", status: 400 };
  if (!etablissement) return { error: "Le nom de l'établissement où vous enseignez est requis.", status: 400 };
  if (!ville) return { error: "La ville est requise.", status: 400 };
  const code = codeEspaceEnseignant(corps.telephone);
  if (!code) return { error: "Numéro de téléphone invalide.", status: 400 };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse e-mail invalide.", status: 400 };
  const sections = Array.isArray(corps.sections)
    ? SECTIONS_ENSEIGNANT.filter((s) => (corps.sections as unknown[]).includes(s))
    : [];
  if (!sections.length) return { error: "Choisissez au moins un niveau enseigné.", status: 400 };
  if (mdp.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères.", status: 400 };
  const national = numeroNational(corps.telephone);
  return {
    code,
    login: code,
    nomEnseignant,
    etablissement,
    ville,
    pays: texte(corps.pays) || "Guinée",
    telephone: national ? `+224${national}` : code,
    email,
    sections,
    mdp,
  };
}

// Ligne `ecoles` de l'espace. Plan gratuit, actif d'emblée, sections limitées
// aux niveaux enseignés.
//
// `retraitNonReinscrits: 0` : un élève sans AUCUN paiement de l'année quitte
// d'ordinaire sa classe un mois après la rentrée (src/ecartes-non-reinscrits.js,
// et le rappel quotidien de l'Edge rappel-reinscriptions). Dans un espace
// enseignant, personne ne paie rien : sans ce réglage, tous ses élèves
// disparaîtraient de ses classes.
export function ligneEcoleEnseignant(f: InscriptionEnseignant, maintenant = Date.now()) {
  return {
    code: f.code,
    nom: f.etablissement,
    pays: f.pays,
    plan: "gratuit",
    actif: true,
    type_espace: "enseignant",
    extra: {
      ville: f.ville, createdAt: maintenant, securityVersion: 2,
      responsable: f.nomEnseignant, telephone: f.telephone, email: f.email,
      sectionsActives: f.sections,
      retraitNonReinscrits: 0,
    },
  };
}

// Ligne `comptes` de l'enseignant : seul compte de l'espace, avec les droits
// de la direction (classes, élèves, notes, bulletins). Il a choisi son mot
// de passe : pas d'écran « changez votre mot de passe » à la 1re connexion.
export function ligneCompteEnseignant(f: InscriptionEnseignant, userId: string, ecoleId: string) {
  return {
    user_id: userId, ecole_id: ecoleId, login: f.login, role: "direction",
    nom: f.nomEnseignant, label: "Enseignant", statut: "Actif", premiere_co: false,
    email: f.email, telephone: f.telephone,
  };
}
