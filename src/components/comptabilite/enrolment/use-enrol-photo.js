import { useState } from "react";
import { initMens } from "../../../constants";
import { normaliserDepart } from "../../../depart-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";

// Enregistrement d'un élève en inscription, photo comprise (téléversée au
// moment de l'enregistrement). La prise de vue et l'import vivent dans
// PhotoEleveChamp.
export function useEnrolPhoto({
  modal, setModal, form, niveauEnrol,
  schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
}) {
  const [uploadEnCours, setUploadEnCours] = useState(false);

  const enregistrer = async () => {
    // Départ : date obligatoire pour une sortie (c'est elle qui arrête les
    // mensualités), champs de départ vidés au retour à « Actif » ou
    // « Inactif » — masqués dans le formulaire, ils restaient enregistrés.
    const { fiche, erreur } = normaliserDepart(form);
    if (erreur) { toast(erreur, "warning"); return; }
    setUploadEnCours(true);
    try {
      let photoUrl = fiche.photo || "";
      if (photoUrl.startsWith("data:")) {
        photoUrl = await uploadPhotoEleve(photoUrl, schoolId);
      }
      const r = { ...fiche, photo: photoUrl, mens: fiche.mens || initMens() };
      const doublon = findEnrollmentDuplicate(r, tousElevesScolarite, {
        excludeId: modal === "edit_enrol" ? r._id : null,
      });
      if (doublon) {
        toast(getEnrollmentDuplicateMessage(doublon, r), "warning");
        return;
      }
      if (modal === "add_enrol") {
        await ajEnrol(r);
        await ensureClasse(r.classe, niveauEnrol);
      } else {
        await modEnrol(r);
      }
      setModal(null);
    } catch (e) {
      toast("Erreur upload photo : " + e.message, "error");
    } finally {
      setUploadEnCours(false);
    }
  };

  return { uploadEnCours, enregistrer };
}
