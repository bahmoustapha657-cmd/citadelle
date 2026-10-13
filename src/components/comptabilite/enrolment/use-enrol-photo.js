import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { getSectionLabel, initMens } from "../../../constants";
import { normaliserDepart } from "../../../depart-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";
import { deplacerEleve, erreurClasseSection } from "./enrol-section";

// Enregistrement d'un élève en inscription, photo comprise (téléversée au
// moment de l'enregistrement). La prise de vue et l'import vivent dans
// PhotoEleveChamp.
// `section` : celle choisie dans le formulaire ; `sectionOrigine` : celle où
// la fiche est rangée (la liste affichée). À la modification, si elles
// diffèrent, l'élève change de section avant d'être enregistré.
export function useEnrolPhoto({
  modal, setModal, form, section, sectionOrigine, classeOrigine,
  schoolId, toast, tousElevesScolarite, ajoutParNiveau = {}, modifParNiveau = {}, rechargerParNiveau = {}, ensureClasse,
}) {
  const { logAction } = useContext(SchoolContext);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  const enregistrer = async () => {
    // Départ : date obligatoire pour une sortie (c'est elle qui arrête les
    // mensualités), champs de départ vidés au retour à « Actif » ou
    // « Inactif » — masqués dans le formulaire, ils restaient enregistrés.
    const { fiche, erreur } = normaliserDepart(form);
    if (erreur) { toast(erreur, "warning"); return; }
    const deplacement = modal === "edit_enrol" && section !== sectionOrigine;
    // Contrôlé au changement de section seulement : une fiche ancienne à la
    // classe saisie librement doit rester modifiable telle quelle.
    const erreurClasse = deplacement && erreurClasseSection(fiche.classe, section);
    if (erreurClasse) { toast(erreurClasse, "warning"); return; }
    if (deplacement && !confirm(
      `Faire passer ${fiche.nom || ""} ${fiche.prenom || ""} du ${getSectionLabel(sectionOrigine)} au `
      + `${getSectionLabel(section)}, en « ${fiche.classe} » ?\n\n`
      + "Sa fiche, son matricule et ses paiements le suivent ; ses notes restent dans l'ancienne section.",
    )) return;
    setUploadEnCours(true);
    try {
      let photoUrl = fiche.photo || "";
      if (photoUrl.startsWith("data:")) {
        photoUrl = await uploadPhotoEleve(photoUrl, schoolId);
      }
      const r = { ...fiche, niveau: section, photo: photoUrl, mens: fiche.mens || initMens() };
      const doublon = findEnrollmentDuplicate(r, tousElevesScolarite, {
        excludeId: modal === "edit_enrol" ? r._id : null,
      });
      if (doublon) {
        toast(getEnrollmentDuplicateMessage(doublon, r), "warning");
        return;
      }
      if (modal === "add_enrol") {
        await ajoutParNiveau[section](r);
        await ensureClasse(r.classe, section);
      } else {
        if (deplacement) {
          // D'abord le déplacement (classe + section ensemble) : s'il échoue,
          // rien n'a changé ; ensuite les autres champs, dans la section d'arrivée.
          await deplacerEleve(schoolId, r._id, { depart: sectionOrigine, arrivee: section, classe: r.classe });
          logAction?.(
            `Passage ${getSectionLabel(sectionOrigine)} → ${getSectionLabel(section)}`,
            `${r.nom} ${r.prenom} (${classeOrigine || "?"} → ${r.classe})`,
          );
          await ensureClasse(r.classe, section);
        }
        await modifParNiveau[section](r);
        if (deplacement) {
          await rechargerParNiveau[sectionOrigine]?.();
          toast(`${r.nom} ${r.prenom} est passé(e) au ${getSectionLabel(section)} en ${r.classe}`, "success");
        }
      }
      setModal(null);
    } catch (e) {
      toast("Erreur à l'enregistrement : " + e.message, "error");
    } finally {
      setUploadEnCours(false);
    }
  };

  return { uploadEnCours, enregistrer };
}
