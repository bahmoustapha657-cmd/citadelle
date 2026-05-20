// ══════════════════════════════════════════════════════════════
//  Attestation de scolarité
// ══════════════════════════════════════════════════════════════

import { getAnnee, today } from "../constants.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileMock,
  mapNiveauToCycle,
} from "../legal-utils.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

export const imprimerAttestation = (eleve, niveau, annee, schoolInfo={}) => {
  const niveauLabel = niveau === "college" ? tr("dashboard.secondary") : tr("dashboard.primary");
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.attestation.title")} — ${eleve.nom}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:18mm 14mm;font-size:13px;max-width:700px;margin:0 auto}
  h2{color:#0A1628;text-align:center;font-size:18px;text-transform:uppercase;letter-spacing:2px;margin:24px 0}
  .body-txt{line-height:2;font-size:14px;text-align:justify;margin:20px 0}
  .infos{background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;border-inline-start:4px solid #0A1628}
  .row{font-size:13px;margin:5px 0}.lbl{font-weight:bold;color:#0A1628}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:50px}
  .sig{border-top:2px solid #0A1628;padding-top:8px;text-align:center;font-size:11px;color:#555}
  .stamp{border:3px solid #0A1628;padding:8px 16px;display:inline-block;border-radius:4px;font-weight:bold;color:#0A1628;margin-top:6px;font-size:13px}
  .devise{text-align:center;font-size:11px;margin-top:20px;font-style:italic;color:#00C48C;font-weight:bold}
  @media print{button{display:none}}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${tr("reports.attestation.title")}</h2>
  <div class="body-txt">
    <p>${tr("reports.attestation.intro")} :</p>
    <div class="infos">
      <div class="row"><span class="lbl">${tr("reports.studentName")} : </span><strong>${eleve.nom} ${eleve.prenom}</strong></div>
      <div class="row"><span class="lbl">${tr("school.bulletins.matricule")} : </span>${eleve.matricule||"—"}</div>
      <div class="row"><span class="lbl">${tr("reports.dateOfBirth")} : </span>${eleve.dateNaissance||"—"}</div>
      <div class="row"><span class="lbl">${tr("school.bulletins.matricule")} : </span>${eleve.lieuNaissance||"—"}</div>
      <div class="row"><span class="lbl">${tr("reports.class")} : </span>${eleve.classe}</div>
      <div class="row"><span class="lbl">${niveauLabel}</span></div>
      <div class="row"><span class="lbl">${tr("school.students.parent")} : </span>${eleve.tuteur||"—"}</div>
      <div class="row"><span class="lbl">${tr("school.students.status")} : </span>${eleve.statut||"—"}</div>
    </div>
    <p>${tr("reports.attestation.intro")} <strong>${annee||getAnnee()}</strong>.</p>
    <p>${tr("reports.attestation.issued")}.</p>
    <p style="text-align:end;margin-top:20px">${tr("reports.ordreMutation.issuedAt")} ${schoolInfo.ville||"—"}, ${tr("reports.ordreMutation.on")} ${today()}</p>
  </div>
  <div class="sigs">
    <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
    <div class="sig">${tr("reports.director")}<br/><div class="stamp">${schoolInfo.nom||""}</div></div>
  </div>
  <div class="devise">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>
  ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileMock, mapNiveauToCycle(niveau))}
  <script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
};
