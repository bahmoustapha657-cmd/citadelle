// ══════════════════════════════════════════════════════════════
//  Rapport annuel — gabarit HTML du document imprimable
// ══════════════════════════════════════════════════════════════
// Assemble le document : styles (rapport-styles.js), en-tête, bandeau KPI,
// sections de données (rapport-sections.js), signatures et pied de page.
// Ne fait aucun calcul métier.

import { fmt, today } from "../../constants.js";
import { PRINT_TRIGGER, printDir, printLang, signataireHTML, tr, watermarkHtml } from "../print-helpers.js";
import { getRapportAnnuelStyles } from "./rapport-styles.js";
import {
  buildAbsences,
  buildEffectifs,
  buildFinances,
  buildMensualites,
  buildPedagogie,
  buildSalaires,
} from "./rapport-sections.js";

const fmtMoney = (n) => fmt(Math.round(Number(n) || 0));

const buildHeader = (m, c1, c2, nomEcole, logo) => `
  <div class="header">
    ${logo
      ? `<img src="${logo}" class="header-logo"/>`
      : `<div class="header-logo-ph">${nomEcole.slice(0, 2).toUpperCase()}</div>`}
    <div class="header-text">
      <div class="header-ecole">${nomEcole}</div>
      <div class="header-sub">${tr("reports.annualReport.title") || "Rapport annuel"} · ${tr("reports.schoolYear") || "Année scolaire"} <strong>${m.annee}</strong></div>
    </div>
    <div class="header-badge">
      <div class="header-badge-title">${tr("reports.period") || "Période"}</div>
      <div class="header-badge-val">${m.annee}</div>
    </div>
  </div>`;

const buildKpis = (m) => `
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${m.totEleves}</div><div class="kpi-label">Élèves actifs</div><div class="kpi-sub">${m.totC}C · ${m.totL}L · ${m.totP}P</div></div>
    <div class="kpi"><div class="kpi-val">${m.totEnseignants}</div><div class="kpi-label">Enseignants</div><div class="kpi-sub">${m.ensCCount}C · ${m.ensLCount}L · ${m.ensPCount}P</div></div>
    <div class="kpi vert"><div class="kpi-val">${fmtMoney(m.totRecAnnuel)}</div><div class="kpi-label">Recettes</div></div>
    <div class="kpi rouge"><div class="kpi-val">${fmtMoney(m.totDepAnnuel + m.totSalAnnuel)}</div><div class="kpi-label">Dépenses+Salaires</div><div class="kpi-sub">${fmtMoney(m.totDepAnnuel)} + ${fmtMoney(m.totSalAnnuel)}</div></div>
    <div class="kpi ${m.soldeAnnuel >= 0 ? "vert" : "rouge"}"><div class="kpi-val">${fmtMoney(m.soldeAnnuel)}</div><div class="kpi-label">Solde annuel</div></div>
    <div class="kpi ${m.tauxRecouvrement >= 80 ? "vert" : m.tauxRecouvrement >= 50 ? "amber" : "rouge"}"><div class="kpi-val">${m.tauxRecouvrement}%</div><div class="kpi-label">Recouvrement</div><div class="kpi-sub">${m.totalPercu}/${m.totalDu}</div></div>
  </div>`;

export const buildRapportAnnuelHTML = (model, schoolInfo = {}) => {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const nomEcole = schoolInfo.nom || "École";
  const logo = schoolInfo.logo || "";

  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.annualReport.title") || "Rapport annuel"} ${model.annee} — ${nomEcole}</title>
  <style>${getRapportAnnuelStyles(c1, c2)}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${buildHeader(model, c1, c2, nomEcole, logo)}
  ${buildKpis(model)}
  ${buildEffectifs(model)}
  ${buildFinances(model)}
  ${buildPedagogie(model)}
  ${buildMensualites(model)}
  ${buildSalaires(model)}
  ${buildAbsences(model)}

  <div class="sigs">
    <div class="sig">${signataireHTML(schoolInfo, "direction", "Directeur Général")}<br/><br/><br/>Signature & Cachet</div>
    <div class="sig">Fondateur / Conseil d'administration<br/><br/><br/>Signature</div>
  </div>

  <div class="footer">
    <span>${nomEcole} · ${tr("reports.annualReport.title") || "Rapport annuel"} ${model.annee}</span>
    <span>Édité le ${today()}</span>
  </div>

  <script>${PRINT_TRIGGER}</script>
  </body></html>`;
};
