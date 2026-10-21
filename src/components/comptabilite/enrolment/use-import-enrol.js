import { useState } from "react";
import { initMens, genererMatricule } from "../../../constants";
import { telechargerExcel } from "../../../reports";
import { findEnrollmentDuplicate } from "../../../enrollment-utils";
import { parseEnrolmentFile, buildEnrolmentTemplate } from "../enrolment-import";

// Logique de l'import d'élèves depuis Excel : options de parsing, aperçu du
// fichier, téléchargement du modèle et import effectif (dé-doublonnage,
// génération de matricules, création des classes manquantes).
export function useImportEnrol({
  setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
  ajoutParNiveau, ensureClasse, elevesEnrol, t,
}) {
  const [importEnrolPreview, setImportEnrolPreview] = useState(null);
  const [importEnrolEnCours, setImportEnrolEnCours] = useState(false);
  const [classeDefautImport, setClasseDefautImport] = useState("");
  const [ordreNomImport, setOrdreNomImport] = useState("auto");

  const fermer = () => { setModal(null); setImportEnrolPreview(null); };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const ab = await file.arrayBuffer();
    const { error, preview } = await parseEnrolmentFile(ab, { classeDefautImport, ordreNomImport, tousElevesScolarite });
    if (error) { toast(error, "warning"); e.target.value = ""; return; }
    setImportEnrolPreview(preview);
    e.target.value = "";
  };

  const telechargerTemplate = async () => {
    const wb = await buildEnrolmentTemplate(t);
    await telechargerExcel(wb, t("reports.excel.template.filename"));
  };

  const lancerImport = async () => {
    setImportEnrolEnCours(true);
    let count = 0;
    const existants = tousElevesScolarite;
    const matsGeneres = [];
    const classesImportCreees = new Set();
    const ajFn = ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
    const lotImporte = [];
    for (const l of importEnrolPreview.valides) {
      const doublon = findEnrollmentDuplicate(l, [...existants, ...lotImporte]);
      if (doublon) continue;
      const mat = genererMatricule([...elevesEnrol, ...matsGeneres], niveauEnrol, schoolInfo);
      const eleveAImporter = {
        nom: l.nom, prenom: l.prenom, classe: l.classe, sexe: l.sexe,
        dateNaissance: l.dateNaissance, lieuNaissance: l.lieuNaissance, ien: l.ien,
        tuteur: l.tuteur, contactTuteur: l.contactTuteur,
        filiation: l.filiation, domicile: l.domicile,
        typeInscription: l.typeInscription,
        matricule: mat, statut: "Actif", mens: initMens(),
      };
      matsGeneres.push({ matricule: mat });
      await ajFn(eleveAImporter);
      lotImporte.push(eleveAImporter);
      await ensureClasse(l.classe, niveauEnrol, classesImportCreees);
      count++;
    }
    setImportEnrolEnCours(false);
    setModal(null);
    setImportEnrolPreview(null);
    toast(`${count} élève(s) importé(s) avec succès`, "success");
  };

  return {
    importEnrolPreview, importEnrolEnCours, classeDefautImport, setClasseDefautImport,
    ordreNomImport, setOrdreNomImport, fermer, handleFile, telechargerTemplate, lancerImport,
  };
}
