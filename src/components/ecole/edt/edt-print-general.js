// Génération HTML imprimable de l'emploi du temps général (toutes classes).
// Extraite de edt-print.js (découpage par ordre de grandeur).

import { enteteDoc } from "../../../reports";
import { JOURS, COULEURS, SOUS_LABELS, affNom, nbSousLignes, totalLignesClasse } from "./edt-utils";

function getEdtGeneralHTML({ emplois, classesTriees, TRANCHES, nbTranches, schoolInfo, findEns }) {
  const allMat = [...new Set(emplois.map((e) => e.matiere).filter(Boolean))];
  const mc = {}; allMat.forEach((m, i) => { mc[m] = COULEURS[i % COULEURS.length]; });
  const ths = JOURS.map((j) => "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;text-align:center;min-width:90px'>" + j + "</th>").join("");
  const subLabelStyle = "background:#f8fafc;color:#94a3b8;font-size:9px;padding:2px 6px;text-align:right;border:1px solid #e8edf2;white-space:nowrap;font-style:italic";
  const hrStyle = "background:#f0f4f8;font-weight:800;font-size:11px;color:#0A1628;padding:5px 7px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap;vertical-align:middle";
  const clsStyle = "background:#0A1628;color:#00C48C;font-weight:800;font-size:12px;text-align:center;padding:6px 8px;border:2px solid #0A1628;vertical-align:middle;writing-mode:horizontal-tb";
  const legendStyle = "display:inline-flex;align-items:center;gap:8px;margin:0 10px 8px 0;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:700";
  const coursLegend = legendStyle + ";background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe";
  const revisionLegend = legendStyle + ";background:#fff7ed;color:#9a3412;border:1px solid #fdba74";
  let tbody = "";
  classesTriees.forEach((cl) => {
    const total = totalLignesClasse(nbTranches);
    let firstRowOfClass = true;
    for (let ti = 0; ti < nbTranches; ti++) {
      const hd = TRANCHES[ti], hf = TRANCHES[ti + 1];
      const ns = nbSousLignes(ti);
      for (let si = 0; si < ns; si++) {
        const isLastSub = si === ns - 1;
        const isLastSlot = ti === nbTranches - 1;
        const borderB = isLastSub ? (isLastSlot ? "3px solid #0A1628" : "2px solid #b0c4d8") : "1px solid #f0f4f8";
        let row = "<tr>";
        if (firstRowOfClass && si === 0) { row += "<td rowspan='" + total + "' style='" + clsStyle + "'>" + cl.nom + "</td>"; firstRowOfClass = false; }
        if (si === 0) row += "<td rowspan='" + ns + "' style='" + hrStyle + "'>" + hd.slice(0, 5) + "<br>" + hf.slice(0, 5) + "</td>";
        row += "<td style='" + subLabelStyle + ";border-bottom:" + borderB + "'>" + (SOUS_LABELS[si] || "") + "</td>";
        JOURS.forEach((jour) => {
          const cr = emplois.find((e) => e.classe === cl.nom && e.jour === jour && e.heureDebut === hd);
          const isRevision = cr?.type === "revision";
          const bg = cr ? (isRevision ? "#fff7ed" : (mc[cr.matiere] || "#e0ebf8")) : "#fff";
          const color = isRevision ? "#9a3412" : "#0A1628";
          const border = isRevision ? "2px solid #fdba74" : "1px solid #e2e8f0";
          let val = "";
          if (cr) {
            if (si === 0) {
              const badge = isRevision ? "<div style='margin-bottom:3px'><span style=\"display:inline-block;background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:2px 5px;border-radius:999px;letter-spacing:.3px\">RÉVISION</span></div>" : "";
              val = badge + "<b>" + cr.matiere + "</b>";
            }
            else if (si === 1) {
              const ensObj = findEns(cr.enseignant);
              val = affNom(cr.enseignant || "") + (ensObj?.telephone ? "<br><span style='font-size:9px;color:#00876a;font-weight:600'>" + ensObj.telephone + "</span>" : "");
            }
            else if (si === 2) val = cr.salle || "";
          }
          row += "<td style='background:" + bg + ";color:" + color + ";border:" + border + ";border-bottom:" + borderB + ";padding:2px 5px;font-size:10px;text-align:center;vertical-align:middle'>" + val + "</td>";
        });
        row += "</tr>";
        tbody += row;
      }
    }
  });
  return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT Général</title>"
    + "<style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}.no-print{display:none}}"
    + "body{font-family:Arial,sans-serif;padding:10mm;font-size:11px;color:#0A1628;margin:0}"
    + "h2{text-align:center;font-size:14px;margin-bottom:10px}"
    + "table{width:100%;border-collapse:collapse}</style></head><body>"
    + enteteDoc(schoolInfo, schoolInfo.logo)
    + "<h2>Emploi du Temps Général</h2>"
    + "<div style='text-align:center;margin:-2px 0 12px'>"
    + "<span style='" + coursLegend + "'>Cours ordinaires</span>"
    + "<span style='" + revisionLegend + "'>Cours de révision</span>"
    + "</div>"
    + "<div class='no-print' style='text-align:center;margin-bottom:12px'>"
    + "<button onclick='window.print()' style='background:#0A1628;color:#fff;border:none;padding:7px 22px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:700'>🖨️ Imprimer</button></div>"
    + "<table><thead><tr>"
    + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:70px'>Classes</th>"
    + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:60px'>Horaires</th>"
    + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:10px;min-width:50px'></th>"
    + ths
    + "</tr></thead><tbody>" + tbody + "</tbody></table>"
    + "<scri" + "pt>window.onload=()=>window.print();</script></body></html>";
}

export function voirEdtGeneral(opts) {
  const w = window.open("", "_blank");
  w.document.write(getEdtGeneralHTML(opts));
  w.document.close();
}
