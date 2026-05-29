// Types partagés du domaine paie. Extrait de salary-utils.ts (découpage 2026-05-29).

// Bumper à chaque changement de formule de salaire (heures, prime, montantBrut)
// qui rendrait les fiches précédentes non reproductibles.
export const SALARY_ALGO_VERSION = 1;

export type PrimeParClasse = {
  classe?: string;
  prime?: number | string;
};

export type Teacher = {
  _id?: string;
  nom?: string;
  prenom?: string;
  nomComplet?: string;
  enseignantNom?: string;
  matiere?: string;
  classe?: string;
  classeTitle?: string;
  grade?: string;
  statut?: string;
  primeHoraire?: number | string;
  primeParClasse?: PrimeParClasse[];
  montantForfait?: number | string;
  salaireBase?: number | string;
  forfait?: number | string;
};

export type ScheduleSlot = {
  jour?: string;
  heureDebut?: string;
  heureFin?: string;
  classe?: string;
  enseignant?: string;
  type?: string;
  primeRevision?: number | string;
};

export type TeachingEntry = {
  heure?: string;
  classe?: string;
  enseignantNom?: string;
  statut?: string;
};

export type Person = {
  nom?: string;
  prenom?: string;
  poste?: string;
  categorie?: string;
  salaireBase?: number | string;
  statut?: string;
  observation?: string;
};

export type ParamSnapshot = {
  primeDefaut: number;
  jours5eme: string[];
};

export type SalaryRecord = {
  _id?: string;
  algoVersion?: number;
  section?: "Primaire" | "Secondaire" | "Personnel" | string;
  mois?: string;
  nom?: string;
  matiere?: string;
  niveau?: string;
  poste?: string;
  categorie?: string;
  vhHebdo?: number;
  vhPrevu?: number;
  cinqSem?: number;
  nonExecute?: number;
  primeHoraire?: number;
  montantBrut?: number | string;
  montantForfait?: number | string;
  primesVariables?: boolean;
  observation?: string;
  paramSnapshot?: ParamSnapshot;
  bon?: number | string;
  revision?: number | string;
  createdAt?: number;
  updatedAt?: number;
};

export type SalaryTotals = {
  montant: number;
  bon: number;
  revision: number;
  net: number;
};
