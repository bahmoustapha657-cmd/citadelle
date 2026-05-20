// ══════════════════════════════════════════════════════════════
//  Livret scolaire officiel
// ══════════════════════════════════════════════════════════════
// Document multi-pages : couverture + 1 page par année scolaire.

import { getPeriodesForSection } from "../period-utils.js";
import { resolveLegalFields } from "../legal-utils.js";
import {
  MINISTERE_DEFAUT,
  PRINT_RESET,
  WATERMARK_CSS,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

export const imprimerLivret = (livret, schoolInfo={}) => {
  const lf = resolveLegalFields(schoolInfo);
  const c1 = schoolInfo.couleur1||"#0A1628";
  const annees = livret.annees||[];
  // Le livret hérite de la section de l'élève (livret.section : "primaire" /
  // "college" / "lycee"). Primaire suit periodicitePrimaire, le reste suit
  // periodiciteSecondaire.
  const sectionPeriode = livret.section === "primaire" ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  // Mapping décisions FR (stockées en base) → clés i18n
  const decisionLabel = (d) => {
    if (d === "Admis avec félicitations") return tr("reports.livret.decisionDistinction");
    if (d === "Admis") return tr("reports.livret.decisionAdmitted");
    if (d === "Redoublant") return tr("reports.livret.decisionRepeating");
    if (d === "Exclu") return tr("reports.livret.decisionExcluded");
    return d || "—";
  };
  const sectionLabel = (s) => {
    if (s === "primaire") return tr("reports.livret.sectionPrimary");
    if (s === "lycee") return tr("reports.livret.sectionLycee");
    return tr("reports.livret.sectionCollege");
  };
  const pagesAnnees = annees.map((an, idx) => {
    const notesRows = (an.notes||[]).map(n=>`
      <tr>
        <td>${n.matiere||""}</td>
        <td style="text-align:center">${n.coef||1}</td>
        ${periodes.map(p=>`<td style="text-align:center">${n[p]!=null?n[p]:"—"}</td>`).join("")}
        <td style="text-align:center;font-weight:700;color:${Number(n.annuelle||0)>=Number(n.maxNote||20)/2?"#14532d":"#b91c1c"}">${n.annuelle!=null?Number(n.annuelle).toFixed(2):"—"}</td>
      </tr>`).join("");
    const decisionColor = an.decision==="Admis avec félicitations"?"#14532d":an.decision==="Admis"?"#1d4ed8":an.decision==="Redoublant"?"#b45309":"#b91c1c";
    return `
    <div class="page-annee" style="page-break-before:${idx>0?"always":"auto"}">
      <div class="bandeau" style="background:${c1}">
        <span>${tr("reports.livret.schoolBook")} — ${schoolInfo.nom||""}</span>
        <span>${tr("reports.livret.year")} ${an.anneeScolaire||"—"}</span>
      </div>
      <div class="info-row">
        <span><b>${tr("reports.livret.classLabel")}</b> ${an.classe||"—"}</span>
        <span><b>${tr("reports.livret.headTeacherLabel")}</b> ${an.enseignantPrincipal||"—"}</span>
        <span><b>${tr("reports.livret.enrollmentLabel")}</b> ${an.effectifClasse||"—"}</span>
        <span><b>${tr("reports.livret.rankLabel")}</b> ${an.rang||"—"}</span>
      </div>
      <table class="notes-tbl">
        <thead><tr style="background:${c1};color:#fff">
          <th style="text-align:start">${tr("reports.livret.subjectHeader")}</th>
          <th>${tr("reports.livret.coefHeader")}</th>${periodes.map(p=>`<th>${p}</th>`).join("")}<th>${tr("reports.livret.annualHeader")}</th>
        </tr></thead>
        <tbody>${notesRows}</tbody>
      </table>
      <div class="abs-row">
        <span>${tr("reports.livret.absencesJustified")} <b>${an.absences?.justifiees||0}</b></span>
        <span>${tr("reports.livret.absencesUnjustified")} <b>${an.absences?.nonJustifiees||0}</b></span>
      </div>
      <div class="appreciation">
        <strong>${tr("reports.livret.teacherAppreciation")}</strong><br/>
        <div style="min-height:40px;padding-top:6px">${an.appreciation||""}</div>
      </div>
      <div class="decision-box" style="border-color:${decisionColor}">
        <strong>${tr("reports.livret.councilDecision")}</strong>
        <span class="decision-badge" style="background:${decisionColor}">${decisionLabel(an.decision)}</span>
      </div>
      <div class="sigs-livret">
        <div class="sig-livret">${tr("reports.livret.directorSignature")}<br/><br/>${an.signe?`<em style="font-size:9px;color:#14532d">✅ ${tr("reports.livret.signedOn")} ${an.dateSigne||""}</em>`:"<br/>"+tr("reports.livret.signStamp")}</div>
        <div class="sig-livret">${tr("reports.livret.parentTutor")}<br/><br/><br/>${tr("reports.signature")}</div>
        <div class="sig-livret">${tr("reports.livret.inspectorVisa")}<br/><br/><br/>&nbsp;</div>
      </div>
    </div>`;
  }).join("");

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.livret.schoolBook")} — ${livret.eleveNom||""}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111;font-size:11px;margin:0;padding:12mm}
    .couverture{display:flex;flex-direction:column;align-items:center;justify-content:center;height:250mm;text-align:center;border:3px solid ${c1};padding:30px;page-break-after:always}
    .couv-school{font-size:11px;color:#444;margin-bottom:4px}
    .couv-titre{font-size:22px;font-weight:900;color:${c1};text-transform:uppercase;letter-spacing:3px;margin:16px 0 8px}
    .couv-num{font-size:12px;color:#6b7280;margin-bottom:20px}
    .couv-photo{width:90px;height:110px;border:2px solid ${c1};border-radius:4px;object-fit:cover;margin-bottom:16px}
    .couv-nom{font-size:18px;font-weight:900;color:#111;margin-bottom:6px}
    .couv-info{font-size:12px;color:#444;line-height:2}
    .bandeau{display:flex;justify-content:space-between;padding:7px 12px;color:#fff;font-weight:700;font-size:11px;border-radius:4px;margin-bottom:10px}
    .info-row{display:flex;gap:20px;font-size:11px;margin-bottom:10px;flex-wrap:wrap}
    .notes-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
    .notes-tbl td,.notes-tbl th{border:1px solid #ccc;padding:4px 7px}
    .abs-row{display:flex;gap:30px;font-size:11px;margin-bottom:10px;color:#374151}
    .appreciation{border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11px}
    .decision-box{display:flex;align-items:center;gap:14px;border:2px solid;border-radius:8px;padding:8px 14px;margin-bottom:12px}
    .decision-badge{padding:4px 14px;border-radius:14px;color:#fff;font-weight:900;font-size:12px}
    .sigs-livret{display:flex;justify-content:space-between;margin-top:16px}
    .sig-livret{text-align:center;flex:1;font-size:10px;border-top:1px solid #999;padding-top:6px;margin:0 8px}
    @media print{button{display:none}.page-annee{page-break-before:always}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  <!-- COUVERTURE -->
  <div class="couverture">
    <div class="couv-school">${schoolInfo.pays||"République de Guinée"} · ${lf.ministere||MINISTERE_DEFAUT}</div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:50px;margin-bottom:8px"/>`:""}
    <div style="font-size:13px;font-weight:700;color:#111">${schoolInfo.nom||""}</div>
    <div style="font-size:10px;color:#6b7280;margin-bottom:12px">${lf.agrement?`${tr("reports.livret.agrement")} ${lf.agrement}`:""}</div>
    <div class="couv-titre">${tr("reports.livret.schoolBook")}</div>
    <div class="couv-num">${tr("reports.livret.number")} ${livret.numeroLivret||"—"}</div>
    ${livret.photo?`<img src="${livret.photo}" class="couv-photo"/>`:`<div class="couv-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px;background:#f0f4f8">👤</div>`}
    <div class="couv-nom">${livret.eleveNom||"—"}</div>
    <div class="couv-info">
      ${tr("reports.livret.bornOn")} <strong>${livret.dateNaissance||"—"}</strong> ${tr("reports.livret.at")} <strong>${livret.lieuNaissance||"—"}</strong><br/>
      ${tr("reports.livret.matriculeLabel")} <strong>${livret.matricule||"—"}</strong>
      ${livret.ien?`&nbsp;·&nbsp;${tr("reports.livret.ienLabel")} <strong>${livret.ien}</strong>`:""}<br/>
      ${tr("reports.livret.sectionLabel")} <strong>${sectionLabel(livret.section)}</strong>
    </div>
  </div>
  <!-- PAGES ANNUELLES -->
  ${pagesAnnees||`<div style="padding:40px;text-align:center;color:#9ca3af">${tr("reports.livret.noYearRecorded")}</div>`}
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:${c1};color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨️ ${tr("reports.livret.print")}</button>
  </body></html>`);
  w.document.close();
};
