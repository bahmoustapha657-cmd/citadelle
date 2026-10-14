// ══════════════════════════════════════════════════════════════
//  Reçu FAMILLE — plusieurs enfants d'un même tuteur sur un reçu
// ══════════════════════════════════════════════════════════════
// Le parent qui règle pour toute sa fratrie reçoit UN reçu : une ligne par
// enfant (mois réglés, frais, total versé, reste à payer) et les totaux du
// foyer. Mêmes montants que le reçu individuel : chaque ligne vient de
// getRecuTotals et du reste à payer de la fiche (cf. recu-eleve.js).
//   • A4 : 2 exemplaires (comptable + payant), styles des reçus A4.
//   • ticket 58/80 mm : un bloc par enfant, puis les totaux.
import { fmt, fmtN, getSectionForClasse, today } from "../../constants.js";
import { EDUGEST_SITE, printResetFor, tr } from "../print-helpers.js";
import { blocsSignatures } from "../signatures.js";
import { enteteCompact } from "./recu-blocs.js";
import { TICKET_STYLES, normaliserLargeur } from "./recu-ticket.js";

// Mois réglés en abrégé (« Oct, Nov, Déc ») ; un mois entamé porte ◐.
const abrege = (mois) => String(mois).slice(0, 3);
export const moisRegles = ({ moisPayes = [], moisAcomptes = [] }) => [
  ...moisPayes.map(abrege),
  ...moisAcomptes.map((a) => `${abrege(a.mois)} ◐`),
].join(", ");

const fraisDe = ({ fraisIns = 0, fraisDiversPayes = [] }) =>
  fraisIns + fraisDiversPayes.reduce((s, f) => s + f.montant, 0);

// Totaux du foyer. `enfants` : [{ eleve, totaux, resteAPayer }].
export const totauxFamille = (enfants = []) => ({
  totalMensualites: enfants.reduce((s, x) => s + x.totaux.totalMensualites, 0),
  totalFrais: enfants.reduce((s, x) => s + fraisDe(x.totaux), 0),
  totalGeneral: enfants.reduce((s, x) => s + x.totaux.totalGeneral, 0),
  resteAPayer: enfants.reduce((s, x) => s + Number(x.resteAPayer || 0), 0),
});

// Tuteur et contact : ceux du premier enfant qui les renseigne.
const foyer = (enfants) => {
  const avec = (champ) => enfants.find((x) => String(x.eleve[champ] || "").trim())?.eleve[champ] || "—";
  return { tuteur: avec("tuteur"), contact: avec("contactTuteur") };
};

// Bloc A4 (demi-page). ctx : { schoolInfo, lf, enfants, moisAnnee, qr }.
export const blocRecuFamille = (titre, ctx) => {
  const { schoolInfo, lf, enfants = [], moisAnnee = [], qr } = ctx;
  const t = totauxFamille(enfants);
  const { tuteur, contact } = foyer(enfants);
  const th = (texte, align = "left") => `<th style="text-align:${align}">${texte}</th>`;
  const td = (texte, align = "right", gras = false) =>
    `<td style="text-align:${align}${gras ? ";font-weight:700" : ""}">${texte}</td>`;
  return `
  <div class="recu">
    ${schoolInfo.logo?`<div class="watermark"><img crossOrigin="anonymous" src="${schoolInfo.logo}" alt=""/></div>`:""}
    <div class="recu-corps">
    ${enteteCompact(schoolInfo, lf)}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1">
        <div class="badge">${tr("reports.receipt.title").toUpperCase()} — ${tr("reports.receipt.family").toUpperCase()}</div>
        <div class="exemplaire">${titre}</div>
      </div>
      ${qr ? `<div style="flex-shrink:0;text-align:center"><div style="line-height:0">${qr}</div><div style="font-size:6px;color:#94a3b8;margin-top:1px">${tr("reports.qrVerify")}</div></div>` : ""}
    </div>
    <div class="grid">
      <div class="row"><span class="lbl">${tr("school.students.parent")} : </span>${tuteur}</div>
      <div class="row"><span class="lbl">${tr("school.students.contact")} : </span>${contact}</div>
      <div class="row"><span class="lbl">${tr("reports.receipt.children")} : </span>${enfants.length}</div>
      <div class="row"><span class="lbl">${tr("common.date")} : </span>${today()}</div>
    </div>
    <table class="mois-table" style="margin-bottom:5px">
      <thead><tr>
        ${th(tr("reports.studentName"))}${th(tr("reports.class"))}${th(tr("reports.receipt.paidMonths"))}
        ${th(tr("reports.receipt.monthlyFee"), "right")}${th(tr("reports.receipt.otherFees"), "right")}
        ${th(tr("reports.receipt.amount"), "right")}${th(tr("reports.receipt.balanceDue"), "right")}
      </tr></thead>
      <tbody>${enfants.map(({ eleve, totaux, resteAPayer }) => `
        <tr>
          ${td(`<strong>${eleve.nom||""} ${eleve.prenom||""}</strong>${eleve.matricule?`<br/><span style="color:#64748b">${eleve.matricule}</span>`:""}`, "left")}
          ${td(eleve.classe||"—", "left")}
          ${td(`${totaux.moisPayes.length}/${moisAnnee.length}${moisRegles(totaux)?` <span style="color:#64748b">· ${moisRegles(totaux)}</span>`:""}`, "left")}
          ${td(fmtN(totaux.totalMensualites))}
          ${td(fmtN(fraisDe(totaux)))}
          ${td(fmtN(totaux.totalGeneral), "right", true)}
          <td style="text-align:right;font-weight:700;color:${Number(resteAPayer)>0?"#b91c1c":"#166534"}">${fmtN(Number(resteAPayer||0))}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr style="background:#f1f5f9;font-weight:700">
        ${td(tr("reports.receipt.familyTotal"), "left", true)}<td></td><td></td>
        ${td(fmtN(t.totalMensualites), "right", true)}${td(fmtN(t.totalFrais), "right", true)}
        ${td(fmtN(t.totalGeneral), "right", true)}${td(fmtN(t.resteAPayer), "right", true)}
      </tr></tfoot>
    </table>
    <div class="total" style="background:#e0f2fe;border-color:#38bdf8">${tr("reports.receipt.amount")} : <strong>${fmt(t.totalGeneral)}</strong>
      <span style="margin-inline-start:8px;color:${t.resteAPayer>0?"#b91c1c":"#166534"}">· ${tr("reports.receipt.balanceDue")} : <strong>${fmt(t.resteAPayer)}</strong></span></div>
    <div class="sigs">
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
      ${blocsSignatures(schoolInfo, "recu", (identite, s) => `<div class="sig">${identite}<br/><br/><br/>${tr("reports.signature")}${s.role === "principal" ? ` &amp; ${tr("reports.stamp")}` : ""}</div>`,
        { section: getSectionForClasse(enfants[0]?.eleve?.classe) })}
    </div>
    </div>
  </div>`;
};

// Ligne « libellé …… montant » du ticket (montants nus, devise sur le total).
const ligne = (libelle, montant, gras = false) =>
  `<tr${gras ? ' style="font-weight:700"' : ""}><td>${libelle}</td><td class="m">${fmtN(montant)}</td></tr>`;

// Ticket thermique : un bloc par enfant, puis les totaux du foyer.
export const blocTicketFamille = (ctx) => {
  const { schoolInfo = {}, enfants = [], moisAnnee = [], qr } = ctx;
  const t = totauxFamille(enfants);
  const { tuteur } = foyer(enfants);
  const contactEcole = [schoolInfo.telephone, schoolInfo.adresse || schoolInfo.ville]
    .filter((v) => String(v || "").trim()).join(" · ");
  return `
  <div class="t-recu">
    ${schoolInfo.logo ? `<img crossOrigin="anonymous" class="t-logo" src="${schoolInfo.logo}" alt=""/>` : ""}
    <div class="t-ecole">${schoolInfo.nom || ""}</div>
    ${contactEcole ? `<div class="t-sous">${contactEcole}</div>` : ""}
    <div class="t-titre">${tr("reports.receipt.title")}</div>
    <div class="t-sous">${tr("reports.receipt.family")}</div>
    <div class="t-sep"></div>
    <div class="t-info"><span>${tr("school.students.parent")}</span><b>${tuteur}</b></div>
    <div class="t-info"><span>${tr("common.date")}</span><b>${today()}</b></div>
    ${enfants.map(({ eleve, totaux, resteAPayer }) => `
    <div class="t-sep"></div>
    <div class="t-groupe">${eleve.nom || ""} ${eleve.prenom || ""}</div>
    <div class="t-legende">${eleve.classe || "—"}${eleve.matricule ? ` · ${eleve.matricule}` : ""}</div>
    <table class="t-lignes">
      ${ligne(`${tr("reports.receipt.monthlyFee")} ${totaux.moisPayes.length}/${moisAnnee.length}`, totaux.totalMensualites)}
      ${moisRegles(totaux) ? `<tr><td colspan="2" class="t-legende">${moisRegles(totaux)}</td></tr>` : ""}
      ${fraisDe(totaux) > 0 ? ligne(tr("reports.receipt.otherFees"), fraisDe(totaux)) : ""}
      ${ligne(tr("reports.receipt.amount"), totaux.totalGeneral, true)}
      ${ligne(tr("reports.receipt.balanceDue"), Number(resteAPayer || 0))}
    </table>`).join("")}
    <div class="t-sep"></div>
    <div class="t-total"><span>${tr("reports.receipt.familyTotal")}</span><b>${fmt(t.totalGeneral)}</b></div>
    <div class="t-total"><span>${tr("reports.receipt.balanceDue")}</span><b>${fmt(t.resteAPayer)}</b></div>
    ${qr ? `<div class="t-qr">${qr}<div class="t-legende">${tr("reports.qrVerify")}</div></div>` : ""}
    <div class="t-merci">${tr("reports.receipt.thanks")}</div>
    <div class="t-marque">EduGest · ${EDUGEST_SITE}</div>
  </div>`;
};

export const documentTicketFamille = (ctx, printTrigger, lang = "fr", dir = "ltr") => {
  const largeurMm = normaliserLargeur(ctx.largeurMm);
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><title>${tr("reports.receipt.title")}</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    ${printResetFor(`size:${largeurMm}mm auto;margin:0`)}${TICKET_STYLES(largeurMm)}
  </style></head><body>
  ${blocTicketFamille(ctx)}
  <script>${printTrigger}</script>
  </body></html>`;
};
