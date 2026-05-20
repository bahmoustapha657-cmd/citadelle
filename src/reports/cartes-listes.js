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
  loadQRCode,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

export const imprimerCartesEleves = async (eleves, schoolInfo={}, annee="") => {
  if(!eleves.length){alert("Aucun élève à imprimer.");return;}
  // Pré-générer les QR codes (data URL) pour chaque élève
  const qrMap = {};
  const QRCode = await loadQRCode();
  await Promise.all(eleves.map(async e => {
    try {
      qrMap[e._id] = await QRCode.toDataURL(e.matricule||e._id, {
        width:80, margin:0, color:{dark:"#0A1628",light:"#ffffff"}
      });
    } catch { qrMap[e._id] = ""; }
  }));
  const w = window.open("","_blank");
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const nomEcole = schoolInfo.nom||"École";
  const ville = schoolInfo.ville||"";
  const logo = schoolInfo.logo||"";

  // Génère une version claire de c1 pour le fond du corps
  const carte = (e) => `
  <div class="carte">
    <!-- Bande déco gauche couleur 2 -->
    <div class="bande-gauche"></div>

    <div class="carte-inner">
      <!-- EN-TÊTE -->
      <div class="carte-header">
        <div class="logo-wrap">
          ${logo
            ?`<img src="${logo}" class="carte-logo"/>`
            :`<div class="logo-initiales">${nomEcole.slice(0,2).toUpperCase()}</div>`}
        </div>
        <div class="carte-titre">
          <div class="carte-ecole">${nomEcole}</div>
          ${ville?`<div class="carte-ville">${ville}</div>`:""}
          <div class="carte-sous">${tr("reports.card.title").toUpperCase()}</div>
        </div>
        <div class="annee-badge">${annee}</div>
      </div>

      <!-- SÉPARATEUR -->
      <div class="separateur"></div>

      <!-- CORPS -->
      <div class="carte-body">
        <div class="carte-photo">
          ${e.photo
            ?`<img src="${e.photo}" class="photo-img"/>`
            :`<div class="photo-initiales">${(e.prenom||"?")[0].toUpperCase()}${(e.nom||"?")[0].toUpperCase()}</div>`}
        </div>
        <div class="carte-infos">
          <div class="carte-nom">${(e.prenom||"").toUpperCase()} ${(e.nom||"").toUpperCase()}</div>
          <div class="info-ligne"><span class="info-label">${tr("school.bulletins.matricule")}</span><span class="info-val">${e.matricule||"—"}</span></div>
          ${e.ien?`<div class="info-ligne"><span class="info-label">IEN</span><span class="info-val ien">${e.ien}</span></div>`:""}
          <div class="info-ligne"><span class="info-label">${tr("reports.class")}</span><span class="info-val">${e.classe||"—"}</span></div>
          <div class="info-ligne"><span class="info-label">${tr("reports.dateOfBirth")}</span><span class="info-val">${e.dateNaissance||"—"}</span></div>
          ${e.sexe?`<div class="info-ligne"><span class="info-label">${tr("common.status")}</span><span class="info-val">${e.sexe}</span></div>`:""}
        </div>
      </div>

      <!-- PIED -->
      <div class="carte-footer">
        <div class="footer-left">
          <span class="footer-label">${tr("reports.signature")} — ${tr("reports.director")}</span>
          <div class="footer-ligne"></div>
        </div>
        <div class="footer-center">
          ${qrMap[e._id]
            ?`<div class="qr-wrap"><img src="${qrMap[e._id]}" class="qr-img"/><div class="mat-badge">${e.matricule||""}</div></div>`
            :`<div class="mat-badge">${e.matricule||""}</div>`}
        </div>
        <div class="footer-right">
          <span class="footer-label">${tr("reports.signature")} — ${tr("reports.studentName")}</span>
          <div class="footer-ligne"></div>
        </div>
      </div>
    </div>
  </div>`;

  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.card.title")} — ${nomEcole}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    ${PRINT_RESET}
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;background:#f0f0f0;padding:8mm}

    .grille{display:grid;grid-template-columns:repeat(2,86mm);gap:5mm;justify-content:center}

    /* Carte principale */
    .carte{
      width:86mm;height:54mm;border-radius:3mm;overflow:hidden;
      display:flex;flex-direction:row;
      break-inside:avoid;page-break-inside:avoid;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      background:#fff;
      border:.3mm solid rgba(0,0,0,.1);
    }

    /* Bande verticale gauche */
    .bande-gauche{
      width:3.5mm;flex-shrink:0;
      background:linear-gradient(180deg,${c2},${c1});
    }

    /* Contenu principal */
    .carte-inner{flex:1;display:flex;flex-direction:column;overflow:hidden}

    /* En-tête */
    .carte-header{
      background:${c1};
      padding:2mm 2.5mm;
      display:flex;align-items:center;gap:2mm;
      flex-shrink:0;
    }
    .logo-wrap{
      width:10mm;height:10mm;flex-shrink:0;
      background:rgba(255,255,255,0.15);
      border-radius:1.5mm;
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;border:.3mm solid rgba(255,255,255,0.3);
    }
    .carte-logo{width:100%;height:100%;object-fit:contain;padding:.5mm}
    .logo-initiales{font-size:7pt;font-weight:900;color:${c2};letter-spacing:-.02em}
    .carte-titre{flex:1;min-width:0}
    .carte-ecole{color:${c2};font-size:6pt;font-weight:900;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .carte-ville{color:rgba(255,255,255,.55);font-size:4pt;margin-top:.3mm}
    .carte-sous{color:rgba(255,255,255,.5);font-size:3.5pt;letter-spacing:.12em;text-transform:uppercase;margin-top:.4mm}
    .annee-badge{
      background:${c2};color:${c1};
      font-size:4pt;font-weight:900;
      padding:1mm 1.8mm;border-radius:1mm;
      white-space:nowrap;flex-shrink:0;
    }

    /* Séparateur */
    .separateur{height:.4mm;background:linear-gradient(90deg,${c2},${c1});flex-shrink:0}

    /* Corps */
    .carte-body{
      flex:1;display:flex;padding:2mm 2.5mm;gap:2.5mm;align-items:center;
      background:linear-gradient(135deg,#ffffff 70%,${c1}08 100%);
    }
    .carte-photo{
      width:16mm;height:20mm;flex-shrink:0;
      border-radius:1.5mm;overflow:hidden;
      border:1mm solid ${c1};
      background:${c1+"22"};
      display:flex;align-items:center;justify-content:center;
    }
    .photo-img{width:100%;height:100%;object-fit:cover}
    .photo-initiales{
      font-size:10pt;font-weight:900;
      color:${c1};opacity:.45;letter-spacing:-.03em;
    }
    .carte-infos{flex:1;overflow:hidden}
    .carte-nom{
      font-size:6.5pt;font-weight:900;color:${c1};
      line-height:1.25;margin-bottom:1.5mm;
      word-break:break-word;letter-spacing:.02em;
    }
    .info-ligne{display:flex;align-items:baseline;gap:1mm;margin-bottom:.7mm}
    .info-label{font-size:4pt;color:#999;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
    .info-val{font-size:5pt;color:${c1};font-weight:700}
    .ien{font-family:monospace;color:#3730a3;background:#eef2ff;padding:0 2px;border-radius:1mm}

    /* Pied */
    .carte-footer{
      background:${c1+"0d"};
      border-top:.3mm solid ${c1+"22"};
      padding:1.2mm 2.5mm;
      display:flex;justify-content:space-between;align-items:center;
      flex-shrink:0;
    }
    .footer-left,.footer-right{display:flex;flex-direction:column;align-items:center;gap:.5mm}
    .footer-label{font-size:3.5pt;color:#aaa;text-transform:uppercase;letter-spacing:.06em}
    .footer-ligne{width:16mm;height:.3mm;background:${c1}44}
    .footer-center{display:flex;align-items:center;justify-content:center}
    .qr-wrap{display:flex;flex-direction:column;align-items:center;gap:.5mm}
    .qr-img{width:9mm;height:9mm;image-rendering:pixelated}
    .mat-badge{
      font-family:monospace;font-size:4pt;font-weight:800;
      color:${c1};background:${c2}33;
      padding:.5mm 1.5mm;border-radius:1mm;
      letter-spacing:.08em;
    }

    @media print{
      body{background:#fff;padding:0}
      button{display:none}
    }
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="grille">${eleves.map(carte).join("")}</div>
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
