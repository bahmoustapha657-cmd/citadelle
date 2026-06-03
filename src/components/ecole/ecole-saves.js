// Handlers de sauvegarde du module École : classe, enseignant et appréciation.
// Reçoivent les actions Firestore et l'état nécessaires en paramètres.
import { findStaffDuplicate, getStaffDuplicateMessage } from "../../staff-utils";

// Crée/modifie une classe ; propage le renommage aux élèves concernés.
export function saveClasseAction({ form, modal, classes, eleves, ajC, modC, modE }) {
  const row = { ...form, effectif: Number(form.effectif || 0) };
  if (modal === "add_c") { ajC(row); return; }
  const ancienNom = classes.find((c) => c._id === form._id)?.nom;
  modC(row);
  if (ancienNom && ancienNom !== form.nom)
    eleves.filter((e) => e.classe === ancienNom).forEach((e) => modE({ ...e, classe: form.nom }));
}

// Crée/modifie un enseignant (garde anti-doublon) ; tient à jour la classe
// titulaire associée. Renvoie false si bloqué par un doublon.
export async function saveEnseignantAction({ form, modal, ens, classes, toast, ajEns, modEns, ajC, modC }) {
  const row = { ...form };
  const doublon = findStaffDuplicate(row, ens, {
    excludeId: modal === "edit_ens" ? row._id : null,
  });
  if (doublon) {
    toast(getStaffDuplicateMessage(doublon, { label: "cet enseignant" }), "warning");
    return false;
  }

  if (modal === "add_ens") await ajEns(row);
  else await modEns(row);

  if (row.classeTitle) {
    const nomEns = `${row.prenom || ""} ${row.nom || ""}`.trim();
    const existante = classes.find((c) => c.nom === row.classeTitle);
    if (!existante) {
      await ajC({ nom: row.classeTitle, effectif: 0, enseignant: nomEns });
    } else if (nomEns && existante.enseignant !== nomEns) {
      await modC({ ...existante, enseignant: nomEns });
    }
  }
  return true;
}

// Enregistre (ou met à jour) l'appréciation d'un élève pour une période.
export async function saveAppreciationAction(eleveId, periode, texte, { getAppreciation, ajApp, modApp }) {
  const existant = getAppreciation(eleveId, periode);
  const data = { eleveId, periode, texte: String(texte || "").trim(), updatedAt: Date.now() };
  if (existant) await modApp({ ...existant, ...data });
  else await ajApp(data);
}
