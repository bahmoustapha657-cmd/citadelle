// Lecture d'un fichier Excel/CSV d'import élèves + génération du modèle.
// Orchestrateur : délègue la détection des colonnes à ./enrolment-import/
// column-detect et la conversion des lignes à ./enrolment-import/row-parse.
// Extrait de EnrolmentTab.jsx au refactor découpage 2026-05-29.

import { detectColumns } from "./enrolment-import/column-detect";
import { parseEnrolmentRows } from "./enrolment-import/row-parse";

const loadXLSX = () => import("xlsx");

// Lit un fichier Excel/CSV et renvoie soit { error } soit { preview }.
// preview = { lignes, valides, mapping, nbAvert }.
export async function parseEnrolmentFile(arrayBuffer, { classeDefautImport, ordreNomImport, tousElevesScolarite }) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(arrayBuffer, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  if (allRows.length < 2) return { error: "Fichier vide ou sans données" };

  const { headers, headerRowIdx, cols, champLabels } = detectColumns(allRows);

  const lignes = parseEnrolmentRows({
    allRows, headerRowIdx, cols, classeDefautImport, ordreNomImport, tousElevesScolarite,
  });

  const mapping = Object.entries(cols).map(([k, idx]) => ({ champ: champLabels[k], colonne: idx >= 0 ? headers[idx] : null, idx }));

  return {
    preview: {
      lignes,
      valides: lignes.filter(l => !l.erreurs.length),
      mapping,
      nbAvert: lignes.filter(l => !l.erreurs.length && l.avertissements?.length).length,
    },
  };
}

// Génère le classeur Excel modèle (gabarit de saisie). `t` = fonction i18n.
export async function buildEnrolmentTemplate(t) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [t("reports.excel.template.n"), t("reports.excel.template.matricule"), t("reports.excel.template.student"), t("reports.excel.template.sex"), t("reports.excel.template.dateOfBirth"), t("reports.excel.template.birthPlace"), t("reports.excel.template.father"), t("reports.excel.template.mother"), t("reports.excel.template.phone")],
    [1, "", "BAH Aminata", "F", "2012-03-15", "Conakry", "Mamadou Bah", "Fatoumata Diallo", "622000001"],
    [2, "", "DIALLO Ibrahima Sékou", "M", "2013-07-22", "Kindia", "Boubacar Diallo", "Mariama Bah", "628000002"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, t("reports.excel.template.sheetStudents"));
  return wb;
}
