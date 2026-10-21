import { useContext, useRef, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { getSectionLabel, initMens } from "../../../constants";
import { champsRetour, normaliserDepart } from "../../../depart-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import {
  MESSAGE_FILIATION_OBLIGATOIRE, filiationManquante, findEnrollmentDuplicate, getEnrollmentDuplicateMessage,
} from "../../../enrollment-utils";
import { deplacerEleve, erreurClasseSection } from "./enrol-section";
import { champsFicheModifiee } from "./fiche-modifiable";

// Enregistrement d'un élève en inscription, photo comprise (téléversée au
// moment de l'enregistrement). La prise de vue et l'import vivent dans
// PhotoEleveChamp.
// `section` : celle choisie dans le formulaire ; `sectionOrigine` : celle où
// la fiche est rangée (la liste affichée). À la modification, si elles
// diffèrent, l'élève change de section avant d'être enregistré.
export function useEnrolPhoto({
  modal, setModal, form, section, sectionOrigine, classeOrigine, retour = null,
  schoolId, toast, tousElevesScolarite, ajoutParNiveau = {}, modChampParNiveau = {}, rechargerParNiveau = {}, ensureClasse,
}) {
  const { logAction } = useContext(SchoolContext);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  // Double clic sur « Enregistrer » : le second appel partait avant que le
  // bouton ne soit désactivé, et l’élève était inscrit deux fois.
  const verrou = useRef(false);

  const enregistrer = async () => {
    if (verrou.current) return;
    // Départ : date obligatoire pour une sortie (c'est elle qui arrête les
    // mensualités), champs de départ vidés au retour à « Actif » ou
    // « Inactif » — masqués dans le formulaire, ils restaient enregistrés.
    const normalisee = normaliserDepart(form);
    if (normalisee.erreur) { toast(normalisee.erreur, "warning"); return; }
    // Filiation exigée à l'inscription seulement : des fiches anciennes sans
    // filiation restent modifiables.
    if (modal === "add_enrol" && filiationManquante(form)) { toast(MESSAGE_FILIATION_OBLIGATOIRE, "warning"); return; }
    let fiche = normalisee.fiche;
    // Retour d'un élève parti (statut repassé à « Actif ») : les mois
    // d'absence sont dus ou non, au choix de la direction (champsRetour).
    if (retour) {
      if (retour.absenceDue === null) { toast("Indiquez si les mois d'absence sont dus.", "warning"); return; }
      const { champs, erreur } = champsRetour(
        { dateDepart: retour.dateDepart, interruptions: form.interruptions },
        { dateRetour: retour.dateRetour, absenceDue: retour.absenceDue },
      );
      if (erreur) { toast(erreur, "warning"); return; }
      fiche = { ...fiche, ...champs, statut: fiche.statut };
    }
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
    verrou.current = true;
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
        // Fusion champ par champ, sans les paiements (cf. fiche-modifiable).
        await modChampParNiveau[section](r._id, champsFicheModifiee(r));
        if (retour) {
          logAction?.("Réintégration d'un élève",
            `${r.nom} ${r.prenom} (${r.classe}) — parti le ${retour.dateDepart || "?"}, revenu le ${retour.dateRetour || "?"} ; `
            + (retour.absenceDue ? "mois d'absence dus" : "mois d'absence non dus"));
        }
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
      verrou.current = false;
    }
  };

  return { uploadEnCours, enregistrer };
}
