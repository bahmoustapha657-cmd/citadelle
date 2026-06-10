// ══════════════════════════════════════════════════════════════
//  Bulletins — gabarit HTML d'une page (bulletin individuel) + styles
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileVide,
  mapNiveauToCycle,
} from "../../legal-utils.js";
import {
  PRINT_RESET,
  WATERMARK_CSS,
  enteteDoc,
  tr,
} from "../print-helpers.js";
import { getInitiales, ordinalFr } from "./bulletin-format.js";
import { computeBulletinModel } from "./bulletin-page-data.js";
import { buildLignesRows } from "./bulletin-page-rows.js";

export function buildBulletinPageHTML({
  eleve,
  notes,
  matieres,
  periode,
  niveau,
  maxNote,
  schoolInfo,
  rang = null,
  evolution = null,
  classStats = null,
  matiereClasseAvg = {},
  appreciation = "",
}) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const annee = getAnnee();

  const { lignes, totalCoef, moyGene, mention, ms, numero } = computeBulletinModel({
    eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, annee, matiereClasseAvg,
  });

  const tbody = buildLignesRows(lignes, maxNote);

  return `
  <div class="page">
    ${enteteDoc(schoolInfo, schoolInfo.logo)}

    <div style="background:linear-gradient(135deg,${c1},${c1}dd);color:#fff;padding:9px 16px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:800;letter-spacing:0.04em">${tr("reports.bulletinTitle").toUpperCase()}</div>
        <div style="font-size:11px;opacity:0.85">${periode} — ${tr("reports.schoolYear")} ${annee}</div>
      </div>
      <div style="font-size:9.5px;opacity:0.78;font-family:monospace;text-align:end">${tr("reports.bulletinNumber")} ${numero}</div>
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:flex;gap:12px;align-items:center">
        ${eleve.photo
          ? `<img src="${eleve.photo}" alt="" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid ${c1};flex-shrink:0"/>`
          : `<div style="width:60px;height:60px;border-radius:8px;background:${c1};color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${getInitiales(eleve)}</div>`}
        <div style="flex:1;font-size:10.5px;line-height:1.6;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${c1};margin-bottom:2px">${eleve.nom || ""} ${eleve.prenom || ""}</div>
          <div><strong>${tr("reports.class")} :</strong> ${eleve.classe || "—"} &nbsp;·&nbsp; <strong>${tr("school.bulletins.matricule")} :</strong> ${eleve.ien || "—"}</div>
          <div><strong>${tr("reports.dateOfBirth")} :</strong> ${eleve.dateNaissance || "—"}${eleve.lieuNaissance ? ` — ${eleve.lieuNaissance}` : ""}</div>
        </div>
      </div>

      <div style="border:2px solid ${ms.border};border-radius:8px;padding:10px 8px;text-align:center;background:${ms.bg}">
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:0.08em;color:${ms.color};font-weight:700;margin-bottom:1px">${tr("reports.generalAverage")}</div>
        <div style="font-size:30px;font-weight:900;color:${ms.color};line-height:1.05">${moyGene}<span style="font-size:13px;opacity:0.65">/${maxNote}</span></div>
        <div style="font-size:11px;font-weight:800;color:${ms.color};margin-top:3px;text-transform:uppercase;letter-spacing:0.04em">${mention}</div>
        ${rang ? `<div style="font-size:10px;margin-top:5px;padding-top:4px;border-top:1px solid ${ms.border};color:${ms.color}"><strong>${tr("reports.rank")} : ${rang.rang}<sup>${ordinalFr(rang.rang)}</sup> / ${rang.effectif}</strong></div>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="background:${c1}">${tr("reports.subject")}</th>
          <th style="background:${c1};text-align:center;width:50px">${tr("reports.coefficient")}</th>
          <th style="background:${c1};text-align:center;width:140px">${tr("reports.average")} /${maxNote}</th>
          <th style="background:${c1};text-align:center;width:80px">${tr("reports.weighted")}</th>
          <th style="background:${c1};text-align:center;width:90px">${tr("reports.average")} ${tr("reports.class")}</th>
          <th style="background:${c1};width:100px">${tr("reports.appreciation")}</th>
        </tr>
      </thead>
      <tbody>
        ${tbody}
        <tr style="background:${c1}1A;font-weight:800">
          <td colspan="2" style="color:${c1}">${tr("reports.generalAverage").toUpperCase()}</td>
          <td style="text-align:center;color:${c1};font-size:14px">${moyGene}/${maxNote}</td>
          <td style="text-align:center;color:${c1}">${totalCoef}</td>
          <td style="text-align:center;font-size:10px;color:#6b7280">${classStats && classStats.moyenneClasse != null ? classStats.moyenneClasse.toFixed(2) : "—"}</td>
          <td style="background:${ms.bg};color:${ms.color}">${mention}</td>
        </tr>
      </tbody>
    </table>

    ${(classStats || evolution) ? `
    <div style="display:flex;gap:8px;margin-top:8px;font-size:10px">
      ${classStats ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Statistiques de la classe</div>
        Effectif : <strong>${classStats.effectif}</strong> &nbsp;·&nbsp;
        Moy. classe : <strong>${classStats.moyenneClasse.toFixed(2)}</strong> &nbsp;·&nbsp;
        Min : <strong>${classStats.min.toFixed(1)}</strong> &nbsp;·&nbsp;
        Max : <strong>${classStats.max.toFixed(1)}</strong>
      </div>` : ""}
      ${evolution ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Évolution</div>
        ${evolution.periodePrec} : ${evolution.moyPrec.toFixed(2)} → ${periode} : <strong>${evolution.moyActu.toFixed(2)}</strong>
        ${evolution.ecart >= 0
          ? ` <span style="color:#16a34a;font-weight:700">↑ +${evolution.ecart.toFixed(2)}</span>`
          : ` <span style="color:#dc2626;font-weight:700">↓ ${evolution.ecart.toFixed(2)}</span>`}
      </div>` : ""}
    </div>` : ""}

    <div style="margin-top:10px;border:1px dashed #cbd5e1;border-radius:6px;padding:8px 12px;min-height:36px">
      <div style="font-size:8.5px;font-weight:700;color:${c1};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">${tr("reports.appreciation")}</div>
      <div style="font-size:11px;color:#374151;line-height:1.5">${appreciation || `<span style="color:#cbd5e1">__________________________________________________________________________</span>`}</div>
    </div>

    <div class="sigs">
      <div class="sig">${tr("reports.director")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${tr("reports.headTeacher")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
    </div>

    <div class="devise" style="color:${c2}">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>

    ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau))}
  </div>`;
}

export function getBulletinStyles() {
  return `
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px;color:#1f2937}
    .page{padding:14mm 12mm;page-break-after:always;box-sizing:border-box}
    .page:last-child{page-break-after:auto}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{color:#fff;padding:7px 9px;font-size:10.5px;text-align:left;border:1px solid rgba(0,0,0,0.05)}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f9;font-size:11px;vertical-align:middle}
    tbody tr:nth-child(odd){background:#fafafa}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px}
    .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#555}
    .devise{text-align:center;font-size:10px;margin-top:8px;font-style:italic;font-weight:700}
    @media print{body{margin:0}button{display:none}.page{padding:18px 22px}}
  `;
}
