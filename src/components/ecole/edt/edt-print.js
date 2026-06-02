// Génération HTML imprimable de l'emploi du temps d'une classe.
// L'EDT général vit dans edt-print-general.js.

import { enteteDoc } from "../../../reports";
import { JOURS, COULEURS, affNom } from "./edt-utils";

export { voirEdtGeneral } from "./edt-print-general";

export function imprimerEDT({ emploisClasse, TRANCHES, classeEdtActuelle, schoolInfo, findEns }) {
  const allMat = [...new Set(emploisClasse.map((e) => e.matiere).filter(Boolean))];
  const mc = {}; allMat.forEach((m, i) => { mc[m] = COULEURS[i % COULEURS.length]; });
  const getCr = (jour, hd) => emploisClasse.find((e) => e.jour === jour && e.heureDebut === hd);
  const ths = JOURS.map((j) => "<th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;text-align:center;min-width:80px'>" + j + "</th>").join("");
  const rows = TRANCHES.slice(0, -1).map((_, i) => {
    const hd = TRANCHES[i], hf = TRANCHES[i + 1];
    const tds = JOURS.map((jour) => {
      const cr = getCr(jour, hd);
      if (!cr) return "<td style='background:#fafcff;border:1px solid #e2e8f0;padding:6px'></td>";
      const isRev = cr.type === "revision";
      const bg = isRev ? "#fff7ed" : (mc[cr.matiere] || "#e0ebf8");
      const borderColor = isRev ? "#fdba74" : "#e2e8f0";
      const ensObj = findEns(cr.enseignant);
      return "<td style='background:" + bg + ";border:1px solid " + borderColor + ";padding:6px;vertical-align:top'>"
        + (isRev ? "<span style='background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-block;margin-bottom:2px'>RÉV</span><br>" : "")
        + "<b style='font-size:11px;color:" + (isRev ? "#9a3412" : "#1e3a5f") + ";display:block'>" + cr.matiere + "</b>"
        + (cr.enseignant ? "<span style='font-size:10px;color:#475569'>" + affNom(cr.enseignant) + "</span>" : "")
        + (ensObj?.telephone ? "<br><span style='font-size:9px;color:#00876a;font-weight:600'>" + ensObj.telephone + "</span>" : "")
        + (cr.salle ? "<br><span style='font-size:9px;color:#94a3b8'>📍" + cr.salle + "</span>" : "")
        + "</td>";
    }).join("");
    return "<tr><td style='background:#f0f4f8;font-weight:700;font-size:11px;color:#0A1628;padding:7px 10px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap'>" + hd.slice(0, 5) + "–" + hf.slice(0, 5) + "</td>" + tds + "</tr>";
  }).join("");
  const w = window.open("", "_blank");
  w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT " + classeEdtActuelle + "</title>"
    + "<style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}}body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;margin:0}h2{color:#0A1628;text-align:center;margin-bottom:12px}"
    + "table{width:100%;border-collapse:collapse}</style></head><body>"
    + enteteDoc(schoolInfo, schoolInfo.logo)
    + "<h2>Emploi du temps — " + classeEdtActuelle + "</h2>"
    + "<table><thead><tr><th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;width:80px'>Horaire</th>" + ths + "</tr></thead>"
    + "<tbody>" + rows + "</tbody></table>"
    + "<scri" + "pt>window.onload=()=>window.print();</scri" + "pt></body></html>");
  w.document.close();
}
