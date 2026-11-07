// Enregistrement des fiches de paie et du personnel avec garde anti-doublon.
// Renvoient true si l'écriture a eu lieu, false si bloquée par un doublon.
import { findSalaryDuplicate } from "../../salary-utils";
import { findStaffDuplicate } from "../../staff-utils";
import i18n from "../../i18n";
import { libelleMois, libelleSectionPaie } from "../../i18n/libelles";

// Garde anti-doublon (nom + mois + section) — évite 2 bulletins pour le même
// agent le même mois via le formulaire manuel.
export async function saveSalaireAction(r, { isEdit, salaires, toast, modS, ajS, anneeRecord }) {
  const doublon = findSalaryDuplicate(r, salaires, { excludeId: isEdit ? r._id : null });
  if (doublon) {
    toast(i18n.t("accounting.sal.duplicate", { name: doublon.nom, month: libelleMois(doublon.mois), section: libelleSectionPaie(doublon.section) }), "warning");
    return false;
  }
  if (isEdit) await modS(r);
  else await ajS({ ...r, annee: anneeRecord });
  return true;
}

export async function savePersonnelAction(r, { isEdit, personnel, toast, ajPers, modPers }) {
  const doublon = findStaffDuplicate(r, personnel, { excludeId: isEdit ? r._id : null });
  if (doublon) {
    toast(i18n.t(doublon.type === "phone" ? "accounting.staff.dupPhone" : "accounting.staff.dupIdentity"), "warning");
    return false;
  }
  if (!isEdit) await ajPers(r);
  else await modPers(r);
  return true;
}
