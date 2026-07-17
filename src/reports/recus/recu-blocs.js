// Fragments HTML des reçus de paiement : en-tête compacte et bloc reçu.
import { fmt, today } from "../../constants.js";
import { getNationalDeviseHTML } from "../../national-symbols.js";
import { MINISTERE_DEFAUT, signataireHTML, tr } from "../print-helpers.js";

// En-tête compacte (logo + infos en ligne) — sans doublon type/nom.
export const enteteCompact = (schoolInfo, lf) => `
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

// Bloc reçu compact — deux par page A4. ctx regroupe les données calculées.
export const blocRecu = (titre, ctx) => {
  const { schoolInfo, lf, eleve, moisAnnee, mens, mensDates, fraisIns, fraisAutre, totalMensualites, moisPayes, totalGeneral, qr } = ctx;
  return `
  <div class="recu">
    ${schoolInfo.logo?`<div class="watermark"><img src="${schoolInfo.logo}" alt=""/></div>`:""}
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%">
    ${enteteCompact(schoolInfo, lf)}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div>
        <div class="badge">${tr("reports.receipt.title").toUpperCase()}</div>
        <div class="exemplaire">${titre}</div>
      </div>
      ${qr ? `<div style="flex-shrink:0;text-align:center"><div style="line-height:0">${qr}</div><div style="font-size:6px;color:#94a3b8;margin-top:1px">${tr("reports.qrVerify")}</div></div>` : ""}
    </div>
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
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${signataireHTML(schoolInfo, "comptable", tr("reports.accountant"))}<br/><br/><br/>${tr("reports.signature")} &amp; ${tr("reports.stamp")}</div>
    </div>
    </div>
  </div>`;
};
