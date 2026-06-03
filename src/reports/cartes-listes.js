// ══════════════════════════════════════════════════════════════
//  Cartes élèves + Listes de classe
// ══════════════════════════════════════════════════════════════
// imprimerCartesEleves : cartes d'identité avec QR code (2/page A4)
// imprimerListeClasse : tableau de la classe (impression A4 portrait)

import { today } from "../constants.js";
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
import { carteCss } from "./cartes-listes/carte-styles.js";
import { carteEleve, genererQrMap } from "./cartes-listes/carte-bloc.js";

export const imprimerCartesEleves = async (eleves, schoolInfo={}, annee="") => {
  if(!eleves.length){alert("Aucun élève à imprimer.");return;}
  const qrMap = await genererQrMap(eleves);
  const w = window.open("","_blank");
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const ctx = {
    logo: schoolInfo.logo||"",
    nomEcole: schoolInfo.nom||"École",
    ville: schoolInfo.ville||"",
    annee, qrMap,
  };

  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.card.title")} — ${ctx.nomEcole}</title>
  <style>${carteCss({ c1, c2 })}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="grille">${eleves.map(e=>carteEleve(e, ctx)).join("")}</div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};


export const imprimerListeClasse = (classe, eleves, schoolInfo={}) => {
  const liste = eleves.filter(e=>e.classe===classe);
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.listClass.title")} ${classe}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;margin:0}
  h2{color:#0A1628;text-align:center}table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#0A1628;color:#fff;padding:7px 10px;font-size:11px;text-align:start}
  td{padding:7px 10px;border-bottom:1px solid #eee}tr:nth-child(even){background:#f0f4f8}
  .footer{margin-top:30px;display:flex;justify-content:space-between;font-size:11px;color:#555}
  @media print{button{display:none}}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${tr("reports.listClass.title")} ${classe}</h2>
  <table><thead><tr><th>${tr("reports.listClass.headerN")}</th><th>${tr("reports.listClass.headerMatricule")}</th><th>${tr("reports.listClass.headerName")}</th><th>${tr("reports.listClass.headerSex")}</th><th>${tr("reports.listClass.headerDateOfBirth")}</th><th>${tr("reports.listClass.headerBirthPlace")}</th><th>${tr("reports.listClass.headerFiliation")}</th><th>${tr("reports.listClass.headerGuardian")}</th><th>${tr("reports.listClass.headerContact")}</th><th>${tr("reports.listClass.headerStatus")}</th></tr></thead>
  <tbody>${liste.map((e,i)=>`<tr><td>${i+1}</td><td>${e.matricule||"—"}</td><td><strong>${e.nom} ${e.prenom}</strong></td><td>${e.sexe||"—"}</td><td>${e.dateNaissance||"—"}</td><td>${e.lieuNaissance||"—"}</td><td>${e.filiation||"—"}</td><td>${e.tuteur||"—"}</td><td>${e.contactTuteur||"—"}</td><td>${e.statut||tr("school.students.active")}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer"><span>${tr("reports.listClass.enrollment")} : ${liste.length} ${tr("reports.listClass.studentSuffix")}</span><span>${tr("reports.listClass.printDate")} : ${today()}</span><span>${tr("reports.director")}</span></div>
  <script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
};
