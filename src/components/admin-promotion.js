// Promotion de fin d'année et passage des admis aux examens : classe suivante
// dérivée dynamiquement (src/promotion-utils.js) + exécution en batch avec
// mode simulation. Extrait de AdminPanel.jsx au refactor découpage 2026-05-29.
// Deux backends : Firebase (writeBatch) et Supabase (chargerCollection +
// modifierChampDoc) — même logique de décision, sélectionnée par isSupabase.
//
// Les deux opérations jugent l'année qui vient d'être CLÔTURÉE, et seulement
// les élèves qui y étaient inscrits et n'ont pas changé de classe depuis
// (classeAnneeCloturee) — les relancer ne fait donc jamais avancer un élève
// deux fois :
//   • promotion : classes ordinaires, sur la moyenne annuelle, une fois par
//     année (repère ecoles.extra.promotions) ;
//   • passage des admis : classes d'examen (6ème Année, 10ème Année,
//     Terminale…), sur le résultat saisi, autant de fois que les résultats
//     arrivent.

import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../firebaseDb";
import { isSupabase } from "../backend";
import { changerSectionDoc, chargerCollection, modifierChampDoc } from "../backend/data-supabase";
import {
  anneePrecedente, finAnneeScolaire, getAnnee, getSectionForClasse, getSectionLabel, getSystemeScolaire,
} from "../constants";
import { notesDeLEleve } from "../note-index";
import { getGeneralAverage } from "../note-utils";
import { getPeriodesForSection } from "../period-utils";
import { buildBulletinNotesAnnuelles } from "../reports/bulletins/annual-notes";
import { classeSuivante, decisionPassage, estClasseExamen, sectionApresPromotion } from "../promotion-utils";
import { matieresForClasse } from "./ecole/ecole-logic";
import { classeAnneeCloturee, etatPromotion } from "./admin/cloture-annee-utils";
import { majFicheEcole } from "./admin/cloture-annee";

// Limite Firestore : 500 opérations par batch (marge de sécurité à 450).
const BATCH_MAX = 450;
// Supabase : nb d'updates lancés en parallèle (modifierChampDoc = 1 par appel).
const SB_PARALLELE = 40;

// Le préscolaire est une section à part entière depuis 2026-07 : sans lui,
// les élèves de maternelle restaient dans leur classe d'une année sur
// l'autre. Il est noté sur 10 comme le primaire (cf. Primaire.jsx) → même
// seuil. Toutes les sections sont LUES avant la première écriture.
const SECTIONS = [
  { section: "college", eleves: "elevesCollege", notes: "notesCollege", matieres: "classesCollege_matieres", surDix: false },
  { section: "prescolaire", eleves: "elevesPrescolaire", notes: "notesPrescolaire", matieres: "classesPrescolaire_matieres", surDix: true },
  { section: "primaire", eleves: "elevesPrimaire", notes: "notesPrimaire", matieres: "classesPrimaire_matieres", surDix: true },
  { section: "lycee", eleves: "elevesLycee", notes: "notesLycee", matieres: "classesLycee_matieres", surDix: false },
];

// Moyenne annuelle d'un élève — EXACTEMENT celle du bulletin annuel.
//
// Elle était calculée ici d'une autre façon : moyenne des moyennes générales
// PAR PÉRIODE, diviseur figé au nombre de périodes, une période sans note
// comptant zéro. Le bulletin, lui, calcule matière par matière et respecte la
// règle « une note de type Moyenne prime sur le découpage en périodes ».
//
// Les deux écrans se contredisaient donc. Constaté sur La Citadelle :
//   CONDE Moustapha (4ème Année A) — bulletin 5,54 ADMIS · promotion 3,73
//   REDOUBLE. Rapport 2/3 : l'élève est noté sur deux trimestres sur trois,
//   et le troisième, vide, divisait sa moyenne d'un tiers.
//
// Un élève déclaré admis sur son bulletin ne peut pas être redoublant à la
// promotion : on appelle donc le MÊME constructeur que le bulletin annuel.
// Une seule définition de la moyenne annuelle dans toute l'application.
function calcMoyenneAnnuelle(schoolInfo, notes, classe, matieres) {
  if (!notes || notes.length === 0) return null;
  const periodes = getPeriodesForSection(schoolInfo, getSectionForClasse(classe));
  const eleveFictif = { _id: "__promo__", classe };
  const notesAnnuelles = buildBulletinNotesAnnuelles({
    eleves: [eleveFictif],
    notes: notes.map((n) => ({ ...n, eleveId: "__promo__" })),
    matsFor: () => matieres,
    periodes,
  });
  if (!notesAnnuelles.length) return null;
  return getGeneralAverage(notesAnnuelles, matieres, classe);
}

// Lecture Supabase qui ÉCHOUE franchement : chargerCollection renvoie une
// liste vide en cas d'erreur, et conclure « personne à promouvoir » d'une
// lecture ratée serait faux.
async function lire(schoolId, nom, filtres) {
  const { items, erreur } = await chargerCollection(schoolId, nom, filtres);
  if (erreur) throw new Error(`lecture impossible (${nom}) : ${erreur}`);
  return items || [];
}

// Charge (eleves, notes, matieres) d'une section — Supabase ou Firebase.
// Renvoie des items uniformes portant `_id` (comme les snapshots Firestore).
// `annee` : les notes sont filtrées sur l'année jugée. Sans ce filtre, la
// moyenne annuelle mélangeait les notes de TOUTES les années dès qu'une
// seconde rentrée existait — et la décision de passage avec.
async function chargerSection(schoolId, sec, annee) {
  if (isSupabase) {
    const [eleves, notes, matieres] = await Promise.all([
      lire(schoolId, sec.eleves),
      lire(schoolId, sec.notes, { annee }),
      lire(schoolId, sec.matieres),
    ]);
    return { eleves, notes, matieres };
  }
  const refNotes = collection(db, "ecoles", schoolId, sec.notes);
  const [snapE, snapN, snapM] = await Promise.all([
    getDocs(collection(db, "ecoles", schoolId, sec.eleves)),
    getDocs(annee ? query(refNotes, where("annee", "==", annee)) : refNotes),
    getDocs(collection(db, "ecoles", schoolId, sec.matieres)),
  ]);
  const m = (snap) => snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
  return { eleves: m(snapE), notes: m(snapN), matieres: m(snapM) };
}

async function chargerEleves(schoolId, sec) {
  if (isSupabase) return lire(schoolId, sec.eleves);
  const snap = await getDocs(collection(db, "ecoles", schoolId, sec.eleves));
  return snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
}

// Une écriture : `champs` sur la fiche, et la section d'arrivée quand ce
// n'est pas celle où la fiche est rangée (Grande Section → 1ère Année :
// préscolaire → primaire ; admis au CEE : primaire → collège).
const ecriture = (sec, eleve, champs, section = sec.section) => ({
  collection: sec.eleves, id: eleve._id, champs,
  ...(section !== sec.section ? { section } : {}),
});
// Détail affiché : la section d'arrivée, quand l'élève en change.
const changement = (sec, section) => (section && section !== sec.section
  ? { nouvelleSection: getSectionLabel(section) }
  : {});

// Décisions de promotion d'une section (logique pure) → accumule dans `acc`.
function analyserSection(schoolInfo, sec, data, sansNotesBehavior, acc, annee) {
  const systeme = getSystemeScolaire(schoolInfo);
  for (const e of data.eleves) {
    if (e.statut !== "Actif") continue;
    acc.total++;
    // La classe JUGÉE est celle de l'année clôturée. null : l'élève n'y était
    // pas inscrit, ou il a déjà changé de classe depuis la clôture.
    const classe = classeAnneeCloturee(e, annee);
    if (!classe) { acc.nonConcernes++; continue; }
    // Classe d'examen : le passage dépend d'un jury national (CEE, BEPC,
    // BAC), pas de nos moyennes — c'est l'affaire du passage des admis.
    if (estClasseExamen(classe, systeme)) {
      acc.examens++;
      acc.classesExamen.add(classe);
      continue;
    }
    const suivante = classeSuivante(classe, systeme);
    if (suivante === null) { acc.terminalistes++; continue; }
    if (suivante === undefined) {
      acc.inconnus++;
      acc.classesInconnues.add(classe);
      continue;
    }
    const notesEleve = notesDeLEleve(data.notes, e._id);
    // Mêmes matières/coefficients que les bulletins (matieresForClasse).
    // Fallback : matières déduites des notes de l'élève (coef 1) si l'école
    // n'a pas configuré ses matières pour cette section.
    const matieresClasse = matieresForClasse(data.matieres, classe);
    const matieresEleve = matieresClasse.length > 0
      ? matieresClasse
      : [...new Set(notesEleve.map((note) => note.matiere).filter(Boolean))].map((nom) => ({ nom }));
    const moy = calcMoyenneAnnuelle(schoolInfo, notesEleve, classe, matieresEleve);
    let decision;
    if (moy === null) {
      acc.sansNotes++;
      decision = sansNotesBehavior;
    } else {
      decision = moy >= sec.seuil ? "promouvoir" : "redoubler";
    }
    if (decision === "promouvoir") {
      const section = sectionApresPromotion(suivante, sec.section, schoolInfo);
      // Section d'arrivée fermée dans l'école : fin du dernier cycle proposé.
      if (!section) { acc.terminalistes++; continue; }
      acc.updates.push(ecriture(sec, e, { classe: suivante }, section));
      acc.promus++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe, nouvClasse: suivante, ...changement(sec, section), moy, statut: "promu" });
    } else {
      acc.redoublants++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe, nouvClasse: null, moy, statut: "redoublant" });
    }
  }
}

// Applique les écritures — Supabase ou Firebase.
async function appliquerUpdates(schoolId, updates) {
  if (isSupabase) {
    for (let i = 0; i < updates.length; i += SB_PARALLELE) {
      await Promise.all(updates.slice(i, i + SB_PARALLELE).map(
        (u) => (u.section
          ? changerSectionDoc(schoolId, u.collection, u.id, u.section, u.champs)
          : modifierChampDoc(schoolId, u.collection, u.id, u.champs)),
      ));
    }
    return;
  }
  // Firebase (legacy, plus exercé) : le changement de section n'y est pas
  // porté — il faudrait recopier la fiche dans la collection d'arrivée.
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH_MAX)) {
      batch.update(doc(db, "ecoles", schoolId, u.collection, u.id), u.champs);
    }
    await batch.commit();
  }
}

// Avance les élèves de l'année CLÔTURÉE dont la moyenne annuelle atteint le
// seuil de leur section. simulate=true : aucune écriture, renvoie seulement
// le bilan prévisionnel — à proposer AVANT l'application réelle.
// Renvoie { annee, total, promus, redoublants, terminalistes, inconnus,
//           classesInconnues, sansNotes, examens, classesExamen,
//           nonConcernes, simulation, details, promotions }.
export async function runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior, simulate = false }) {
  const anneeOfficielle = schoolInfo?.anneeScolaire || getAnnee();
  const etat = etatPromotion(schoolInfo, anneeOfficielle);
  // L'écran applique déjà ces règles ; elles sont répétées ici parce que
  // c'est l'opération de masse la moins réversible de l'année.
  if (etat.statut === "attente") {
    throw new Error(`clôturez d'abord l'année ${anneeOfficielle} — la promotion porte sur une année clôturée.`);
  }
  if (etat.statut === "appliquee" && !simulate) {
    throw new Error(`la promotion ${etat.annee} a déjà été appliquée.`);
  }
  const { annee } = etat;
  const acc = {
    total: 0, promus: 0, redoublants: 0, terminalistes: 0, sansNotes: 0, inconnus: 0,
    examens: 0, nonConcernes: 0, classesExamen: new Set(),
    classesInconnues: new Set(), details: [], updates: [],
  };

  for (const sec of SECTIONS) {
    const seuil = Number(sec.surDix ? seuilPrimaire : seuilCollege);
    const data = await chargerSection(schoolId, sec, annee);
    analyserSection(schoolInfo, { ...sec, seuil }, data, sansNotesBehavior, acc, annee);
  }

  // Repère posé APRÈS les écritures : s'il manque (coupure en cours de
  // route), relancer reste sans danger — les élèves déjà déplacés ne sont
  // plus « concernés ».
  let promotions = null;
  if (!simulate) {
    if (acc.updates.length) await appliquerUpdates(schoolId, acc.updates);
    promotions = {
      ...(schoolInfo?.promotions || {}),
      [annee]: { le: new Date().toISOString(), promus: acc.promus, redoublants: acc.redoublants },
    };
    await majFicheEcole(schoolId, { promotions });
  }

  return {
    annee, total: acc.total, promus: acc.promus, redoublants: acc.redoublants,
    terminalistes: acc.terminalistes, sansNotes: acc.sansNotes, inconnus: acc.inconnus,
    examens: acc.examens, classesExamen: [...acc.classesExamen],
    nonConcernes: acc.nonConcernes, classesInconnues: [...acc.classesInconnues],
    simulation: simulate, details: acc.details, promotions,
  };
}

// Dernier jour de l'année scolaire `annee` (AAAA-MM-JJ, heure locale) : la
// date de départ d'un diplômé. Le jour de l'opération la rattacherait à
// l'année suivante, où il n'a jamais été inscrit (cf. attestation).
function dernierJour(annee, moisDebut) {
  const fin = finAnneeScolaire(annee, moisDebut);
  if (!fin) return "";
  const veille = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 1);
  const deux = (n) => String(n).padStart(2, "0");
  return `${veille.getFullYear()}-${deux(veille.getMonth() + 1)}-${deux(veille.getDate())}`;
}

// Passage des admis aux examens de l'année CLÔTURÉE (6ème Année, 10ème
// Année, Terminale — CM2, 3ème, Terminale en francophone), d'après le
// résultat saisi sur chaque fiche : l'admis passe dans la classe suivante et
// sa section, ou devient « Diplômé » quand l'établissement n'a pas de suite
// à lui offrir ; le refusé reste ; sans résultat, on ne touche à rien.
// Rejouable à mesure que les résultats arrivent (CEE, puis BEPC, puis BAC).
// Renvoie { annee, total, passes, diplomes, refuses, attente, classesAttente,
//           simulation, details, passagesAdmis }.
export async function runPassageAdmis({ schoolId, schoolInfo, simulate = false }) {
  const annee = anneePrecedente(schoolInfo?.anneeScolaire || getAnnee());
  const systeme = getSystemeScolaire(schoolInfo);
  const dateDepart = dernierJour(annee, schoolInfo?.moisDebut);
  const acc = {
    total: 0, passes: 0, diplomes: 0, refuses: 0, attente: 0,
    classesAttente: new Set(), details: [], updates: [],
  };

  for (const sec of SECTIONS) {
    for (const e of await chargerEleves(schoolId, sec)) {
      if (e.statut !== "Actif") continue;
      const classe = classeAnneeCloturee(e, annee);
      if (!classe || !estClasseExamen(classe, systeme)) continue;
      acc.total++;
      const nom = `${e.nom} ${e.prenom}`;
      const { decision, classe: nouvClasse, section } = decisionPassage(classe, e.resultatExamen, sec.section, schoolInfo);
      // Le résultat rejoint l'archive de l'année et QUITTE la fiche : resté
      // en place, un « Admis » ferait passer l'élève à son prochain examen,
      // trois ans plus tard, sans qu'il l'ait présenté.
      const archive = {
        resultatExamen: "",
        historique: { ...e.historique, [annee]: { ...e.historique[annee], resultatExamen: "Admis" } },
      };
      if (decision === "passe") {
        acc.updates.push(ecriture(sec, e, { classe: nouvClasse, ...archive }, section));
        acc.passes++;
        acc.details.push({ nom, classe, statut: "passe", nouvClasse, ...changement(sec, section) });
      } else if (decision === "diplome") {
        acc.updates.push(ecriture(sec, e, {
          statut: "Diplômé", dateDepart,
          motifDepart: `Admis à l'examen de fin de cycle (${classe}, ${annee})`,
          ...archive,
        }));
        acc.diplomes++;
        acc.details.push({ nom, classe, statut: "diplome" });
      } else if (decision === "reste") {
        acc.refuses++;
        acc.details.push({ nom, classe, statut: "reste" });
      } else {
        acc.attente++;
        acc.classesAttente.add(classe);
      }
    }
  }

  // Repère de l'année (date du dernier passage, cumuls) : une année dont des
  // admis sont passés ne peut plus être rouverte (cf. peutRouvrir).
  let passagesAdmis = null;
  if (!simulate && acc.updates.length) {
    await appliquerUpdates(schoolId, acc.updates);
    const avant = schoolInfo?.passagesAdmis?.[annee] || {};
    passagesAdmis = {
      ...(schoolInfo?.passagesAdmis || {}),
      [annee]: {
        le: new Date().toISOString(),
        passes: (avant.passes || 0) + acc.passes,
        diplomes: (avant.diplomes || 0) + acc.diplomes,
      },
    };
    await majFicheEcole(schoolId, { passagesAdmis });
  }

  return {
    annee, total: acc.total, passes: acc.passes, diplomes: acc.diplomes,
    refuses: acc.refuses, attente: acc.attente, classesAttente: [...acc.classesAttente],
    simulation: simulate, details: acc.details, passagesAdmis,
  };
}
