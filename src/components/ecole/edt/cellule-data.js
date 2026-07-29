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
  const estRecreation = typeCreneaux === "recreation";
  return {
    classe: form.classe || classeEdtActuelle,
    jour: edtCellule.jour,
    heureDebut: form.heureDebut || edtCellule.heureDebut,
    heureFin: form.heureFin || edtCellule.heureFin,
    // Récréation : le libellé est libre et facultatif — on retombe sur
    // « Récréation » plutôt que d'enregistrer une case vide. Ni enseignant
    // ni salle ne sont conservés (ils n'ont pas de sens ici, et un résidu
    // fausserait la détection de conflit d'enseignant).
    matiere: estRecreation ? (form.matiere || "").trim() || "Récréation" : form.matiere,
    enseignant: estRecreation ? "" : (form.enseignant || ""),
    salle: estRecreation ? "" : (form.salle || ""),
    type: typeCreneaux,
    primeRevision: typeCreneaux === "revision" ? Number(form.primeRevision || 0) : null,
  };
}
