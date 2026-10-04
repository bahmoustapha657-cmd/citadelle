// Fragments HTML des reçus de paiement : en-tête compacte et bloc reçu.
import { fmt, getSectionForClasse, today } from "../../constants.js";
import { getNationalDeviseHTML } from "../../national-symbols.js";
import { MINISTERE_DEFAUT, tr } from "../print-helpers.js";
import { blocsSignatures } from "../signatures.js";

// En-tête compacte (logo + infos en ligne) — sans doublon type/nom.
export const enteteCompact = (schoolInfo, lf) => `
  <div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid #0A1628;padding-bottom:6px;margin-bottom:6px">
    ${schoolInfo.logo?`<img crossOrigin="anonymous" src="${schoolInfo.logo}" alt="" style="width:38px;height:38px;object-fit:contain;flex-shrink:0"/>`:''}
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

// Les mois en deux colonnes côte à côte : 10 à 12 lignes sur une seule
// colonne, plus les frais et le versement, débordaient du demi-A4.
const moitiesMois = (moisAnnee) => {
  const milieu = Math.ceil(moisAnnee.length / 2);
  return [moisAnnee.slice(0, milieu), moisAnnee.slice(milieu)].filter((m) => m.length);
};

// Bloc reçu compact — deux par page A4. ctx regroupe les données calculées.
export const blocRecu = (titre, ctx) => {
  const {
    schoolInfo, lf, eleve, moisAnnee, mens, mensDates, fraisIns, insPartielle = false, fraisDiversPayes = [],
    moisAcomptes = [], totalMensualites, moisPayes, totalGeneral, qr, versement = null, resteAPayer,
  } = ctx;
  const acompteDe = Object.fromEntries(moisAcomptes.map((a) => [a.mois, a.montant]));
  // Inscription et frais annexes réglés sur une seule bande, à la suite
  // (une bande par frais prenait trop de hauteur).
  const frais = [
    ...(fraisIns > 0 ? [{ label: tr("reports.receipt.registration"), montant: fraisIns, partiel: insPartielle }] : []),
    ...fraisDiversPayes,
  ];
  return `
  <div class="recu">
    ${schoolInfo.logo?`<div class="watermark"><img crossOrigin="anonymous" src="${schoolInfo.logo}" alt=""/></div>`:""}
    <div class="recu-corps">
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
    <div class="mois-cols">${moitiesMois(moisAnnee).map((moitie)=>`
    <table class="mois-table"><thead><tr><th>${tr("accounting.month")}</th><th>${tr("common.status")}</th><th>${tr("common.date")}</th></tr></thead><tbody>
      ${moitie.map(m=>{
        const paye=mens[m]==="Payé";
        const acompte=!paye?acompteDe[m]:0;
        const datePaie=mensDates[m]||"—";
        return `<tr class="${paye?"paye":"impaye"}">
          <td style="font-weight:700">${m}</td>
          <td style="text-align:center">${paye?"✓ "+tr("accounting.paid"):acompte?`◐ ${tr("reports.receipt.deposit")} ${fmt(acompte)}`:"✗ "+tr("accounting.unpaid")}</td>
          <td style="text-align:center">${paye?datePaie:"—"}</td>
        </tr>`;
      }).join("")}
    </tbody></table>`).join("")}
    </div>
    ${frais.length?`
    <div class="frais">${frais.map((f)=>`
      <span>${f.label} : <strong>${fmt(f.montant)}</strong> ${f.partiel?`◐ ${tr("reports.receipt.deposit")}`:`✓ ${tr("accounting.paid")}`}</span>`).join("")}
    </div>`:""}
    <div class="total">${tr("reports.receipt.monthlyFee")} : ${fmt(totalMensualites)} <span style="font-weight:400;font-size:9px">(${moisPayes.length}/${moisAnnee.length})</span></div>
    ${versement?`
    <div class="total" style="background:#dcfce7;border-color:#4ade80">
      ${tr("reports.receipt.paymentOf")} ${versement.date} : <strong>${fmt(versement.total)}</strong>
      <span style="display:block;font-weight:400;font-size:8.5px">${versement.lignes.map((l)=>`${l.libelle} ${fmt(l.montant)}`).join(" · ")}</span>
    </div>`:""}
    <div class="total" style="background:#e0f2fe;border-color:#38bdf8">${tr("reports.receipt.amount")} : <strong>${fmt(totalGeneral)}</strong>${
      resteAPayer!==undefined&&resteAPayer!==null
        ? ` <span style="margin-inline-start:8px;color:${resteAPayer>0?"#b91c1c":"#166534"}">· ${tr("reports.receipt.balanceDue")} : <strong>${fmt(resteAPayer)}</strong></span>`
        : ""}</div>
    <div class="sigs">
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
      ${blocsSignatures(schoolInfo, "recu", (identite, s) => `<div class="sig">${identite}<br/><br/><br/>${tr("reports.signature")}${s.role === "principal" ? ` &amp; ${tr("reports.stamp")}` : ""}</div>`,
        { section: getSectionForClasse(eleve.classe) })}
    </div>
    </div>
  </div>`;
};
