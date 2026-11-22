// Dernière classe suivie, imprimée sur l'attestation (le certificat au
// primaire) à la place de la classe de l'année en cours.
//
// C'est la classe de la dernière année ACHEVÉE — la pièce certifie un niveau
// atteint, pas une classe commencée :
//
//  • Élève présent : l'année PRÉCÉDENTE — un élève de 9ème en 2026-2027 a
//    achevé la 8ème en 2025-2026.
//  • Élève parti : l'année qui PRÉCÈDE celle de son départ. Celui qui a fait
//    la 9ème en 2025-2026, promu en 10ème à la clôture puis déclaré transféré
//    en 2026-2027, n'a pas achevé la 10ème : sa pièce dit 9ème (2025-2026),
//    pas 10ème (2026-2027). Exception : parti au dernier mois de classe ou
//    après (fin d'année, vacances, diplômé du passage des admis, daté du
//    dernier jour), il a bien achevé l'année de son départ.
//
// La classe vient de l'instantané figé à la clôture (historique[année].classe,
// cf. cloture-annee-utils), à défaut de la classe saisie à l'inscription pour
// un élève venu d'une autre école (derniereClasse).
import { anneePrecedente, anneeScolaireDeDate, estSorti, finAnneeScolaire } from "../../constants.js";
import { lireDate } from "../../depart-utils.js";

// Année scolaire que la pièce CERTIFIE : celle du départ pour un élève parti
// (réimprimée l'année suivante, elle ne doit pas se référencer sous une année
// où il n'était plus là), sinon celle de l'écran.
export const anneeAttesteePour = (eleve = {}, anneeScolaire = "") =>
  (estSorti(eleve) && anneeScolaireDeDate(eleve.dateDepart)) || anneeScolaire;

// Premier jour du DERNIER mois de classe de `annee` (juin pour une rentrée en
// octobre), d'après le mois de début réglé par l'école. null si l'année est
// illisible.
const debutDernierMois = (annee, moisDebut) => {
  const fin = finAnneeScolaire(annee, moisDebut || "Octobre");
  return fin ? new Date(fin.getFullYear(), fin.getMonth() - 1, 1) : null;
};

// Dernière année scolaire ACHEVÉE dans l'établissement (voir l'en-tête).
// `anneeAttestee` : anneeAttesteePour(), c'est-à-dire l'année du départ pour un
// élève parti daté, l'année de l'écran sinon.
export function derniereAnneeAchevee(eleve = {}, anneeAttestee = "", { moisDebut = "Octobre" } = {}) {
  const depart = estSorti(eleve) ? lireDate(eleve.dateDepart) : null;
  const dernierMois = depart ? debutDernierMois(anneeAttestee, moisDebut) : null;
  return dernierMois && depart >= dernierMois ? anneeAttestee : anneePrecedente(anneeAttestee);
}

// Renvoie { classe, annee } (annee "" si inconnue) ou null.
export function derniereClasseSuivie(eleve = {}, { anneeAttestee = "", moisDebut = "Octobre" } = {}) {
  const achevee = derniereAnneeAchevee(eleve, anneeAttestee, { moisDebut });
  const archivee = String(eleve.historique?.[achevee]?.classe || "").trim();
  if (archivee) return { classe: archivee, annee: achevee };
  // Parti en fin d'année, avant que la clôture n'archive sa classe : il n'a
  // pas été promu, sa classe du moment est celle qu'il vient d'achever.
  if (achevee && achevee === anneeAttestee && estSorti(eleve)) {
    const classe = String(eleve.classe || "").trim();
    if (classe) return { classe, annee: achevee };
  }
  const saisie = String(eleve.derniereClasse || "").trim();
  return saisie ? { classe: saisie, annee: "" } : null;
}

// « 8ème A (2025-2026) », ou la classe seule quand l'année est inconnue.
export const formatDerniereClasse = (derniere) => {
  if (!derniere) return "";
  return derniere.annee ? `${derniere.classe} (${derniere.annee})` : derniere.classe;
};

// La dernière classe suivie, pour l'élève et l'année de l'écran. Partagé par
// le document et l'onglet qui le liste. `moisDebut` : celui de l'école
// (schoolInfo.moisDebut), pour situer la fin de l'année.
export const derniereClasseDeLEleve = (eleve = {}, anneeScolaire = "", { moisDebut = "Octobre" } = {}) =>
  derniereClasseSuivie(eleve, { anneeAttestee: anneeAttesteePour(eleve, anneeScolaire), moisDebut });

// Ce que la pièce imprime ("" : la ligne n'est pas imprimée).
export const derniereClassePourAttestation = (eleve = {}, anneeScolaire = "", options = {}) =>
  formatDerniereClasse(derniereClasseDeLEleve(eleve, anneeScolaire, options));
