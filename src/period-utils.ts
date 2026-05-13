/**
 * Helper pour gérer la périodicité scolaire variable selon l'école.
 *
 * Au secondaire en Guinée, on observe 3 conventions :
 *  - Trimestre (3 périodes T1/T2/T3) — le plus courant, défaut historique d'EduGest
 *  - Semestre  (2 périodes S1/S2)
 *  - Mensuel   (9 mois, dérivés de schoolInfo.moisDebut via calcMoisAnnee)
 *
 * Le défaut "trimestre" garantit la rétrocompat des écoles existantes qui
 * n'ont pas encore le champ `periodicite` posé sur leur document.
 */

import { calcMoisAnnee } from "./constants.js";

export type Periodicite = "trimestre" | "semestre" | "mensuel";

export type SchoolPeriodInfo = {
  periodicite?: string;
  moisDebut?: string;
};

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
  return "trimestre";
}

/**
 * Liste des codes de période ("T1", "S1", "Oct"…) selon la périodicité de l'école.
 *
 * @param schoolInfo  Document école — utilise `periodicite` et `moisDebut`.
 * @param moisAnnee   Liste de mois pré-calculée (depuis SchoolContext) ;
 *                    si absente, recalcule à partir de schoolInfo.moisDebut.
 */
export function getPeriodesForSchool(
  schoolInfo: SchoolPeriodInfo = {},
  moisAnnee?: string[],
): string[] {
  const periodicite = getSchoolPeriodicite(schoolInfo);
  if (periodicite === "trimestre") return ["T1", "T2", "T3"];
  if (periodicite === "semestre") return ["S1", "S2"];
  if (Array.isArray(moisAnnee) && moisAnnee.length > 0) return [...moisAnnee];
  return calcMoisAnnee(schoolInfo.moisDebut || "Octobre");
}

export function getDefaultPeriode(
  schoolInfo: SchoolPeriodInfo = {},
  moisAnnee?: string[],
): string {
  return getPeriodesForSchool(schoolInfo, moisAnnee)[0] || "T1";
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
