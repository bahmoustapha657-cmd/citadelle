// ══════════════════════════════════════════════════════════════
//  Exports Excel
// ══════════════════════════════════════════════════════════════
// telechargerExcel : helper bas-niveau (workbook → .xlsx + download)
// exportExcel : raccourci feuille unique (colonnes + lignes brutes)

import { loadXLSX, printLang, tr } from "./print-helpers.js";

export const telechargerExcel = async (wb, nomFichier) => {
  try {
    const XLSX = await loadXLSX();
    const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const blob = new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
  } catch(err) {
    alert(tr("reports.excel.errorGenerate") + " " + err.message);
  }
};

export const exportExcel = async (nomFichier, colonnes, lignes) => {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.aoa_to_sheet([colonnes, ...lignes]);
  ws["!cols"] = colonnes.map(()=>({wch:22}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tr("reports.excel.sheetName"));
  await telechargerExcel(wb, `${nomFichier}_${new Date().toLocaleDateString(printLang()==="fr"?"fr-FR":printLang()==="ar"?"ar":"en-US").replace(/\//g,"-")}.xlsx`);
};
