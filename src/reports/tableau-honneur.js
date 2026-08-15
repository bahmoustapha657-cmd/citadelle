// ══════════════════════════════════════════════════════════════
//  Tableau d'honneur — AFFICHE pour le mur de l'école
// ══════════════════════════════════════════════════════════════
// Ce n'est pas un document de classeur : il sera punaisé dans un couloir et
// lu debout, à deux mètres. D'où les partis pris — A4 PAYSAGE, un podium qui
// occupe le tiers supérieur de la page, des noms en 34 px, et aucune colonne
// technique (ni matricule ni contact). Ce que la direction affiche pour
// féliciter, pas ce qu'elle archive.
//
// Les mentions suivent le BARÈME de la section (getMention) : le primaire et
// le préscolaire sont notés sur 10, des seuils figés sur 20 y auraient
// affiché « Insuffisant » sous le nom d'un excellent élève — sur un mur.

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
import { getMention } from "./bulletins/bulletin-format.js";

const MEDAILLES = ["🥇", "🥈", "🥉"];
// Ordre du podium à l'italienne : 2e à gauche, 1er au centre surélevé, 3e à
// droite. C'est ce que l'œil attend, et le premier ressort sans le dire.
const ORDRE_PODIUM = [1, 0, 2];

const echapper = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

const css = (c1, c2) => `${PRINT_RESET}
@page { size: A4 landscape; margin: 8mm; }
body { font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 6mm 8mm; color: #14181f; }

/* Cadre d'apparat : double filet, comme un diplôme. */
.cadre { border: 3px double ${c1}; border-radius: 10px; padding: 10px 16px 14px; position: relative; }
.cadre::after { content: ""; position: absolute; inset: 5px; border: 1px solid ${c2}; border-radius: 6px; pointer-events: none; }

.titre { text-align: center; margin: 6px 0 2px; }
.titre h1 { margin: 0; font-size: 42px; letter-spacing: .10em; color: ${c1}; text-transform: uppercase; line-height: 1.05; }
.titre .filet { width: 190px; height: 3px; background: ${c2}; margin: 8px auto 0; border-radius: 2px; }
.titre .sous { margin-top: 8px; font-size: 17px; color: #4b5563; font-style: italic; }

.podium { display: flex; gap: 18px; justify-content: center; align-items: flex-end; margin: 18px 0 14px; }
.place { flex: 1; max-width: 300px; border: 2px solid #e5e7eb; border-radius: 14px; padding: 14px 12px 16px; text-align: center; background: #fcfdff; }
.place .medaille { font-size: 46px; line-height: 1; }
.place .nom { font-size: 26px; font-weight: 700; margin: 8px 0 3px; color: ${c1}; line-height: 1.15; }
.place .classe { font-size: 14px; color: #6b7280; letter-spacing: .04em; }
.place .moy { font-size: 34px; font-weight: 700; color: ${c2}; margin-top: 10px; line-height: 1; }
.place .bareme { font-size: 13px; color: #9ca3af; font-weight: 400; }
.place .mention { margin-top: 8px; font-size: 14px; color: #374151; font-style: italic; }
/* Le premier : plus haut, plus grand, fond doré. */
.place.premier { max-width: 340px; padding: 20px 14px 22px; border-color: #d4a017; background: #fffdf5; box-shadow: 0 3px 0 #f3e3b3; }
.place.premier .medaille { font-size: 60px; }
.place.premier .nom { font-size: 34px; }
.place.premier .moy { font-size: 44px; }

table { width: 100%; border-collapse: collapse; margin-top: 4px; }
th { background: ${c1}; color: #fff; padding: 8px 12px; font-size: 13px; text-align: start; letter-spacing: .05em; text-transform: uppercase; font-family: Arial, sans-serif; }
td { padding: 10px 12px; border-bottom: 1px solid #e8ecf1; font-size: 19px; }
td.rang { text-align: center; font-weight: 700; color: ${c2}; width: 64px; }
td.nom { font-weight: 700; color: ${c1}; }
td.moy { text-align: center; font-weight: 700; font-size: 21px; }
td.mention { font-style: italic; color: #4b5563; font-size: 16px; }
tr:nth-child(even) td { background: #f8fafc; }

.pied { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; }
@media print { button { display: none } }
${WATERMARK_CSS}`;

const carte = (e, rang, maxNote) => `
  <div class="place${rang === 0 ? " premier" : ""}">
    <div class="medaille">${MEDAILLES[rang]}</div>
    <div class="nom">${echapper(e.nom)} ${echapper(e.prenom)}</div>
    <div class="classe">${echapper(e.classe)}</div>
    <div class="moy">${e.moyenne.toFixed(2)}<span class="bareme">/${maxNote}</span></div>
    <div class="mention">${getMention(e.moyenne, maxNote)}</div>
  </div>`;

// `classement` : [{ nom, prenom, classe, moyenne }] déjà TRIÉ et limité par
// l'appelant — le calcul des moyennes reste à l'écran, qui connaît les
// matières et la période. Ce module ne fait que mettre en page.
export function imprimerTableauHonneur(classement = [], schoolInfo = {}, options = {}) {
  if (!classement.length) { alert("Aucun élève classé à afficher."); return; }
  const { periodeLabel = "", portee = "", annee = "", maxNote = 20 } = options;
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
  <div class="cadre">
    ${enteteDoc(schoolInfo, schoolInfo.logo)}
    <div class="titre">
      <h1>Tableau d'honneur</h1>
      <div class="filet"></div>
      <div class="sous">${[portee, periodeLabel, annee].filter(Boolean).map(echapper).join(" — ")}</div>
    </div>
    <div class="podium">
      ${ORDRE_PODIUM.filter((r) => podium[r]).map((r) => carte(podium[r], r, maxNote)).join("")}
    </div>
    ${suite.length ? `<table>
      <thead><tr><th style="text-align:center">Rang</th><th>Élève</th><th>Classe</th><th style="text-align:center">Moyenne</th><th>Mention</th></tr></thead>
      <tbody>${suite.map((e, i) => `<tr>
        <td class="rang">${i + 4}<sup>e</sup></td>
        <td class="nom">${echapper(e.nom)} ${echapper(e.prenom)}</td>
        <td>${echapper(e.classe)}</td>
        <td class="moy">${e.moyenne.toFixed(2)}</td>
        <td class="mention">${getMention(e.moyenne, maxNote)}</td>
      </tr>`).join("")}</tbody>
    </table>` : ""}
    <div class="pied">
      <span>${classement.length} élève(s) à l'honneur — moyennes sur ${maxNote}</span>
      <span>Affiché le ${today()}</span>
      <span>La Direction</span>
    </div>
  </div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
}
