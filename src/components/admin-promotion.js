// Promotion de fin d'année : classe suivante dérivée dynamiquement
// (src/promotion-utils.js) + exécution en batch avec mode simulation.
// Extrait de AdminPanel.jsx au refactor découpage 2026-05-29.

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebaseDb";
import { getSectionForClasse } from "../constants";
import { getAnnualAverage, getGeneralAverage } from "../note-utils";
import { getPeriodesForSection } from "../period-utils";
import { classeSuivante } from "../promotion-utils";

// Limite Firestore : 500 opérations par batch (marge de sécurité à 450).
const BATCH_MAX = 450;

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

// Avance les élèves dont la moyenne annuelle atteint le seuil de leur section.
// simulate=true : aucune écriture, renvoie seulement le bilan prévisionnel —
// à proposer AVANT l'application réelle (l'action est irréversible).
// Renvoie { total, promus, redoublants, terminalistes, inconnus,
//           classesInconnues, sansNotes, simulation, details }.
export async function runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior, simulate = false }) {
  const SECTIONS = [
    { eleves: "elevesCollege", notes: "notesCollege", seuil: Number(seuilCollege), maxNote: 20 },
    { eleves: "elevesPrimaire", notes: "notesPrimaire", seuil: Number(seuilPrimaire), maxNote: 10 },
    { eleves: "elevesLycee", notes: "notesLycee", seuil: Number(seuilCollege), maxNote: 20 },
  ];
  let total = 0, promus = 0, redoublants = 0, terminalistes = 0, sansNotes = 0, inconnus = 0;
  const classesInconnues = new Set();
  const details = [];
  const updates = []; // { ref, classe } à écrire en batch après l'analyse

  for (const sec of SECTIONS) {
    const [snapEleves, snapNotes] = await Promise.all([
      getDocs(collection(db, "ecoles", schoolId, sec.eleves)),
      getDocs(collection(db, "ecoles", schoolId, sec.notes)),
    ]);
    const notesToutes = snapNotes.docs.map(d => ({ ...d.data(), _id: d.id }));
    for (const d of snapEleves.docs) {
      const e = d.data();
      if (e.statut !== "Actif") continue;
      total++;
      const classeActuelle = e.classe || "";
      const suivante = classeSuivante(classeActuelle);
      if (suivante === null) { terminalistes++; continue; }
      if (suivante === undefined) {
        inconnus++;
        if (classeActuelle) classesInconnues.add(classeActuelle);
        continue;
      }
      const notesEleve = notesToutes.filter(n => n.eleveId === d.id);
      const matieresEleve = [...new Set(notesEleve.map((note) => note.matiere).filter(Boolean))].map((nom) => ({ nom }));
      const moy = calcMoyenneAnnuelle(schoolInfo, notesEleve, classeActuelle, matieresEleve);
      let decision;
      if (moy === null) {
        sansNotes++;
        decision = sansNotesBehavior;
      } else {
        decision = moy >= sec.seuil ? "promouvoir" : "redoubler";
      }
      if (decision === "promouvoir") {
        updates.push({ ref: doc(db, "ecoles", schoolId, sec.eleves, d.id), classe: suivante });
        promus++;
        details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: suivante, moy, statut: "promu" });
      } else {
        redoublants++;
        details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: null, moy, statut: "redoublant" });
      }
    }
  }

  if (!simulate) {
    for (let i = 0; i < updates.length; i += BATCH_MAX) {
      const batch = writeBatch(db);
      for (const u of updates.slice(i, i + BATCH_MAX)) {
        batch.update(u.ref, { classe: u.classe });
      }
      await batch.commit();
    }
  }

  return {
    total, promus, redoublants, terminalistes, sansNotes, inconnus,
    classesInconnues: [...classesInconnues],
    simulation: simulate,
    details,
  };
}
