// Enregistrement des fiches de paie et du personnel avec garde anti-doublon.
// Renvoient true si l'écriture a eu lieu, false si bloquée par un doublon.
import { findSalaryDuplicate } from "../../salary-utils";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../../staff-utils";

// Garde anti-doublon (nom + mois + section) — évite 2 bulletins pour le même
// agent le même mois via le formulaire manuel.
export async function saveSalaireAction(r, { isEdit, salaires, toast, modS, ajS, anneeRecord }) {
  const doublon = findSalaryDuplicate(r, salaires, { excludeId: isEdit ? r._id : null });
  if (doublon) {
    toast(`Une fiche existe déjà pour ${doublon.nom} en ${doublon.mois} (${doublon.section}).`, "warning");
    return false;
  }
  if (isEdit) await modS(r);
  else await ajS({ ...r, annee: anneeRecord });
  return true;
}

export async function savePersonnelAction(r, { isEdit, personnel, toast, ajPers, modPers }) {
  const doublon = findStaffDuplicate(r, personnel, { excludeId: isEdit ? r._id : null });
  if (doublon) {
    toast(getStaffDuplicateMessage(doublon, { label: "ce membre du personnel" }), "warning");
    return false;
  }
  if (!isEdit) await ajPers(r);
  else await modPers(r);
  return true;
}
