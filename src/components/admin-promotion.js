// Promotion de fin d'année : mapping classe→classe suivante + exécution.
// Extrait de AdminPanel.jsx au refactor découpage 2026-05-29.

import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebaseDb";
import { CLASSES_PRIMAIRE } from "../constants";
import { getAnnualAverage, getGeneralAverage } from "../note-utils";
import { getPeriodesForSection } from "../period-utils";

const CLASSES_PRIMAIRE_SET = new Set(CLASSES_PRIMAIRE);

// Mapping promotion classes : quelle classe vient apres quelle classe
export const PROMOTION_SUIVANTE = {
  // Primaire (classique)
  "Maternelle A":"1ere Annee A","Maternelle B":"1ere Annee B",
  "1ere Annee A":"2eme Annee A","1ere Annee B":"2eme Annee B",
  "2eme Annee A":"3eme Annee A","2eme Annee B":"3eme Annee B",
  "3eme Annee A":"4eme Annee A","3eme Annee B":"4eme Annee B",
  "4eme Annee A":"5eme Annee A","4eme Annee B":"5eme Annee B",
  "5eme Annee A":"6eme Annee A","5eme Annee B":"6eme Annee B",
  // College
  "6eme A":"5eme A","6eme B":"5eme B","6eme C":"5eme C",
  "5eme A":"4eme A","5eme B":"4eme B","5eme C":"4eme C",
  "4eme A":"3eme A","4eme B":"3eme B","4eme C":"3eme C",
  // Lycee
  "Seconde A":"Premiere A","Seconde B":"Premiere B","Seconde C":"Premiere C",
  "Premiere A":"Terminale A","Premiere B":"Terminale B","Premiere C":"Terminale C",
};

// Calcule la moyenne annuelle d'un eleve a partir de ses notes (toutes periodes
// de SA section : primaire = trimestre, secondaire = peut être semestre).
// Diviseur FIXE au nombre total de périodes ((T1+T2+T3)/3 ou (S1+S2)/2),
// les périodes vides sont traitées comme 0 (cf. getAnnualAverage).
function calcMoyenneAnnuelle(schoolInfo, notes, classe, matieres) {
  if (!notes || notes.length === 0) return null;
  const sectionPeriode = CLASSES_PRIMAIRE_SET.has(classe) ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  const moyennes = periodes.map((periode) =>
    getGeneralAverage(notes.filter((note) => note.periode === periode), matieres, classe),
  );
  return getAnnualAverage(moyennes);
}

// Avance les élèves dont la moyenne annuelle atteint le seuil de leur section.
// Écrit directement la nouvelle classe dans Firestore. Renvoie le bilan.
export async function runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior }) {
  const SECTIONS = [
    { eleves: "elevesCollege", notes: "notesCollege", seuil: Number(seuilCollege), maxNote: 20 },
    { eleves: "elevesPrimaire", notes: "notesPrimaire", seuil: Number(seuilPrimaire), maxNote: 10 },
    { eleves: "elevesLycee", notes: "notesLycee", seuil: Number(seuilCollege), maxNote: 20 },
  ];
  let total = 0, promus = 0, redoublants = 0, terminalistes = 0, sansNotes = 0;
  const details = [];
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
      const classeSuivante = PROMOTION_SUIVANTE[classeActuelle];
      if (!classeSuivante) { terminalistes++; continue; }
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
        await updateDoc(doc(db, "ecoles", schoolId, sec.eleves, d.id), { classe: classeSuivante });
        promus++;
        details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: classeSuivante, moy, statut: "promu" });
      } else {
        redoublants++;
        details.push({ nom: `${e.nom} ${e.prenom}`, classe: classeActuelle, nouvClasse: null, moy, statut: "redoublant" });
      }
    }
  }
  return { total, promus, redoublants, terminalistes, sansNotes, details };
}
