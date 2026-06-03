// ══════════════════════════════════════════════════════════════
//  Rapport mensuel — Absences + Paiements par classe
// ══════════════════════════════════════════════════════════════
// Bilan de fin de mois (DG/comptable) : taux de paiement, absences
// justifiées/non, liste des élèves avec ≥ 3 absences.
// Orchestrateur : calculs dans ./rapport-mensuel/mensuel-data, styles
// dans ./rapport-mensuel/mensuel-styles.

import {
  PRINT_TRIGGER,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";
import { computeRapportMensuel } from "./rapport-mensuel/mensuel-data.js";
import { mensuelCss } from "./rapport-mensuel/mensuel-styles.js";

/**
 * Rapport mensuel complet : absences + paiements par classe
 * @param {string} mois  — ex: "Novembre"
 * @param {Array}  eleves — tous les élèves (primaire + collège fusionnés)
 * @param {Array}  absences — collection absences
 * @param {string} annee — ex: "2025-2026"
 * @param {Object} schoolInfo
 * @param {Array}  moisAnnee — liste des mois de l'année scolaire
 */
export const genererRapportMensuel = (mois, eleves, absences, annee, schoolInfo={}, _moisAnnee=[]) => {
  if(!eleves.length){ alert("Aucun élève."); return; }
  void _moisAnnee;
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const nomEcole = schoolInfo.nom||"École";
  const logo = schoolInfo.logo||"";

  const {
    classes, lignesClasse, totEffectif, totAbsJ, totAbsN, totPaye, tauxGlobal, elevesConcernes,
  } = computeRapportMensuel(mois, eleves, absences);

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.monthlyReport.title")} ${mois} ${annee} — ${nomEcole}</title>
  <style>${mensuelCss(c1, c2)}</style></head><body>
  ${watermarkHtml(schoolInfo)}

  <div class="header">
    ${logo
      ?`<img src="${logo}" class="header-logo"/>`
      :`<div class="header-logo-ph">${nomEcole.slice(0,2).toUpperCase()}</div>`}
    <div class="header-text">
      <div class="header-ecole">${nomEcole}</div>
      <div class="header-sub">${tr("reports.monthlyReport.title")} • ${tr("reports.schoolYear")} ${annee}</div>
    </div>
    <div class="header-badge">
      <div class="header-badge-title">${tr("reports.period")}</div>
      <div class="header-badge-val">${mois}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${totEffectif}</div><div class="kpi-label">${tr("reports.monthlyReport.totalStudents")}</div><div class="kpi-sub">${classes.length}</div></div>
    <div class="kpi amber"><div class="kpi-val">${totAbsJ+totAbsN}</div><div class="kpi-label">${tr("reports.absences")}</div><div class="kpi-sub">${totAbsJ} ${tr("reports.justified")} · ${totAbsN} ${tr("reports.unjustified")}</div></div>
    <div class="kpi ${tauxGlobal>=80?"vert":tauxGlobal>=50?"amber":"rouge"}"><div class="kpi-val">${tauxGlobal}%</div><div class="kpi-label">${tr("accounting.rate")}</div><div class="kpi-sub">${totPaye}/${totEffectif}</div></div>
    <div class="kpi"><div class="kpi-val">${elevesConcernes.length}</div><div class="kpi-label">${tr("reports.absences")}</div><div class="kpi-sub">≥ 3</div></div>
  </div>

  <div class="section-title">${tr("reports.monthlyReport.stats")}</div>
  <table>
    <thead><tr>
      <th>${tr("reports.class")}</th><th>${tr("school.classes.students")}</th><th>${tr("reports.absences")} ${tr("reports.justified")}</th><th>${tr("reports.absences")} ${tr("reports.unjustified")}</th><th>${tr("common.total")}</th><th>${tr("accounting.tabs.monthlyFees")}</th><th>${tr("accounting.rate")}</th>
    </tr></thead>
    <tbody>
      ${lignesClasse.map(l=>`<tr>
        <td><strong>${l.classe}</strong></td>
        <td style="text-align:center">${l.effectif}</td>
        <td style="text-align:center;color:#059669">${l.absJustif}</td>
        <td style="text-align:center;color:#dc2626">${l.absNonJust}</td>
        <td style="text-align:center;font-weight:700">${l.total}</td>
        <td style="text-align:center">${l.payesMois}/${l.effectif}</td>
        <td>
          <span class="pct-bar" style="width:${l.tauxPaye*0.5}px"></span>
          <strong style="color:${l.tauxPaye>=80?"#059669":l.tauxPaye>=50?"#d97706":"#dc2626"}">${l.tauxPaye}%</strong>
        </td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9;font-weight:800">
        <td>${tr("common.total").toUpperCase()}</td><td style="text-align:center">${totEffectif}</td>
        <td style="text-align:center;color:#059669">${totAbsJ}</td>
        <td style="text-align:center;color:#dc2626">${totAbsN}</td>
        <td style="text-align:center">${totAbsJ+totAbsN}</td>
        <td style="text-align:center">${totPaye}/${totEffectif}</td>
        <td><strong style="color:${tauxGlobal>=80?"#059669":tauxGlobal>=50?"#d97706":"#dc2626"}">${tauxGlobal}%</strong></td>
      </tr>
    </tbody>
  </table>

  ${elevesConcernes.length>0?`
  <div class="alert-box">
    <div class="alert-title">🚨 Élèves avec absences répétées (≥ 3 ce mois)</div>
    <table style="margin-bottom:0">
      <thead><tr><th>Nom & Prénom</th><th>Classe</th><th>Nb absences</th><th>Tuteur</th><th>Contact</th></tr></thead>
      <tbody>
        ${elevesConcernes.map(e=>`<tr>
          <td><strong>${e.nom} ${e.prenom}</strong></td>
          <td>${e.classe||"—"}</td>
          <td style="text-align:center;font-weight:800;color:#dc2626">${e.nbAbs}</td>
          <td>${e.tuteur||"—"}</td>
          <td>${e.contactTuteur||"—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}

  <div class="page-footer">
    <span>${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>
    <span>${nomEcole}</span>
    <span>${tr("reports.signature")} ${tr("reports.director")} : ___________________</span>
  </div>

  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
