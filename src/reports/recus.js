// ══════════════════════════════════════════════════════════════
//  Reçus de paiement — getRecuTotals + imprimerRecu
// ══════════════════════════════════════════════════════════════
// Génère 2 exemplaires (comptable + payant) sur une page A4.

import { MOIS_ANNEE, fmt, today } from "../constants.js";
import { getNationalDeviseHTML } from "../national-symbols.js";
import { resolveLegalFields } from "../legal-utils.js";
import {
  MINISTERE_DEFAUT,
  PRINT_RESET,
  PRINT_TRIGGER,
  printDir,
  printLang,
  tr,
} from "./print-helpers.js";

export const getRecuTotals = (eleve, montantUnit, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const moisPayes = moisAnnee.filter(m=>mens[m]==="Payé");
  const fraisIns = Number(fraisAnnexes?.inscription||0);
  const fraisAutre = Number(fraisAnnexes?.autre||0);
  const totalMensualites = moisPayes.length*montantUnit;
  const totalGeneral = totalMensualites
    + (eleve.inscriptionPayee&&fraisIns>0?fraisIns:0)
    + (eleve.autrePayee&&fraisAutre>0?fraisAutre:0);
  return { moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral };
};

export const imprimerRecu = (eleve, montantUnit, schoolInfo={}, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const mensDates = eleve.mensDates||{};
  const {moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral} = getRecuTotals(eleve, montantUnit, moisAnnee, fraisAnnexes);
  const w = window.open("","_blank");

  // En-tête compacte pour les reçus (logo + infos en ligne) — sans doublon type/nom
  const lf = resolveLegalFields(schoolInfo);
  const enteteCompact = () => `
  <div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid #0A1628;padding-bottom:6px;margin-bottom:6px">
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" alt="" style="width:38px;height:38px;object-fit:contain;flex-shrink:0"/>`:''}
    <div style="flex:1;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:8px;color:#444;line-height:1.5">
        <strong style="font-size:9px;color:#0A1628">${schoolInfo.pays||"République de Guinée"}</strong><br/>
        ${getNationalDeviseHTML(schoolInfo.pays)}<br/>
        ${lf.ministere||MINISTERE_DEFAUT}${lf.ire?` / ${lf.ire}`:""}${lf.dpe?` / ${lf.dpe}`:""}
      </div>
      <div style="text-align:right">
        <strong style="font-size:13px;color:#0A1628;display:block">${schoolInfo.nom||""}</strong>
        ${lf.agrement?`<span style="font-size:7px;color:#555">Agrém. : ${lf.agrement}</span>`:""}
      </div>
    </div>
  </div>`;

  // Bloc reçu compact — deux par page A4
  const bloc = (titre) => `
  <div class="recu">
    ${schoolInfo.logo?`<div class="watermark"><img src="${schoolInfo.logo}" alt=""/></div>`:""}
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%">
    ${enteteCompact()}
    <div class="badge">${tr("reports.receipt.title").toUpperCase()}</div>
    <div class="exemplaire">${titre}</div>
    <div class="grid">
      <div class="row"><span class="lbl">${tr("reports.studentName")} : </span>${eleve.nom} ${eleve.prenom}</div>
      <div class="row"><span class="lbl">${tr("school.bulletins.matricule")} : </span>${eleve.matricule||"—"}</div>
      <div class="row"><span class="lbl">${tr("reports.class")} : </span>${eleve.classe}</div>
      <div class="row"><span class="lbl">${tr("common.date")} : </span>${today()}</div>
      <div class="row"><span class="lbl">${tr("school.students.parent")} : </span>${eleve.tuteur||"—"}</div>
      <div class="row"><span class="lbl">${tr("school.students.contact")} : </span>${eleve.contactTuteur||"—"}</div>
    </div>
    <table class="mois-table"><thead><tr><th>${tr("accounting.month")}</th><th>${tr("common.status")}</th><th>${tr("common.date")}</th></tr></thead><tbody>
      ${moisAnnee.map(m=>{
        const paye=mens[m]==="Payé";
        const datePaie=mensDates[m]||"—";
        return `<tr class="${paye?"paye":"impaye"}">
          <td style="font-weight:700">${m}</td>
          <td style="text-align:center">${paye?"✓ "+tr("accounting.paid"):"✗ "+tr("accounting.unpaid")}</td>
          <td style="text-align:center">${paye?datePaie:"—"}</td>
        </tr>`;
      }).join("")}
    </tbody></table>
    ${eleve.inscriptionPayee&&fraisIns>0?`
    <div class="total" style="font-size:9px;padding:4px 8px;background:#f0f9ff;border-color:#7dd3fc">
      ${tr("reports.receipt.registration")} : <strong>${fmt(fraisIns)}</strong>
      <span style="font-weight:400;margin-inline-start:4px">✓ ${tr("accounting.paid")}</span>
    </div>`:""}
    ${eleve.autrePayee&&fraisAutre>0?`
    <div class="total" style="font-size:9px;padding:4px 8px;background:#f8fafc;border-color:#94a3b8">
      ${tr("reports.receipt.otherFees")} : <strong>${fmt(fraisAutre)}</strong>
      <span style="font-weight:400;margin-inline-start:4px">✓ ${tr("accounting.paid")}</span>
    </div>`:""}
    <div class="total">${tr("reports.receipt.monthlyFee")} : ${fmt(totalMensualites)} <span style="font-weight:400;font-size:9px">(${moisPayes.length}/${moisAnnee.length})</span></div>
    <div class="total" style="background:#e0f2fe;border-color:#38bdf8">${tr("reports.receipt.amount")} : <strong>${fmt(totalGeneral)}</strong></div>
    <div class="sigs">
      <div class="sig">${tr("reports.accountant")}<br/><br/><br/>${tr("reports.signature")} &amp; ${tr("reports.stamp")}</div>
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
    </div>
    </div>
  </div>`;

  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.receipt.title")}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:6mm;background:#fff;
         height:282mm;display:flex;flex-direction:column;gap:3mm}
    .recu{flex:1;padding:8px 12px;border:1px solid #bbb;border-radius:3px;display:flex;flex-direction:column;position:relative}
    .watermark{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark img{width:160px;height:160px;object-fit:contain;opacity:0.09}
    .badge{text-align:center;background:#0A1628;color:#fff;padding:4px;font-size:10px;font-weight:bold;margin:5px 0 2px;border-radius:3px}
    .exemplaire{text-align:right;font-size:8px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-bottom:6px}
    .row{font-size:8.5px}.lbl{font-weight:bold;color:#0A1628}
    .mois-table{width:100%;border-collapse:collapse;margin-bottom:5px;font-size:8px}
    .mois-table th{background:#0A1628;color:#fff;padding:3px 6px;text-align:left;font-size:7.5px}
    .mois-table td{padding:2px 6px;border-bottom:1px solid #eee}
    .mois-table tr.paye td{color:#166534;background:#f0fdf4}
    .mois-table tr.impaye td{color:#9ca3af}
    .total{text-align:right;font-size:10px;font-weight:bold;padding:4px 8px;background:#e8f0e8;color:#0A1628;margin-top:4px;border-radius:2px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:auto;padding-top:10px}
    .sig{border-top:1.5px solid #0A1628;padding-top:4px;text-align:center;font-size:8.5px;color:#333;font-weight:600}
    @media print{body{height:282mm}button{display:none}}
  </style></head><body>
  ${bloc("Exemplaire — Comptable")}
  ${bloc("Exemplaire — Payant")}
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
