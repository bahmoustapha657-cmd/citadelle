// Réglages d'évaluation PROPRES À CHAQUE ANNÉE — logique pure, sans réseau.
//
// Matières, coefficients, natures, périodicité, formes de notes et modèle de
// bulletin vivaient une seule fois pour toute l'école : la moindre retouche
// d'aujourd'hui réécrivait les bulletins des années closes. Constaté à La
// Citadelle (2026-11-02) : « Calcul écrit » passé du coefficient 2 au
// coefficient 1, et dix matières créées en 2026-2027 pour toutes les classes
// du primaire comptaient 0 dans chaque bulletin 2025-2026.
//
// La clôture fige donc les réglages de l'année dans la fiche école
// (ecoles.extra.reglagesAnnees[annee]) ; une année passée se consulte avec
// ses réglages à elle, l'année en cours avec les réglages du jour. Une année
// clôturée avant ce mécanisme n'a rien de figé : elle garde les réglages du
// jour, comme avant.

// Clés de la fiche école qui changent le calcul ou la présentation des notes.
export const CLES_REGLAGES_ECOLE = [
  "periodicite", "periodicitePrimaire", "periodiciteSecondaire", "periodicitePrescolaire",
  "evaluationForms", "modeleBulletin",
];

export const SECTIONS_MATIERES = ["prescolaire", "primaire", "college", "lycee"];

// Matière telle qu'on la fige : tout ce qui la décrit, sans les horodatages.
const matiereFigee = (matiere) => {
  const copie = { ...matiere };
  delete copie.createdAt;
  delete copie.updatedAt;
  return copie;
};

// Instantané des réglages d'une année. `matieresParSection` : { primaire:
// [...], college: [...] } — toutes les matières, enseignées seulement
// comprises (l'onglet Matières de l'archive les montre aussi).
export function figerReglages(schoolInfo = {}, matieresParSection = {}, maintenant = new Date()) {
  const ecole = {};
  for (const cle of CLES_REGLAGES_ECOLE) {
    if (schoolInfo[cle] !== undefined) ecole[cle] = schoolInfo[cle];
  }
  const matieres = {};
  for (const section of SECTIONS_MATIERES) {
    matieres[section] = (matieresParSection[section] || []).map(matiereFigee);
  }
  return { figesLe: maintenant.toISOString(), ecole, matieres };
}

// Réglages figés de `annee`, ou null. Jamais pour l'année officielle : elle
// se règle au jour le jour.
export function reglagesDeLAnnee(schoolInfo = {}, annee = "") {
  if (!annee || annee === (schoolInfo.anneeScolaire || "")) return null;
  return schoolInfo.reglagesAnnees?.[annee] || null;
}

// Fiche école vue depuis `annee` : les réglages figés de l'année par-dessus
// ceux du jour (nom, logo, signataires… ne changent pas).
export function schoolInfoPourAnnee(schoolInfo = {}, annee = "") {
  const reglages = reglagesDeLAnnee(schoolInfo, annee);
  return reglages?.ecole ? { ...schoolInfo, ...reglages.ecole } : schoolInfo;
}

// Matières d'une section pour `annee` : celles figées à la clôture, sinon la
// liste du jour. Une section absente de l'instantané (ouverte depuis) n'avait
// pas de matières cette année-là.
export function matieresPourAnnee(matieresDuJour = [], schoolInfo = {}, annee = "", section = "") {
  const reglages = reglagesDeLAnnee(schoolInfo, annee);
  if (!reglages?.matieres) return matieresDuJour;
  return reglages.matieres[section] || [];
}

// Repère à écrire à la clôture : l'existant est gardé tel quel. Une année
// rouverte puis reclôturée garde les réglages de sa PREMIÈRE clôture — entre
// les deux, les réglages du jour sont déjà ceux de l'année suivante — et une
// année reconstituée depuis l'ancienne base ne se réécrit pas.
export function reglagesAnneesApresCloture(schoolInfo = {}, annee = "", instantane = null) {
  const existants = schoolInfo.reglagesAnnees || {};
  if (!instantane || existants[annee]) return existants;
  return { ...existants, [annee]: instantane };
}
