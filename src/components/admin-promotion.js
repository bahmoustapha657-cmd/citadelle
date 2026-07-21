// Promotion de fin d'année : classe suivante dérivée dynamiquement
// (src/promotion-utils.js) + exécution en batch avec mode simulation.
// Extrait de AdminPanel.jsx au refactor découpage 2026-05-29.
// Deux backends : Firebase (writeBatch) et Supabase (chargerCollection +
// modifierChampDoc) — même logique de décision, sélectionnée par isSupabase.

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebaseDb";
import { isSupabase } from "../backend";
import { chargerCollection, modifierChampDoc } from "../backend/data-supabase";
import { getSectionForClasse } from "../constants";
import { getAnnualAverage, getGeneralAverage } from "../note-utils";
import { getPeriodesForSection } from "../period-utils";
import { classeSuivante } from "../promotion-utils";
import { matieresForClasse } from "./ecole/ecole-logic";

// Limite Firestore : 500 opérations par batch (marge de sécurité à 450).
const BATCH_MAX = 450;
// Supabase : nb d'updates lancés en parallèle (modifierChampDoc = 1 par appel).
const SB_PARALLELE = 40;

// Calcule la moyenne annuelle d'un eleve a partir de ses notes (toutes periodes
// de SA section : primaire = trimestre, secondaire = peut être semestre).
// Diviseur FIXE au nombre total de périodes ((T1+T2+T3)/3 ou (S1+S2)/2),
// les périodes vides sont traitées comme 0 (cf. getAnnualAverage).
function calcMoyenneAnnuelle(schoolInfo, notes, classe, matieres) {
  if (!notes || notes.length === 0) return null;
  const sectionPeriode = getSectionForClasse(classe) === "primaire" ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  const moyennes = periodes.map((periode) =>
    getGeneralAverage(notes.filter((note) => note.periode === periode), matieres, classe),
  );
  return getAnnualAverage(moyennes);
}

// Charge (eleves, notes, matieres) d'une section — Supabase ou Firebase.
// Renvoie des items uniformes portant `_id` (comme les snapshots Firestore).
async function chargerSection(schoolId, sec) {
  if (isSupabase) {
    const [re, rn, rm] = await Promise.all([
      chargerCollection(schoolId, sec.eleves),
      chargerCollection(schoolId, sec.notes),
      chargerCollection(schoolId, sec.matieres),
    ]);
    return { eleves: re.items || [], notes: rn.items || [], matieres: rm.items || [] };
  }
  const [snapE, snapN, snapM] = await Promise.all([
    getDocs(collection(db, "ecoles", schoolId, sec.eleves)),
    getDocs(collection(db, "ecoles", schoolId, sec.notes)),
    getDocs(collection(db, "ecoles", schoolId, sec.matieres)),
  ]);
  const m = (snap) => snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
  return { eleves: m(snapE), notes: m(snapN), matieres: m(snapM) };
}

// Décisions d'une section (logique pure) → accumule dans `acc`.
function analyserSection(schoolInfo, sec, data, sansNotesBehavior, acc) {
  for (const e of data.eleves) {
    if (e.statut !== "Actif") continue;
    acc.total++;
    const classeActuelle = e.classe || "";
    const suivante = classeSuivante(classeActuelle);
    if (suivante === null) { acc.terminalistes++; continue; }
    if (suivante === undefined) {
      acc.inconnus++;
      if (classeActuelle) acc.classesInconnues.add(classeActuelle);
      continue;
    }
    const notesEleve = data.notes.filter((n) => n.eleveId === e._id);
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
      acc.updates.push({ collection: sec.eleves, id: e._id, classe: suivante });
      acc.promus++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: suivante, moy, statut: "promu" });
    } else {
      acc.redoublants++;
      acc.details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: null, moy, statut: "redoublant" });
    }
  }
}

// Applique les changements de classe (écriture réelle) — Supabase ou Firebase.
async function appliquerUpdates(schoolId, updates) {
  if (isSupabase) {
    for (let i = 0; i < updates.length; i += SB_PARALLELE) {
      await Promise.all(updates.slice(i, i + SB_PARALLELE).map(
        (u) => modifierChampDoc(schoolId, u.collection, u.id, { classe: u.classe }),
      ));
    }
    return;
  }
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH_MAX)) {
      batch.update(doc(db, "ecoles", schoolId, u.collection, u.id), { classe: u.classe });
    }
    await batch.commit();
  }
}

// Avance les élèves dont la moyenne annuelle atteint le seuil de leur section.
// simulate=true : aucune écriture, renvoie seulement le bilan prévisionnel —
// à proposer AVANT l'application réelle (l'action est irréversible).
// Renvoie { total, promus, redoublants, terminalistes, inconnus,
//           classesInconnues, sansNotes, simulation, details }.
export async function runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior, simulate = false }) {
  const SECTIONS = [
    { eleves: "elevesCollege", notes: "notesCollege", matieres: "classesCollege_matieres", seuil: Number(seuilCollege), maxNote: 20 },
    { eleves: "elevesPrimaire", notes: "notesPrimaire", matieres: "classesPrimaire_matieres", seuil: Number(seuilPrimaire), maxNote: 10 },
    { eleves: "elevesLycee", notes: "notesLycee", matieres: "classesLycee_matieres", seuil: Number(seuilCollege), maxNote: 20 },
  ];
  const acc = {
    total: 0, promus: 0, redoublants: 0, terminalistes: 0, sansNotes: 0, inconnus: 0,
    classesInconnues: new Set(), details: [], updates: [],
  };

  for (const sec of SECTIONS) {
    const data = await chargerSection(schoolId, sec);
    analyserSection(schoolInfo, sec, data, sansNotesBehavior, acc);
  }

  if (!simulate && acc.updates.length) await appliquerUpdates(schoolId, acc.updates);

  return {
    total: acc.total, promus: acc.promus, redoublants: acc.redoublants,
    terminalistes: acc.terminalistes, sansNotes: acc.sansNotes, inconnus: acc.inconnus,
    classesInconnues: [...acc.classesInconnues],
    simulation: simulate,
    details: acc.details,
  };
}
