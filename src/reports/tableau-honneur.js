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

import { lisibleSur } from "../couleur-lisible.js";
import { today } from "../constants.js";
import {
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  printResetFor,
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

// Budget vertical : A4 paysage moins les marges @page, soit 194 mm ≈ 733 px.
// La version précédente en consommait 778 avec seulement CINQ élèves — les
// deux lignes du tableau tombaient page 2, et le cadre, `position: absolute`
// dans un bloc à cheval sur deux pages, s'étirait sur le vide. D'où deux
// partis pris ici : chaque bloc est mesuré au plus juste (sans toucher à la
// taille des NOMS, qui font tout l'intérêt d'une affiche), et le cadre passe
// en `position: fixed` — traité par le moteur d'impression comme un élément
// qui se répète à l'identique sur chaque page (même mécanique que le
// filigrane, cf. WATERMARK_CSS). Au-delà d'une dizaine d'élèves l'affiche
// déborde donc proprement : cadre entier page 2, en-tête de tableau repris.
const css = (c1, c2) => `${printResetFor("size:A4 landscape;margin:7mm")}
body { font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 0; color: #14181f; }

/* Cadre d'apparat : double filet, comme un diplôme. Répété sur chaque page. */
.cadre { position: fixed; inset: 0; border: 3px double ${c1}; border-radius: 10px; pointer-events: none; z-index: 1; }
.cadre::after { content: ""; position: absolute; inset: 5px; border: 1px solid ${c2}; border-radius: 6px; }
/* Dégagement du filet intérieur (inset 5px) : en dessous de ~12px le texte
   vient buter contre le trait fin et le cadre cesse de faire diplôme. */
.contenu { position: relative; z-index: 2; padding: 14px 20px 12px; }

.titre { text-align: center; margin: 2px 0 0; }
.titre h1 { margin: 0; font-size: 38px; letter-spacing: .10em; color: ${c1}; text-transform: uppercase; line-height: 1.05; }
.titre .filet { width: 190px; height: 3px; background: ${c2}; margin: 6px auto 0; border-radius: 2px; }
.titre .sous { margin-top: 5px; font-size: 16px; color: #4b5563; font-style: italic; }

.podium { display: flex; gap: 18px; justify-content: center; align-items: flex-end; margin: 10px 0 8px; }
.place { flex: 1; max-width: 300px; border: 2px solid #e5e7eb; border-radius: 14px; padding: 10px 12px 12px; text-align: center; background: #fcfdff; }
.place .medaille { font-size: 38px; line-height: 1; }
.place .nom { font-size: 26px; font-weight: 700; margin: 6px 0 3px; color: ${c1}; line-height: 1.15; }
.place .classe { font-size: 14px; color: #6b7280; letter-spacing: .04em; }
.place .moy { font-size: 34px; font-weight: 700; color: ${c2}; margin-top: 6px; line-height: 1; }
.place .bareme { font-size: 13px; color: #9ca3af; font-weight: 400; }
.place .mention { margin-top: 4px; font-size: 14px; color: #374151; font-style: italic; }
/* Le premier : plus haut, plus grand, fond doré. */
.place.premier { max-width: 340px; padding: 14px 14px 16px; border-color: #d4a017; background: #fffdf5; box-shadow: 0 3px 0 #f3e3b3; }
.place.premier .medaille { font-size: 48px; }
.place.premier .nom { font-size: 34px; }
.place.premier .moy { font-size: 44px; }

table { width: 100%; border-collapse: collapse; margin-top: 2px; }
/* Une ligne coupée en deux par un saut de page est illisible ; l'en-tête doit
   se répéter, sinon la page 2 est une colonne de chiffres sans intitulé. */
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { background: ${c1}; color: #fff; padding: 7px 12px; font-size: 13px; text-align: start; letter-spacing: .05em; text-transform: uppercase; font-family: Arial, sans-serif; }
td { padding: 7px 12px; border-bottom: 1px solid #e8ecf1; font-size: 19px; }
td.rang { text-align: center; font-weight: 700; color: ${c2}; width: 64px; }
td.nom { font-weight: 700; color: ${c1}; }
td.moy { text-align: center; font-weight: 700; font-size: 21px; }
td.mention { font-style: italic; color: #4b5563; font-size: 16px; }
tr:nth-child(even) td { background: #f8fafc; }

.pied { margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; }
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
//
// Le barème voyage dans l'EN-TÊTE de la colonne Moyenne (« Moyenne /10 »),
// pas dans les cellules : le primaire et le préscolaire sont notés sur 10, et
// une colonne de « 9.40 » sans repère se lit sur 20 — un parent debout devant
// l'affiche croit son enfant en échec. Les cartes du podium, elles, portent
// déjà le barème chacune.
export function imprimerTableauHonneur(classement = [], schoolInfo = {}, options = {}) {
  if (!classement.length) { alert("Aucun élève classé à afficher."); return; }
  const { periodeLabel = "", portee = "", annee = "", maxNote = 20 } = options;
  const c1 = lisibleSur(schoolInfo.couleur1 || "#0A1628");
  const c2 = lisibleSur(schoolInfo.couleur2 || "#00C48C");
  const podium = classement.slice(0, 3);
  const suite = classement.slice(3);

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>Tableau d'honneur — ${echapper(schoolInfo.nom || "École")}</title>
  <style>${css(c1, c2)}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="cadre"></div>
  <div class="contenu">
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
      <thead><tr><th style="text-align:center">Rang</th><th>Élève</th><th>Classe</th><th style="text-align:center">Moyenne /${maxNote}</th><th>Mention</th></tr></thead>
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
