// Promotion de fin d'année : classe suivante dérivée dynamiquement
// (src/promotion-utils.js) + exécution en batch avec mode simulation.
// Extrait de AdminPanel.jsx au refactor découpage 2026-05-29.
// Deux backends : Firebase (writeBatch) et Supabase (chargerCollection +
// modifierChampDoc) — même logique de décision, sélectionnée par isSupabase.

import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../firebaseDb";
import { isSupabase } from "../backend";
import { chargerCollection, modifierChampDoc } from "../backend/data-supabase";
import { getAnnee, getSectionForClasse, getSystemeScolaire } from "../constants";
import { notesDeLEleve } from "../note-index";
import { getGeneralAverage } from "../note-utils";
import { getPeriodesForSection } from "../period-utils";
import { buildBulletinNotesAnnuelles } from "../reports/bulletins/annual-notes";
import { classeSuivante, estClasseExamen } from "../promotion-utils";
import { matieresForClasse } from "./ecole/ecole-logic";
import { champsArchivageClasse } from "./admin/cloture-annee-utils";

// Limite Firestore : 500 opérations par batch (marge de sécurité à 450).
const BATCH_MAX = 450;
// Supabase : nb d'updates lancés en parallèle (modifierChampDoc = 1 par appel).
const SB_PARALLELE = 40;

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

// Charge (eleves, notes, matieres) d'une section — Supabase ou Firebase.
// Renvoie des items uniformes portant `_id` (comme les snapshots Firestore).
// `annee` : les notes sont filtrées sur l'année qui s'achève. Sans ce filtre,
// la moyenne annuelle mélangeait les notes de TOUTES les années dès qu'une
// seconde rentrée existait — et la décision de passage avec.
async function chargerSection(schoolId, sec, annee) {
  if (isSupabase) {
    const [re, rn, rm] = await Promise.all([
      chargerCollection(schoolId, sec.eleves),
      chargerCollection(schoolId, sec.notes, { annee }),
      chargerCollection(schoolId, sec.matieres),
    ]);
    return { eleves: re.items || [], notes: rn.items || [], matieres: rm.items || [] };
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

// Décisions d'une section (logique pure) → accumule dans `acc`.
function analyserSection(schoolInfo, sec, data, sansNotesBehavior, acc, anneeQuiSAcheve = "") {
  // N'archiver la classe QUE si l'année visée a réellement été enseignée.
  // `runPromotion` est appelé sans année : il prend donc l'année COURANTE de
  // l'école. Or si la clôture est déjà passée, celle-ci est la NOUVELLE année —
  // et estampiller son instantané serait grave à deux titres : la vue archive
  // rejouerait une année qui n'a pas commencé, et la vraie clôture de fin
  // d'année refuserait ensuite d'archiver (champsCloture ne réécrit jamais un
  // instantané existant), perdant le seul état qui comptait.
  // La présence de notes sur l'année est le signal simple qu'elle a été vécue.
  const anneeVecue = anneeQuiSAcheve && data.notes.length > 0;
  const archiverClasse = (eleve) => (anneeVecue
    ? champsArchivageClasse(eleve, anneeQuiSAcheve) || {}
    : {});
  for (const e of data.eleves) {
    if (e.statut !== "Actif") continue;
    acc.total++;
    const classeActuelle = e.classe || "";
    const systeme = getSystemeScolaire(schoolInfo);
    // Classe d'examen : le passage dépend d'un jury national (CEE, BEPC, BAC),
    // pas de nos moyennes. La promotion suit donc le RÉSULTAT DE FIN D'ANNÉE
    // saisi sur la fiche, et rien d'autre :
    //   Admis  → passage (ou fin de cycle pour la Terminale, qui n'a pas de
    //            classe suivante : diplômé, on ne le déplace pas) ;
    //   Refusé → maintien dans la classe ;
    //   vide   → résultats pas encore publiés : on ne touche à rien et on
    //            le compte à part, pour que la direction sache quoi finir.
    if (estClasseExamen(classeActuelle, systeme)) {
      const resultat = e.resultatExamen || "";
      const suivanteExamen = classeSuivante(classeActuelle, systeme);
      if (resultat === "Admis") {
        if (suivanteExamen) {
          acc.updates.push({ collection: sec.eleves, id: e._id, classe: suivanteExamen, ...archiverClasse(e) });
          acc.promus++;
          acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, moy: null, statut: "promu", nouvClasse: suivanteExamen, motif: "Examen : admis" });
        } else {
          acc.diplomes++;
        }
      } else if (resultat === "Refusé") {
        acc.redoublants++;
        acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, moy: null, statut: "redoublant", nouvClasse: classeActuelle, motif: "Examen : refusé" });
      } else {
        acc.examens++;
        acc.classesExamen.add(classeActuelle);
      }
      continue;
    }
    const suivante = classeSuivante(classeActuelle, systeme);
    if (suivante === null) { acc.terminalistes++; continue; }
    if (suivante === undefined) {
      acc.inconnus++;
      if (classeActuelle) acc.classesInconnues.add(classeActuelle);
      continue;
    }
    const notesEleve = notesDeLEleve(data.notes, e._id);
    // Mêmes matières/coefficients que les bulletins (matieresForClasse).
    // Fallback : matières déduites des notes de l'élève (coef 1) si l'école
    // n'a pas configuré ses matières pour cette section.
    const matieresClasse = matieresForClasse(data.matieres, classeActuelle);
    const matieresEleve = matieresClasse.length > 0
      ? matieresClasse
      : [...new Set(notesEleve.map((note) => note.matiere).filter(Boolean))].map((nom) => ({ nom }));
    const moy = calcMoyenneAnnuelle(schoolInfo, notesEleve, classeActuelle, matieresEleve);
    let decision;
    if (moy === null) {
      acc.sansNotes++;
      decision = sansNotesBehavior;
    } else {
      decision = moy >= sec.seuil ? "promouvoir" : "redoubler";
    }
    if (decision === "promouvoir") {
      acc.updates.push({ collection: sec.eleves, id: e._id, classe: suivante, ...archiverClasse(e) });
      acc.promus++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: suivante, moy, statut: "promu" });
    } else {
      acc.redoublants++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: null, moy, statut: "redoublant" });
    }
  }
}

// Applique les changements de classe (écriture réelle) — Supabase ou Firebase.
// Champs réellement écrits : la nouvelle classe, et l'instantané de l'année
// qui s'achève quand la clôture ne l'a pas déjà figé (cf.
// champsArchivageClasse). Sans lui, promouvoir AVANT de clôturer effaçait la
// classe de l'année écoulée : ses notes se retrouvaient moyennées contre le
// programme de la classe suivante, et le tableau d'honneur de cette année-là
// changeait sous les yeux de la direction.
const champsEcrits = (u) => (u.historique
  ? { classe: u.classe, historique: u.historique }
  : { classe: u.classe });

async function appliquerUpdates(schoolId, updates) {
  if (isSupabase) {
    for (let i = 0; i < updates.length; i += SB_PARALLELE) {
      await Promise.all(updates.slice(i, i + SB_PARALLELE).map(
        (u) => modifierChampDoc(schoolId, u.collection, u.id, champsEcrits(u)),
      ));
    }
    return;
  }
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH_MAX)) {
      batch.update(doc(db, "ecoles", schoolId, u.collection, u.id), champsEcrits(u));
    }
    await batch.commit();
  }
}

// Avance les élèves dont la moyenne annuelle atteint le seuil de leur section.
// simulate=true : aucune écriture, renvoie seulement le bilan prévisionnel —
// à proposer AVANT l'application réelle (l'action est irréversible).
// Renvoie { total, promus, redoublants, terminalistes, inconnus,
//           classesInconnues, sansNotes, simulation, details }.
export async function runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior, simulate = false, annee = "" }) {
  // Année dont on juge les résultats : celle de l'école (partagée entre tous
  // les postes), à défaut celle de l'appareil.
  const anneeQuiSAcheve = annee || schoolInfo?.anneeScolaire || getAnnee();
  // Le préscolaire est une section à part entière depuis 2026-07 : sans lui,
  // les élèves de maternelle restaient dans leur classe d'une année sur l'autre.
  // Il est noté sur 10 comme le primaire (cf. Primaire.jsx) → même seuil.
  const SECTIONS = [
    { eleves: "elevesCollege", notes: "notesCollege", matieres: "classesCollege_matieres", seuil: Number(seuilCollege), maxNote: 20 },
    { eleves: "elevesPrescolaire", notes: "notesPrescolaire", matieres: "classesPrescolaire_matieres", seuil: Number(seuilPrimaire), maxNote: 10 },
    { eleves: "elevesPrimaire", notes: "notesPrimaire", matieres: "classesPrimaire_matieres", seuil: Number(seuilPrimaire), maxNote: 10 },
    { eleves: "elevesLycee", notes: "notesLycee", matieres: "classesLycee_matieres", seuil: Number(seuilCollege), maxNote: 20 },
  ];
  const acc = {
    total: 0, promus: 0, redoublants: 0, terminalistes: 0, sansNotes: 0, inconnus: 0,
    examens: 0, diplomes: 0, classesExamen: new Set(),
    classesInconnues: new Set(), details: [], updates: [],
  };

  for (const sec of SECTIONS) {
    const data = await chargerSection(schoolId, sec, anneeQuiSAcheve);
    analyserSection(schoolInfo, sec, data, sansNotesBehavior, acc, anneeQuiSAcheve);
  }

  if (!simulate && acc.updates.length) await appliquerUpdates(schoolId, acc.updates);

  return {
    total: acc.total, promus: acc.promus, redoublants: acc.redoublants,
    terminalistes: acc.terminalistes, sansNotes: acc.sansNotes, inconnus: acc.inconnus,
    examens: acc.examens, diplomes: acc.diplomes, classesExamen: [...acc.classesExamen],
    classesInconnues: [...acc.classesInconnues],
    simulation: simulate,
    details: acc.details,
  };
}
