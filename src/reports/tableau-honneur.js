// ══════════════════════════════════════════════════════════════
//  Tableau d'honneur — AFFICHE pour le mur de l'école
// ══════════════════════════════════════════════════════════════
// Ce n'est pas un document de classeur : il sera punaisé dans un couloir et
// lu debout, à un mètre. D'où les partis pris — A4 PAYSAGE, noms en très
// grand, podium détaché du reste, aucune colonne technique (matricule,
// contact). Ce que la direction imprime pour féliciter, pas pour archiver.
//
// L'en-tête officiel (pays, ministère, école) est conservé : l'affiche a
// valeur institutionnelle et se retrouve souvent photographiée.

import { today } from "../constants.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  watermarkHtml,
} from "./print-helpers.js";

const MEDAILLES = ["🥇", "🥈", "🥉"];

const mentionDe = (moy) => (moy >= 16 ? "Très Bien"
  : moy >= 14 ? "Bien"
    : moy >= 12 ? "Assez Bien"
      : moy >= 10 ? "Passable" : "Insuffisant");

const echapper = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

const css = (c1, c2) => `${PRINT_RESET}
@page { size: A4 landscape; margin: 10mm; }
body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 8mm 10mm; color: #111; }
.titre { text-align: center; margin: 10px 0 4px; }
.titre h1 { margin: 0; font-size: 30px; letter-spacing: .06em; color: ${c1}; text-transform: uppercase; }
.titre .sous { margin-top: 4px; font-size: 15px; color: ${c2}; font-weight: 700; }
.podium { display: flex; gap: 14px; justify-content: center; align-items: stretch; margin: 16px 0 14px; }
.podium .place { flex: 1; max-width: 260px; border: 3px solid ${c2}; border-radius: 14px; padding: 12px 10px; text-align: center; }
.podium .place.or { border-color: #d97706; background: #fffbeb; }
.podium .medaille { font-size: 40px; line-height: 1; }
.podium .nom { font-size: 20px; font-weight: 900; margin: 6px 0 2px; color: ${c1}; }
.podium .classe { font-size: 13px; color: #555; }
.podium .moy { font-size: 26px; font-weight: 900; color: ${c2}; margin-top: 6px; }
.podium .mention { font-size: 12px; color: #555; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { background: ${c1}; color: #fff; padding: 8px 10px; font-size: 13px; text-align: start; }
td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; font-size: 16px; }
td.rang { text-align: center; font-weight: 900; color: ${c2}; width: 60px; }
td.nom { font-weight: 800; }
td.moy { text-align: center; font-weight: 900; font-size: 18px; }
tr:nth-child(even) td { background: #f7fafc; }
.pied { margin-top: 14px; display: flex; justify-content: space-between; font-size: 12px; color: #555; }
@media print { button { display: none } }
${WATERMARK_CSS}`;

const carte = (e, i) => `
  <div class="place${i === 0 ? " or" : ""}">
    <div class="medaille">${MEDAILLES[i]}</div>
    <div class="nom">${echapper(e.nom)} ${echapper(e.prenom)}</div>
    <div class="classe">${echapper(e.classe)}</div>
    <div class="moy">${e.moyenne.toFixed(2)}</div>
    <div class="mention">${mentionDe(e.moyenne)}</div>
  </div>`;

// `classement` : [{ _id, nom, prenom, classe, moyenne }] déjà TRIÉ et limité
// par l'appelant — le calcul des moyennes reste à l'écran, qui connaît les
// matières et la période. Ce module ne fait que mettre en page.
export function imprimerTableauHonneur(classement = [], schoolInfo = {}, options = {}) {
  if (!classement.length) { alert("Aucun élève classé à afficher."); return; }
  const { periodeLabel = "", portee = "", annee = "" } = options;
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const podium = classement.slice(0, 3);
  const suite = classement.slice(3);

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>Tableau d'honneur — ${echapper(schoolInfo.nom || "École")}</title>
  <style>${css(c1, c2)}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <div class="titre">
    <h1>🏆 Tableau d'honneur</h1>
    <div class="sous">${[portee, periodeLabel, annee].filter(Boolean).map(echapper).join(" · ")}</div>
  </div>
  <div class="podium">${podium.map(carte).join("")}</div>
  ${suite.length ? `<table>
    <thead><tr><th style="text-align:center">Rang</th><th>Élève</th><th>Classe</th><th style="text-align:center">Moyenne</th><th>Mention</th></tr></thead>
    <tbody>${suite.map((e, i) => `<tr>
      <td class="rang">${i + 4}</td>
      <td class="nom">${echapper(e.nom)} ${echapper(e.prenom)}</td>
      <td>${echapper(e.classe)}</td>
      <td class="moy">${e.moyenne.toFixed(2)}</td>
      <td>${mentionDe(e.moyenne)}</td>
    </tr>`).join("")}</tbody>
  </table>` : ""}
  <div class="pied">
    <span>${classement.length} élève(s) à l'honneur</span>
    <span>Affiché le ${today()}</span>
    <span>La Direction</span>
  </div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
}
