// ════════════════════════════════════════════════════════════════════════
//  Enseignant dans PLUSIEURS établissements — règles pures
// ════════════════════════════════════════════════════════════════════════
// Un enseignant indépendant enseigne souvent dans plusieurs établissements
// (décision du 2026-11-18, étape 2). Chaque établissement a son espace
// (ecoles.type_espace = 'enseignant') : ses données restent séparées, et
// pourront rejoindre l'école le jour où elle adopte EduGest. Les espaces
// d'un même enseignant sont reliés par comptes.personne_id : il passe de
// l'un à l'autre sans mot de passe et voit toutes ses classes ensemble.
//
// Il se connecte toujours avec son numéro (code du premier espace) ; les
// suivants ont pour code son numéro suivi d'un rang (« 622000111-2 »), que
// personne n'a à retenir.
//
// Module SANS autre dépendance que inscription/enseignant.ts : index.ts
// l'importe, tests/enseignant-etablissements.test.js le charge tel quel.
import { SECTIONS_ENSEIGNANT } from "../inscription/enseignant.ts";

// Plafond d'établissements par enseignant (espace gratuit) : de quoi couvrir
// un vacataire, pas de quoi faire tourner une école entière.
export const MAX_ETABLISSEMENTS = 6;

type Refus = { error: string; status: number };
type Corps = Record<string, unknown>;
const texte = (v: unknown) => String(v ?? "").trim();

// Ajout d'un établissement : depuis l'espace d'un enseignant seulement, par
// son compte (rôle direction de l'espace), sous le plafond.
export function refusAjoutEtablissement(typeEspace: unknown, roleAppelant: unknown, nbEspaces: number): Refus | null {
  if (typeEspace !== "enseignant" || roleAppelant !== "direction") {
    return { error: "Ajouter un établissement se fait depuis l'espace d'un enseignant.", status: 403 };
  }
  if (nbEspaces >= MAX_ETABLISSEMENTS) {
    return { error: `Vous avez déjà ${MAX_ETABLISSEMENTS} établissements : c'est le maximum.`, status: 409 };
  }
  return null;
}

export type NouvelEtablissement = { etablissement: string; ville: string; sections: string[] };

export function validerNouvelEtablissement(corps: Corps): Refus | NouvelEtablissement {
  const etablissement = texte(corps.etablissement);
  const ville = texte(corps.ville);
  if (!etablissement) return { error: "Le nom de l'établissement est requis.", status: 400 };
  if (!ville) return { error: "La ville est requise.", status: 400 };
  const sections = Array.isArray(corps.sections)
    ? SECTIONS_ENSEIGNANT.filter((s) => (corps.sections as unknown[]).includes(s))
    : [];
  if (!sections.length) return { error: "Choisissez au moins un niveau enseigné.", status: 400 };
  return { etablissement, ville, sections };
}

// Base des codes : le numéro de l'enseignant, qui est aussi son identifiant
// dans chacun de ses espaces. null si l'identifiant n'est pas un numéro.
export function baseCodeEnseignant(login: unknown): string | null {
  const l = String(login ?? "").trim();
  return /^[0-9]{8,15}$/.test(l) ? l : null;
}

// Code du prochain établissement : « <numéro>-2 », puis « -3 »… le premier
// rang libre (un établissement retiré libère le sien).
export function codeEtablissementSuivant(base: string, codesPris: Iterable<string>): string {
  const pris = new Set(codesPris);
  for (let rang = 2; ; rang += 1) {
    const code = `${base}-${rang}`;
    if (!pris.has(code)) return code;
  }
}

// Changer d'espace d'un établissement à un autre : seulement entre deux
// espaces enseignants. Entre écoles, les espaces d'une personne restent ceux
// de sa propre école (espaces.ts, refusChangement).
export const entreEspacesEnseignant = (typeAppelant: unknown, typeCible: unknown) =>
  typeAppelant === "enseignant" && typeCible === "enseignant";

// Mot de passe de l'accès de connexion d'un établissement suivant : jamais
// saisi par personne — l'enseignant y entre depuis son premier espace, sans
// mot de passe (changer_espace). Aléatoire, long, avec les quatre familles de
// caractères qu'une politique de mot de passe pourrait exiger.
export function motDePasseInterne(aleatoire: () => string = () => crypto.randomUUID()): string {
  return `${aleatoire()}${aleatoire()}`.replace(/-/g, "") + "Aa1!";
}
