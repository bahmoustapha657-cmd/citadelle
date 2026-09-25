import { useState } from "react";
import { initMens } from "../../../constants";
import { normaliserDepart } from "../../../depart-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";

// Logique photo + enregistrement d'un élève en inscription.
export function useEnrolPhoto({
  modal, setModal, form, setForm, niveauEnrol,
  schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
}) {
  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  const handlePhotoFichier = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Image trop grande (max 2 Mo).", "warning"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((p) => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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

  return { cameraOuverte, setCameraOuverte, uploadEnCours, handlePhotoFichier, enregistrer };
}
