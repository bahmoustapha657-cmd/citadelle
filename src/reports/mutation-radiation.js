// ══════════════════════════════════════════════════════════════
//  Ordre de mutation + Certificat de radiation
// ══════════════════════════════════════════════════════════════
// Deux documents officiels remis lors du départ d'un élève.

import { fmt, getAnnee, getSectionForClasse, today } from "../constants.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileMock,
  mapNiveauToCycle,
  resolveLegalFields,
} from "../legal-utils.js";
import {
  MINISTERE_DEFAUT,
  PRINT_RESET,
  WATERMARK_CSS,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

export const imprimerOrdreMutation = (eleve, schoolInfo={}, ecoleDestination="", annee="") => {
  const lf = resolveLegalFields(schoolInfo);
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.ordreMutation.title")}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;color:#111;font-size:12px;padding:18mm}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #0A1628;padding-bottom:12px}
    .entete-col{flex:1;font-size:10px;line-height:1.7}
    h1{text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#0A1628;margin:20px 0 8px;text-decoration:underline}
    .sub{text-align:center;font-size:11px;color:#444;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-bottom:18px}
    td{padding:7px 10px;border:1px solid #ccc;font-size:11px}
    td:first-child{font-weight:700;background:#f5f7fa;width:40%}
    .sigs{display:flex;justify-content:space-between;margin-top:36px}
    .sig{text-align:center;font-size:11px;flex:1}
    @media print{button{display:none}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="entete">
    <div class="entete-col">
      <strong>${schoolInfo.pays||"République de Guinée"}</strong><br/>
      ${lf.ministere||MINISTERE_DEFAUT}<br/>
      ${lf.ire||""} ${lf.dpe?`/ ${lf.dpe}`:""}
    </div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:55px;object-fit:contain"/>`:""}
    <div class="entete-col" style="text-align:end">
      <strong>${schoolInfo.nom||""}</strong><br/>
      ${lf.agrement?`${tr("reports.livret.agrement")} : ${lf.agrement}`:""}
    </div>
  </div>
  <h1>${tr("reports.ordreMutation.title")}</h1>
  <p class="sub">${tr("reports.schoolYear")} : <strong>${annee||getAnnee()}</strong></p>
  <table>
    <tr><td>${tr("reports.ordreMutation.fullName")}</td><td><strong>${eleve.nom||""} ${eleve.prenom||""}</strong></td></tr>
    <tr><td>${tr("reports.ordreMutation.matricule")}</td><td>${eleve.matricule||"—"}</td></tr>
    ${eleve.ien?`<tr><td>${tr("reports.ordreMutation.nationalId")}</td><td>${eleve.ien}</td></tr>`:""}
    <tr><td>${tr("reports.ordreMutation.dateOfBirth")}</td><td>${eleve.dateNaissance||"—"}</td></tr>
    <tr><td>${tr("reports.ordreMutation.birthPlace")}</td><td>${eleve.lieuNaissance||"—"}</td></tr>
    <tr><td>${tr("reports.ordreMutation.currentClass")}</td><td>${eleve.classe||"—"}</td></tr>
    <tr><td>${tr("reports.ordreMutation.guardian")}</td><td>${eleve.tuteur||"—"} — ${eleve.contactTuteur||"—"}</td></tr>
    <tr><td>${tr("reports.ordreMutation.originSchool")}</td><td><strong>${schoolInfo.nom||""}</strong></td></tr>
    <tr><td>${tr("reports.ordreMutation.destinationSchool")}</td><td><strong>${ecoleDestination||tr("reports.ordreMutation.toFill")}</strong></td></tr>
    <tr><td>${tr("reports.ordreMutation.transferDate")}</td><td>${today()}</td></tr>
    <tr><td>${tr("reports.ordreMutation.motive")}</td><td>${eleve.motifDepart||tr("reports.ordreMutation.defaultMotive")}</td></tr>
  </table>
  <p style="font-size:11px;margin-bottom:30px">
    ${tr("reports.ordreMutation.paragraph")}
  </p>
  <div class="sigs">
    <div class="sig">${tr("reports.ordreMutation.originDirector")}<br/><br/><br/><br/>${tr("reports.ordreMutation.signStamp")}</div>
    <div class="sig">${tr("reports.ordreMutation.parentApproval")}<br/><br/><br/><br/>${tr("reports.signature")}</div>
  </div>
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:#0A1628;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ ${tr("reports.livret.print")}</button>
  </body></html>`);
  w.document.close();
};

export const imprimerCertificatRadiation = (eleve, schoolInfo={}, annee="", soldeRestant=0) => {
  const lf = resolveLegalFields(schoolInfo);
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.radiation.title")}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;color:#111;font-size:12px;padding:20mm}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0A1628;padding-bottom:12px;margin-bottom:20px}
    .entete-col{flex:1;font-size:10px;line-height:1.7}
    h1{text-align:center;font-size:15px;text-transform:uppercase;letter-spacing:1.5px;color:#0A1628;margin:16px 0;text-decoration:underline}
    .corps{line-height:2;font-size:12px;margin:20px 0}
    .corps strong{border-bottom:1px solid #111}
    .fin{margin-top:40px;text-align:end;font-size:11px}
    .sig{margin-top:30px;text-align:center;font-size:11px}
    @media print{button{display:none}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="entete">
    <div class="entete-col">
      <strong>${schoolInfo.pays||"République de Guinée"}</strong><br/>
      ${lf.ministere||MINISTERE_DEFAUT}<br/>
      ${lf.ire||""} ${lf.dpe?`/ ${lf.dpe}`:""}
    </div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:55px;object-fit:contain"/>`:""}
    <div class="entete-col" style="text-align:end">
      <strong>${schoolInfo.nom||""}</strong><br/>
      ${lf.agrement?`${tr("reports.livret.agrement")} : ${lf.agrement}`:""}
    </div>
  </div>
  <h1>${tr("reports.radiation.title")}</h1>
  <div class="corps">
    ${tr("reports.radiation.directorIntro")} ${schoolInfo.type||tr("reports.radiation.defaultType")} <strong>${schoolInfo.nom||""}</strong>,
    ${tr("reports.radiation.certify")}<br/><br/>
    &nbsp;&nbsp;&nbsp;${tr("reports.radiation.fullName")} : <strong>${eleve.nom||""} ${eleve.prenom||""}</strong><br/>
    &nbsp;&nbsp;&nbsp;${tr("reports.radiation.matricule")} : <strong>${eleve.matricule||"—"}</strong><br/>
    ${eleve.ien?`&nbsp;&nbsp;&nbsp;${tr("reports.radiation.ienShort")} : <strong>${eleve.ien}</strong><br/>`:""}
    &nbsp;&nbsp;&nbsp;${tr("reports.radiation.bornOn")} : <strong>${eleve.dateNaissance||"—"}</strong> ${tr("reports.radiation.at")} <strong>${eleve.lieuNaissance||"—"}</strong><br/>
    &nbsp;&nbsp;&nbsp;${tr("reports.radiation.classAttended")} : <strong>${eleve.classe||"—"}</strong><br/>
    &nbsp;&nbsp;&nbsp;${tr("reports.radiation.schoolYear")} : <strong>${annee||getAnnee()}</strong><br/><br/>
    ${tr("reports.radiation.removedOn")} <strong>${today()}</strong>
    ${tr("reports.radiation.forReason")} <strong>${eleve.motifDepart||tr("reports.radiation.defaultMotive")}</strong>.<br/><br/>
    ${tr("reports.radiation.financialSituation")} : <strong>${soldeRestant<=0?tr("reports.radiation.settled"):tr("reports.radiation.remainingDue")+" "+fmt(soldeRestant)}</strong>
  </div>
  <p style="font-size:11px;font-style:italic">
    ${tr("reports.radiation.deliveryNote")}
  </p>
  <div class="fin">${tr("reports.radiation.issuedAtCity")} ${schoolInfo.ville||"—"}, ${tr("reports.ordreMutation.on")} ${today()}</div>
  <div class="sig"><br/>${tr("reports.livret.directorSignature")}<br/><br/><br/><br/>${tr("reports.radiation.officialStamp")}</div>
  ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileMock, mapNiveauToCycle(getSectionForClasse(eleve.classe || "")))}
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:#0A1628;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ ${tr("reports.livret.print")}</button>
  </body></html>`);
  w.document.close();
};
