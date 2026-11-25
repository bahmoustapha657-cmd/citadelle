// Constructeurs purs des formulaires (notes / incidents) et formatage de
// l'horaire d'un créneau d'emploi du temps du portail enseignant.
import { moisDeNote } from "../../note-utils";

export const formatEmploiHeure = (emploi) => {
  if (emploi.heure) {
    return emploi.heure;
  }
  if (emploi.heureDebut || emploi.heureFin) {
    return [emploi.heureDebut || "", emploi.heureFin || ""].filter(Boolean).join(" - ");
  }
  return "-";
};

// `mois` : mois de l'évaluation (oraux et écrits du secondaire) ; vide = la
// modale propose le mois en cours s'il appartient à la période.
export function buildFormNoteCreation({ defaultNoteType, periodeN, matiere = "" }) {
  return { eleveId: "", type: defaultNoteType, periode: periodeN, mois: "", matiere, note: "" };
}

// La matière de la note est reprise : sans elle, l'enregistrement d'une
// note modifiée lui en donnait une autre (celle du profil, ou aucune).
// Le mois aussi : celui enregistré, sinon celui tiré de la date de saisie
// (anciennes notes).
export function buildFormNoteEdition(note, { defaultNoteType, periodeN, moisAnnee }) {
  const mois = note.mois || moisDeNote(note, moisAnnee?.length ? moisAnnee : undefined) || "";
  return {
    noteId: note._id,
    eleveId: note.eleveId || "",
    type: note.type || defaultNoteType,
    periode: note.periode || periodeN,
    mois,
    matiere: note.matiere || "",
    note: note.note ?? "",
  };
}

export function buildFormIncidentCreation(eleve) {
  return {
    eleveId: eleve._id,
    eleveNom: `${eleve.nom} ${eleve.prenom}`,
    classe: eleve.classe || "",
    type: "Absence",
    date: new Date().toISOString().slice(0, 10),
    justifie: "Non",
    motif: "",
  };
}

export function buildFormIncidentEdition(inc) {
  return {
    incidentId: inc._id,
    eleveId: inc.eleveId,
    eleveNom: inc.eleveNom,
    classe: inc.classe || "",
    type: inc.type || "Absence",
    date: inc.date || new Date().toISOString().slice(0, 10),
    justifie: inc.justifie || "Non",
    motif: inc.motif || "",
  };
}
