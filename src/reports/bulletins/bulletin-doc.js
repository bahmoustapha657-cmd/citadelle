import { PRINT_TRIGGER, WATERMARK_CSS, printDir, printLang, watermarkHtml } from "../print-helpers.js";
import { getBulletinStyles } from "./bulletin-page.js";

// Ouvre une fenêtre d'impression contenant le document bulletin complet
// (en-tête HTML, styles, filigrane, corps et déclencheur d'impression).
// Factorisé entre l'impression individuelle et groupée.
export function ouvrirFenetreBulletin({ title, body, schoolInfo = {} }) {
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${getBulletinStyles()}${WATERMARK_CSS}</style>
  </head><body>${watermarkHtml(schoolInfo)}${body}<script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
}
