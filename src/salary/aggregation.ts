// Détection de doublons, bons, regroupement et totaux. Extrait de salary-utils.ts (découpage 2026-05-29).

import type { Teacher, Person, SalaryRecord, SalaryTotals } from "./types";
import { normalizeText, stripLegacyTeacherSuffix, normalizeSalaryName } from "./names";
import { getSalaryMontantBrut, getSalaryNet, getForfaitNet } from "./records";

export type MissingSalaryProfilesOptions = {
  ensCollege?: Teacher[];
  ensLycee?: Teacher[];
  ensPrimaire?: Teacher[];
  personnel?: Person[];
  primeDefaut?: number | string;
};

export type MissingSalaryProfiles = {
  secMissing: Teacher[];
  primMissing: Teacher[];
  persMissing: Person[];
};

export function getMissingSalaryProfiles({
  ensCollege = [],
  ensLycee = [],
  ensPrimaire = [],
  personnel = [],
  primeDefaut = 0,
}: MissingSalaryProfilesOptions = {}): MissingSalaryProfiles {
  const defaultPrimeSet = (Number(primeDefaut) || 0) > 0;
  const secMissing = defaultPrimeSet ? [] : [...ensCollege, ...ensLycee].filter((teacher) => {
    const hasPrime = Number(teacher.primeHoraire || 0) > 0;
    const hasPPC = (teacher.primeParClasse || []).some((item) => Boolean(item.classe && Number(item.prime) > 0));
    return !hasPrime && !hasPPC;
  });
  const primMissing = ensPrimaire.filter((teacher) => Number(teacher.montantForfait || teacher.salaireBase || teacher.forfait || 0) <= 0);
  const persMissing = personnel.filter((person) => (person.statut || "Actif") === "Actif" && Number(person.salaireBase || 0) <= 0);

  return { secMissing, primMissing, persMissing };
}

export function mergeSalaryWithManualFields(existingSalary: SalaryRecord = {}, computedSalary: SalaryRecord = {}): SalaryRecord {
  return {
    ...existingSalary,
    ...computedSalary,
    bon: Number(existingSalary.bon || 0),
    revision: Number(existingSalary.revision || 0),
  };
}

// Cherche un doublon nom+mois+section dans la liste des salaires.
// Sert à empêcher la création de 2 fiches de paie pour le même
// agent / même mois (formulaire manuel — la génération auto gère
// déjà ses propres dédups). Compare noms normalisés (accents, casse,
// whitespace, suffixes legacy "(prof)").
export function findSalaryDuplicate(
  record: SalaryRecord = {},
  salaries: SalaryRecord[] = [],
  opts: { excludeId?: string | null } = {},
): SalaryRecord | null {
  const nom = normalizeText(stripLegacyTeacherSuffix(String(record.nom || "")));
  const mois = String(record.mois || "").trim();
  const section = String(record.section || "").trim();
  if (!nom || !mois || !section) return null;
  return salaries.find((s) => {
    if (opts.excludeId && s._id === opts.excludeId) return false;
    if (String(s.mois || "").trim() !== mois) return false;
    if (String(s.section || "").trim() !== section) return false;
    const otherNom = normalizeText(stripLegacyTeacherSuffix(String(s.nom || "")));
    return otherNom === nom;
  }) || null;
}

export type BonRecord = {
  _id?: string;
  nom?: string;
  mois?: string;
  section?: string;
  montant?: number | string;
  motif?: string;
};

// Récupère les bons qui s'appliquent à une fiche de paie donnée :
// matching strict sur nom normalisé + mois + section. Sans le filtre
// section, un bon enregistré pour la section Secondaire serait appliqué
// aussi à la fiche Personnel du même agent (cas légitime prof+admin) et
// le montant net se retrouvait doublé.
export function findBonsForSalary(salary: SalaryRecord = {}, bons: BonRecord[] = []): BonRecord[] {
  const targetName = normalizeSalaryName(salary.nom || "");
  const targetSection = String(salary.section || "").trim();
  const targetMois = String(salary.mois || "").trim();
  if (!targetName || !targetSection || !targetMois) return [];
  return bons.filter((b) => {
    if (normalizeSalaryName(b.nom || "") !== targetName) return false;
    if (String(b.section || "").trim() !== targetSection) return false;
    if (String(b.mois || "").trim() !== targetMois) return false;
    return true;
  });
}

export function sumBonsForSalary(salary: SalaryRecord = {}, bons: BonRecord[] = []): number {
  return findBonsForSalary(salary, bons).reduce(
    (sum, b) => sum + Number(b.montant || 0),
    0,
  );
}

// Détecte les doublons préexistants dans une liste de fiches de paie
// (même nom normalisé + mois + section). Retourne une Map dont les clés
// sont les triplets nom-mois-section dédupliqués et les valeurs sont les
// fiches concernées (>= 2). Utilisé par l'auto-générateur pour nettoyer
// le legacy avant de régénérer.
export function findExistingSalaryDuplicates(salaries: SalaryRecord[] = []): Map<string, SalaryRecord[]> {
  const groups = new Map<string, SalaryRecord[]>();
  for (const s of salaries) {
    const nom = normalizeText(stripLegacyTeacherSuffix(String(s.nom || "")));
    const mois = String(s.mois || "").trim();
    const section = String(s.section || "").trim();
    if (!nom || !mois || !section) continue;
    const key = `${nom}__${mois}__${section}`;
    const arr = groups.get(key) || [];
    arr.push(s);
    groups.set(key, arr);
  }
  const dups = new Map<string, SalaryRecord[]>();
  for (const [key, arr] of groups) {
    if (arr.length > 1) dups.set(key, arr);
  }
  return dups;
}

// Choisit la fiche à conserver dans un groupe de doublons. Priorité :
//   1. Une fiche avec saisie manuelle (bon ou revision > 0) — ne pas
//      perdre le travail du comptable.
//   2. Sinon la fiche la plus récente (updatedAt > createdAt > 0).
//   3. Sinon la première (stable, déterministe).
export function pickBestSalaryFromGroup(group: SalaryRecord[] = []): SalaryRecord | null {
  if (group.length === 0) return null;
  if (group.length === 1) return group[0];
  const withManual = group.filter(
    (s) => Number(s.bon || 0) > 0 || Number(s.revision || 0) > 0,
  );
  const pool = withManual.length > 0 ? withManual : group;
  return [...pool].sort((a, b) => {
    const ta = Number(a.updatedAt || a.createdAt || 0);
    const tb = Number(b.updatedAt || b.createdAt || 0);
    return tb - ta;
  })[0];
}

export type SalaryPersonMonth = {
  nom: string;
  mois: string;
  parts: SalaryRecord[];
  sections: string[];
  totalMontant: number;
  totalBon: number;
  totalRevision: number;
  totalNet: number;
};

// Regroupe les fiches de paie par (personne, mois). Utilisé côté
// portail enseignant et côté impression pour consolider les bulletins
// quand une même personne cumule plusieurs fonctions (ex : prof
// secondaire + agent administratif). Le matching de "personne" se
// fait par nom normalisé (accents, casse, suffixes legacy).
export function groupSalariesByPersonMonth(salaries: SalaryRecord[] = []): SalaryPersonMonth[] {
  const groups = new Map<string, SalaryPersonMonth>();
  for (const s of salaries) {
    const nom = String(s.nom || "").trim();
    const mois = String(s.mois || "").trim();
    if (!nom || !mois) continue;
    const key = `${normalizeText(stripLegacyTeacherSuffix(nom))}__${mois}`;
    const isForfait = s.section === "Primaire" || s.section === "Personnel";
    const montant = isForfait ? Number(s.montantForfait || 0) : getSalaryMontantBrut(s);
    const bon = Number(s.bon || 0);
    const revision = Number(s.revision || 0);
    const net = isForfait ? getForfaitNet(s) : getSalaryNet(s);
    const section = String(s.section || "");
    const existing = groups.get(key);
    if (existing) {
      existing.parts.push(s);
      if (section && !existing.sections.includes(section)) existing.sections.push(section);
      existing.totalMontant += montant;
      existing.totalBon += bon;
      existing.totalRevision += revision;
      existing.totalNet += net;
    } else {
      groups.set(key, {
        nom,
        mois,
        parts: [s],
        sections: section ? [section] : [],
        totalMontant: montant,
        totalBon: bon,
        totalRevision: revision,
        totalNet: net,
      });
    }
  }
  return [...groups.values()];
}

export function summarizeSalaryTotals(salaries: SalaryRecord[] = []): SalaryTotals {
  return salaries.reduce<SalaryTotals>((summary, salary) => {
    const isForfait = salary.section === "Primaire" || salary.section === "Personnel";
    const montant = isForfait ? Number(salary.montantForfait || 0) : getSalaryMontantBrut(salary);
    const bon = Number(salary.bon || 0);
    const revision = Number(salary.revision || 0);
    const net = isForfait ? getForfaitNet(salary) : getSalaryNet(salary);

    return {
      montant: summary.montant + montant,
      bon: summary.bon + bon,
      revision: summary.revision + revision,
      net: summary.net + net,
    };
  }, { montant: 0, bon: 0, revision: 0, net: 0 });
}
