import { PRINT_TRIGGER, WATERMARK_CSS, printDir, printLang, watermarkHtml } from "../print-helpers.js";
import { getBulletinStyles, getModeleBulletin } from "./bulletin-page.js";

// Ouvre une fenêtre d'impression contenant le document bulletin complet
// (en-tête HTML, styles du modèle choisi par l'école, filigrane, corps
// et déclencheur d'impression). Factorisé entre l'impression
// individuelle et groupée.
export function ouvrirFenetreBulletin({ title, body, schoolInfo = {}, win = null }) {
  // `win` : fenêtre déjà ouverte (sur le geste utilisateur) avant un await QR,
  // pour ne pas se faire bloquer par le navigateur.
  const w = win || window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${getBulletinStyles(getModeleBulletin(schoolInfo))}${WATERMARK_CSS}</style>
  </head><body>${watermarkHtml(schoolInfo)}${body}<script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
}
