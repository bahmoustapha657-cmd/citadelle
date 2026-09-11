// ════════════════════════════════════════════════════════════════════════
//  Élèves dispensés de payer — exonérations totales ou partielles
// ════════════════════════════════════════════════════════════════════════
// Un élève exonéré était compté « Impayé » chaque mois : il remontait dans les
// alertes, gonflait les impayés du bilan, et le blocage des parents en impayé
// retenait ses bulletins. L'exonération corrige la source — le montant dû —
// plutôt que chaque écran l'un après l'autre.
//
// Elle vit sur la fiche de l'élève (`eleve.exoneration`, dans extra : aucune
// migration) et porte trois taux, un par poste de facturation : une école peut
// dispenser des mensualités sans dispenser de l'inscription, ou n'accorder
// qu'une réduction de moitié aux enfants du personnel.
//
// Elle vaut pour UNE année scolaire : la clôture l'archive avec les paiements
// et repart d'une fiche vierge (cf. cloture-annee-utils), et la rentrée propose
// de la reconduire. Une situation sociale change ; une dispense que personne ne
// réexamine est une fuite d'argent silencieuse.

export const POSTES_EXONERABLES = ["mensualites", "inscription", "fraisAnnexes"] as const;
export type PosteExonerable = typeof POSTES_EXONERABLES[number];

export const LIBELLES_POSTES: Record<PosteExonerable, string> = {
  mensualites: "Mensualités",
  inscription: "Inscription",
  fraisAnnexes: "Frais annexes",
};

// Motifs proposés. « Autre » oblige à préciser : une exonération sans raison
// écrite est intraçable le jour où on demande des comptes.
export const MOTIFS_EXONERATION = [
  { id: "personnel", label: "Enfant du personnel" },
  { id: "orphelin", label: "Orphelin" },
  { id: "boursier", label: "Boursier" },
  { id: "social", label: "Cas social" },
  { id: "merite", label: "Mérite" },
  { id: "fratrie", label: "Fratrie" },
  { id: "autre", label: "Autre" },
];

export type Exoneration = {
  annee?: string;
  mensualites?: number;   // pourcentages 0–100
  inscription?: number;
  fraisAnnexes?: number;
  motif?: string;
  precision?: string;
  accordeePar?: string;
  accordeeLe?: string;
};

export type EleveExonerable = { exoneration?: Exoneration | null };

const pourcentage = (valeur: unknown): number => {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n));
};

export const libelleMotif = (motif?: string): string =>
  MOTIFS_EXONERATION.find((m) => m.id === motif)?.label || "Autre";

// Forme retenue pour l'enregistrement, ou null si elle n'exonère de rien :
// une exonération à 0 % partout n'a pas lieu d'être, on efface le champ.
export function normaliserExoneration(brut: Exoneration | null | undefined): Exoneration | null {
  if (!brut) return null;
  const taux = POSTES_EXONERABLES.reduce<Record<string, number>>((acc, poste) => {
    acc[poste] = pourcentage(brut[poste]);
    return acc;
  }, {});
  if (POSTES_EXONERABLES.every((poste) => taux[poste] === 0)) return null;
  return {
    ...taux,
    annee: String(brut.annee || "").trim(),
    motif: String(brut.motif || "autre").trim(),
    precision: String(brut.precision || "").trim(),
    accordeePar: String(brut.accordeePar || "").trim(),
    accordeeLe: String(brut.accordeeLe || "").trim(),
  };
}

export const getExoneration = (eleve: EleveExonerable = {}): Exoneration | null =>
  normaliserExoneration(eleve?.exoneration);

export const aUneExoneration = (eleve: EleveExonerable = {}): boolean => getExoneration(eleve) !== null;

// Taux d'un poste, en fraction (0 → rien, 1 → dispense totale).
export function tauxExoneration(eleve: EleveExonerable = {}, poste: PosteExonerable = "mensualites"): number {
  const exo = getExoneration(eleve);
  return exo ? pourcentage(exo[poste]) / 100 : 0;
}

// Dispensé de TOUT sur ce poste : plus rien n'est attendu, donc plus aucun
// impayé à lui reprocher.
export const estExonereTotal = (eleve: EleveExonerable = {}, poste: PosteExonerable = "mensualites"): boolean =>
  tauxExoneration(eleve, poste) >= 1;

// Ce que l'élève doit réellement, une fois la remise appliquée.
export function montantApresExoneration(montant: number, eleve: EleveExonerable = {}, poste: PosteExonerable = "mensualites"): number {
  const du = Number(montant) || 0;
  return Math.round(du * (1 - tauxExoneration(eleve, poste)));
}

// Ce que l'école renonce à percevoir sur ce montant — le manque à gagner.
export const montantExonere = (montant: number, eleve: EleveExonerable = {}, poste: PosteExonerable = "mensualites"): number =>
  (Number(montant) || 0) - montantApresExoneration(montant, eleve, poste);

// « Mensualités 100 % · Inscription 50 % » — pour les badges et les listes.
export function resumeExoneration(eleve: EleveExonerable = {}): string {
  const exo = getExoneration(eleve);
  if (!exo) return "";
  return POSTES_EXONERABLES
    .filter((poste) => pourcentage(exo[poste]) > 0)
    .map((poste) => `${LIBELLES_POSTES[poste]} ${pourcentage(exo[poste])} %`)
    .join(" · ");
}
