// Dernière classe suivie, imprimée sur l'attestation (le certificat au
// primaire) à la place de la classe de l'année en cours.
//
// Élève présent : la classe de l'année PRÉCÉDENTE, celle qu'il a achevée —
// un élève de 9ème en 2026-2027 a suivi la 8ème en 2025-2026. Elle vient de
// l'instantané figé à la clôture (historique[année].classe, cf.
// cloture-annee-utils), à défaut de la classe saisie à l'inscription pour un
// élève venu d'une autre école (derniereClasse).
//
// Élève parti : la classe qu'il suivait à son départ, sous l'année attestée.
import { anneePrecedente, anneeScolaireDeDate, estSorti } from "../../constants.js";

// Année scolaire que la pièce CERTIFIE : celle du départ pour un élève parti
// (réimprimée l'année suivante, elle ne doit pas se référencer sous une année
// où il n'était plus là), sinon celle de l'écran.
export const anneeAttesteePour = (eleve = {}, anneeScolaire = "") =>
  (estSorti(eleve) && anneeScolaireDeDate(eleve.dateDepart)) || anneeScolaire;

// Renvoie { classe, annee } (annee "" si inconnue) ou null.
export function derniereClasseSuivie(eleve = {}, { anneeAttestee = "", sorti = false } = {}) {
  if (sorti) {
    const classe = String(eleve.classe || "").trim();
    return classe ? { classe, annee: anneeAttestee } : null;
  }
  const precedente = anneePrecedente(anneeAttestee);
  const archivee = String(eleve.historique?.[precedente]?.classe || "").trim();
  if (archivee) return { classe: archivee, annee: precedente };
  const saisie = String(eleve.derniereClasse || "").trim();
  return saisie ? { classe: saisie, annee: "" } : null;
}

// « 8ème A (2025-2026) », ou la classe seule quand l'année est inconnue.
export const formatDerniereClasse = (derniere) => {
  if (!derniere) return "";
  return derniere.annee ? `${derniere.classe} (${derniere.annee})` : derniere.classe;
};

// Ce que la pièce imprime, pour l'élève et l'année de l'écran ("" : la ligne
// n'est pas imprimée). Partagé par le document et l'onglet qui le liste.
export const derniereClassePourAttestation = (eleve = {}, anneeScolaire = "") =>
  formatDerniereClasse(derniereClasseSuivie(eleve, {
    anneeAttestee: anneeAttesteePour(eleve, anneeScolaire),
    sorti: estSorti(eleve),
  }));
