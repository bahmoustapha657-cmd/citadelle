// Passerelle MANUELLE entre sections (bouton « 🌉 Passerelle » de l'écran
// Élèves) : on coche des élèves d'une section — d'ordinaire le préscolaire —
// et on choisit leur classe dans une autre — d'ordinaire le primaire —, sans
// attendre la clôture de l'année ni dépendre des moyennes (la promotion de fin
// d'année, elle, ne se lance qu'une fois, après clôture).
//
// La fiche change de classe ET de section dans la même requête
// (changerSectionDoc) : jamais d'élève « 1ère Année A » resté au préscolaire,
// le défaut corrigé en 2026-09 (cf. admin-promotion.js). Ses notes et
// absences restent dans la section de départ, comme après une promotion.

import { changerSectionDoc } from "../../../backend/data-supabase";
import {
  estSorti, getClassesForSection, getSectionForClasse, getSectionsActives, getSystemeScolaire,
} from "../../../constants";

// Nb de déplacements lancés en parallèle (1 requête par élève).
const PARALLELE = 20;

export const COLLECTION_ELEVES = {
  prescolaire: "elevesPrescolaire", primaire: "elevesPrimaire", college: "elevesCollege", lycee: "elevesLycee",
};

// Sections proposées : celles ouvertes dans l'école, dans l'ordre du cursus.
export const sectionsPasserelle = (schoolInfo) => getSectionsActives(schoolInfo);

// Section d'arrivée par défaut : la suivante dans le cursus (préscolaire →
// primaire…), sinon la première autre section ouverte.
export function sectionSuivante(schoolInfo, depart) {
  const actives = sectionsPasserelle(schoolInfo);
  const i = actives.indexOf(depart);
  return actives[i + 1] || actives.find((s) => s !== depart) || "";
}

// Élèves déplaçables : présents (pas partis), triés par classe puis nom.
export function elevesPasserelle(eleves = []) {
  return eleves
    .filter((e) => !estSorti(e))
    .sort((a, b) => String(a.classe || "").localeCompare(String(b.classe || ""), "fr", { numeric: true })
      || String(a.nom || "").localeCompare(String(b.nom || ""), "fr")
      || String(a.prenom || "").localeCompare(String(b.prenom || ""), "fr"));
}

// Classes d'arrivée proposées : celles du système de l'école, plus celles que
// l'école a créées ou déjà utilisées (« 1ère Année E »…), toutes de la section.
export function classesArrivee(schoolInfo, section, classesEcole = []) {
  const prevues = getClassesForSection(section, getSystemeScolaire(schoolInfo || {}));
  const creees = classesEcole.map((c) => String(c?.nom ?? c ?? "").trim()).filter(Boolean);
  return [...new Set([...prevues, ...creees])].filter((c) => getSectionForClasse(c) === section);
}

// Une classe d'arrivée n'est acceptée que si elle appartient bien à la section
// d'arrivée : « Grande Section B » rangé au primaire y serait introuvable.
export const classeArriveeValide = (classe, section) =>
  Boolean(String(classe || "").trim()) && getSectionForClasse(classe) === section;

// Fait passer `eleves` (fiches de la section `depart`) en `classe` de la
// section `arrivee`. Écrit sur le SERVEUR : un refus de la RLS y est visible
// (hors ligne, il passerait inaperçu jusqu'à la synchro).
// Continue malgré un échec isolé : renvoie { passes: [...], echecs: [{ eleve, erreur }] }.
export async function appliquerPasserelle(schoolId, eleves, { depart, arrivee, classe }) {
  const cible = String(classe || "").trim();
  if (!COLLECTION_ELEVES[depart] || !COLLECTION_ELEVES[arrivee] || depart === arrivee) {
    throw new Error("Choisissez deux sections différentes.");
  }
  if (!classeArriveeValide(cible, arrivee)) {
    throw new Error(`« ${cible} » n'est pas une classe de la section d'arrivée.`);
  }
  const passes = [];
  const echecs = [];
  for (let i = 0; i < eleves.length; i += PARALLELE) {
    await Promise.all(eleves.slice(i, i + PARALLELE).map(async (e) => {
      try {
        await changerSectionDoc(schoolId, COLLECTION_ELEVES[depart], e._id, arrivee, { classe: cible }, { reseau: true });
        passes.push(e);
      } catch (err) {
        echecs.push({ eleve: e, erreur: err?.message || String(err) });
      }
    }));
  }
  return { passes, echecs };
}
