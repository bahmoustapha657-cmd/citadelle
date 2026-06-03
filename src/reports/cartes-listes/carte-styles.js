// CSS de la planche de cartes élèves (2/page A4). Paramétré par les deux
// couleurs de l'école ; inclut le reset d'impression et le filigrane.
import { PRINT_RESET, WATERMARK_CSS } from "../print-helpers.js";

export function carteCss({ c1, c2 }) {
  return `
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
      background:${c1 + "22"};
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
      background:${c1 + "0d"};
      border-top:.3mm solid ${c1 + "22"};
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
    ${WATERMARK_CSS}`;
}
