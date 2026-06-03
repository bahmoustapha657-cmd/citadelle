// Constructeurs purs des formulaires (notes / incidents) et formatage de
// l'horaire d'un créneau d'emploi du temps du portail enseignant.

export const formatEmploiHeure = (emploi) => {
  if (emploi.heure) {
    return emploi.heure;
  }
  if (emploi.heureDebut || emploi.heureFin) {
    return [emploi.heureDebut || "", emploi.heureFin || ""].filter(Boolean).join(" - ");
  }
  return "-";
};

export function buildFormNoteCreation({ defaultNoteType, periodeN }) {
  return { eleveId: "", type: defaultNoteType, periode: periodeN, note: "" };
}

export function buildFormNoteEdition(note, { defaultNoteType, periodeN }) {
  return {
    noteId: note._id,
    eleveId: note.eleveId || "",
    type: note.type || defaultNoteType,
    periode: note.periode || periodeN,
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
