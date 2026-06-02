// Noms des enseignants déjà occupés sur ce créneau (même jour/heure).
export function getOccupiedTeachers(emplois, edtCellule) {
  return emplois
    .filter(x => x.jour === edtCellule.jour && x.heureDebut === edtCellule.heureDebut
      && (!edtCellule.existing || x._id !== edtCellule.existing._id) && x.enseignant)
    .map(x => x.enseignant);
}

// Construit l'objet créneau à persister depuis le formulaire.
export function buildCreneauData(form, classeEdtActuelle, edtCellule) {
  const typeCreneaux = form.type || "cours";
  return {
    classe: form.classe || classeEdtActuelle,
    jour: edtCellule.jour,
    heureDebut: form.heureDebut || edtCellule.heureDebut,
    heureFin: form.heureFin || edtCellule.heureFin,
    matiere: form.matiere,
    enseignant: form.enseignant || "",
    salle: form.salle || "",
    type: typeCreneaux,
    primeRevision: typeCreneaux === "revision" ? Number(form.primeRevision || 0) : null,
  };
}
