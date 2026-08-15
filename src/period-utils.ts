/**
 * Helper pour gérer la périodicité scolaire variable selon l'école et la section.
 *
 * Au secondaire en Guinée, on observe 3 conventions :
 *  - Trimestre (3 périodes T1/T2/T3) — le plus courant
 *  - Semestre  (2 périodes S1/S2) — typique du collège/lycée
 *  - Mensuel   (9 mois, dérivés de schoolInfo.moisDebut via calcMoisAnnee)
 *
 * Périodicité PAR SECTION (depuis 2026-05-19) :
 *  - schoolInfo.periodicitePrimaire   → primaire (défaut "trimestre")
 *  - schoolInfo.periodiciteSecondaire → collège + lycée (défaut "trimestre")
 *  - schoolInfo.periodicite (legacy)  → fallback unique si pas de valeur section
 *
 * Le défaut "trimestre" garantit la rétrocompat des écoles existantes.
 * Les écoles guinéennes typiques : primaire trimestre, secondaire semestre.
 */

import { calcMoisAnnee } from "./constants.js";

export type Periodicite = "trimestre" | "semestre" | "mensuel";

export type SchoolSection = "prescolaire" | "primaire" | "secondaire" | "college" | "lycee";

export type SchoolPeriodInfo = {
  periodicite?: string;
  periodicitePrescolaire?: string;
  periodicitePrimaire?: string;
  periodiciteSecondaire?: string;
  moisDebut?: string;
};

function isValidPeriodicite(value: unknown): value is Periodicite {
  return value === "trimestre" || value === "semestre" || value === "mensuel";
}

// Le PRÉSCOLAIRE a sa propre périodicité depuis le 2026-08-15. Auparavant,
// tout ce qui n'était pas « primaire » basculait sur le secondaire : la
// maternelle se voyait donc proposer les semestres du collège alors que ses
// notes étaient saisies en trimestres — elles devenaient invisibles dans les
// grilles et les bulletins (783 notes concernées à La Citadelle).
function normalizeSection(section: SchoolSection | string = ""): "prescolaire" | "primaire" | "secondaire" {
  if (section === "prescolaire") return "prescolaire";
  return section === "primaire" ? "primaire" : "secondaire";
}

const CLE_PERIODICITE = {
  prescolaire: "periodicitePrescolaire",
  primaire: "periodicitePrimaire",
  secondaire: "periodiciteSecondaire",
} as const;

export const PERIODICITES: Array<{
  value: Periodicite;
  label: string;
  description: string;
}> = [
  { value: "trimestre", label: "Trimestre", description: "3 périodes : T1, T2, T3" },
  { value: "semestre", label: "Semestre", description: "2 périodes : S1, S2" },
  { value: "mensuel", label: "Mensuel", description: "Une période par mois (selon le mois de début)" },
];

export function getSchoolPeriodicite(schoolInfo: SchoolPeriodInfo = {}): Periodicite {
  const value = schoolInfo?.periodicite;
  if (value === "semestre" || value === "mensuel") return value;
  if (value === "trimestre") return "trimestre";
  return "trimestre";
}

/**
 * Périodicité applicable à une section donnée.
 * Priorité : champ section spécifique → champ legacy global → défaut "trimestre".
 */
export function getSchoolPeriodiciteForSection(
  schoolInfo: SchoolPeriodInfo = {},
  section: SchoolSection | string = "secondaire",
): Periodicite {
  const normalisee = normalizeSection(section);
  const fromSection = schoolInfo?.[CLE_PERIODICITE[normalisee]];
  if (isValidPeriodicite(fromSection)) return fromSection;
  // Maternelle non réglée : elle suit le PRIMAIRE, pas le secondaire — c'est
  // le cycle dont elle partage le module et le rythme.
  if (normalisee === "prescolaire") {
    const duPrimaire = schoolInfo?.periodicitePrimaire;
    if (isValidPeriodicite(duPrimaire)) return duPrimaire;
  }
  const legacy = schoolInfo?.periodicite;
  if (isValidPeriodicite(legacy)) return legacy;
  return "trimestre";
}

/**
 * Liste des codes de période ("T1", "S1", "Oct"…) selon la périodicité de l'école.
 *
 * @param schoolInfo  Document école — utilise `periodicite` et `moisDebut`.
 * @param moisAnnee   Liste de mois pré-calculée (depuis SchoolContext) ;
 *                    si absente, recalcule à partir de schoolInfo.moisDebut.
 */
function periodesFor(periodicite: Periodicite, schoolInfo: SchoolPeriodInfo, moisAnnee?: string[]): string[] {
  if (periodicite === "trimestre") return ["T1", "T2", "T3"];
  if (periodicite === "semestre") return ["S1", "S2"];
  if (Array.isArray(moisAnnee) && moisAnnee.length > 0) return [...moisAnnee];
  return calcMoisAnnee(schoolInfo.moisDebut || "Octobre");
}

export function getPeriodesForSchool(
  schoolInfo: SchoolPeriodInfo = {},
  moisAnnee?: string[],
): string[] {
  return periodesFor(getSchoolPeriodicite(schoolInfo), schoolInfo, moisAnnee);
}

/**
 * Liste des codes de période pour une section précise (primaire vs secondaire).
 * À utiliser dès qu'un appelant connaît la section concernée — c'est le helper
 * à privilégier dans la pédagogie, les bulletins, les portails.
 */
export function getPeriodesForSection(
  schoolInfo: SchoolPeriodInfo = {},
  section: SchoolSection | string = "secondaire",
  moisAnnee?: string[],
): string[] {
  return periodesFor(getSchoolPeriodiciteForSection(schoolInfo, section), schoolInfo, moisAnnee);
}

export function getDefaultPeriode(
  schoolInfo: SchoolPeriodInfo = {},
  moisAnnee?: string[],
): string {
  return getPeriodesForSchool(schoolInfo, moisAnnee)[0] || "T1";
}

export function getDefaultPeriodeForSection(
  schoolInfo: SchoolPeriodInfo = {},
  section: SchoolSection | string = "secondaire",
  moisAnnee?: string[],
): string {
  return getPeriodesForSection(schoolInfo, section, moisAnnee)[0] || "T1";
}

/**
 * Libellé long pour l'impression bulletin / titres.
 * Les mois passent tels quels (ils sont déjà lisibles : "Oct", "Nov"...).
 */
export function getPeriodeLongLabel(periode: string): string {
  switch (periode) {
    case "T1": return "1er trimestre";
    case "T2": return "2ème trimestre";
    case "T3": return "3ème trimestre";
    case "S1": return "1er semestre";
    case "S2": return "2ème semestre";
    default: return periode;
  }
}

/**
 * Vérifie qu'une période est valide pour la périodicité actuelle.
 * Utile pour filtrer/ignorer les notes saisies sous une ancienne périodicité.
 */
export function isPeriodeValid(
  periode: string,
  schoolInfo: SchoolPeriodInfo = {},
  moisAnnee?: string[],
): boolean {
  if (!periode) return false;
  return getPeriodesForSchool(schoolInfo, moisAnnee).includes(periode);
}

export function isPeriodeValidForSection(
  periode: string,
  schoolInfo: SchoolPeriodInfo = {},
  section: SchoolSection | string = "secondaire",
  moisAnnee?: string[],
): boolean {
  if (!periode) return false;
  return getPeriodesForSection(schoolInfo, section, moisAnnee).includes(periode);
}
