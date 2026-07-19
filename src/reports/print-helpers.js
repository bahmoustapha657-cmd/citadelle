// ══════════════════════════════════════════════════════════════
//  Helpers d'impression — utilitaires partagés par tous les
//  templates HTML (bulletins, reçus, attestations, livret…)
// ══════════════════════════════════════════════════════════════
// Fonctions pures, sans état React. Réexportés depuis ../reports.js
// pour préserver les imports historiques (`import { PRINT_RESET } from "../reports"`).

import { getNationalDeviseHTML } from "../national-symbols.js";
import { resolveLegalFields } from "../legal-utils.js";
import i18n from "../i18n";

// Helper i18n hors React : raccourci vers i18n.t().
// Fallback sur la clé si i18n n'est pas encore initialisé (cas improbable
// car main.jsx fait `import './i18n'` avant tout rendu).
export const tr = (k, opts) => i18n.t(k, opts);

// Direction d'écriture pour le HTML imprimé (rtl en arabe, ltr sinon).
export const printDir = () => (["ar", "ar-SA", "ar-EG"].includes(i18n.resolvedLanguage || i18n.language) ? "rtl" : "ltr");
export const printLang = () => i18n.resolvedLanguage || i18n.language || "fr";

// ── Responsables de postes sur les documents ────────────────────
// Le prénom + nom du responsable d'un poste (saisi dans Comptes & Postes,
// dénormalisé dans ecoles.extra.responsables par sauverPoste) s'imprime sous
// le titre du bloc de signature. Sans responsable renseigné : titre seul,
// rendu inchangé.
export const responsableNom = (schoolInfo = {}, cle) =>
  String(schoolInfo?.responsables?.[cle] || "").trim();

export const signataireHTML = (schoolInfo, cle, titre) => {
  const nom = responsableNom(schoolInfo, cle);
  return nom
    ? `${titre}<br/><span style="font-size:1.05em;font-weight:800">${nom}</span>`
    : titre;
};

// Supprime les en-têtes / pieds automatiques du navigateur ("about:blank",
// URL, date, n° de page). Force aussi `print-color-adjust:exact` sur tous
// les éléments pour conserver les couleurs des badges, bandeaux et notes
// (sans ça Chrome/Edge basculent en niveaux de gris à l'impression).
// `.no-print` permet de masquer la notice "passer en Couleur" lors de
// l'impression effective.
export const PRINT_RESET = `@page{size:A4 portrait;margin:0}html{color-scheme:light}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}@media print{html,body{margin:0;background:#fff}.no-print{display:none!important}}`;

// Notice insérée en haut de chaque document imprimable. Cachée à
// l'impression réelle (.no-print). Sur Chrome desktop, l'utilisateur
// doit parfois basculer manuellement le paramètre "Couleur" dans le
// dialogue d'impression — sinon le rendu sort en niveaux de gris
// quel que soit le CSS print-color-adjust.
export const PRINT_NOTICE = `<div class="no-print" style="position:fixed;top:8px;left:8px;right:8px;z-index:9999;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#92400e;display:flex;justify-content:space-between;align-items:center;gap:10px"><span><strong>💡 Astuce :</strong> si l'aperçu sort en gris, déplie « Plus de paramètres » et passe « Couleur » sur <strong>Couleur</strong> (Chrome PC met parfois N&amp;B par défaut).</span><button onclick="this.parentNode.style.display='none'" style="background:#92400e;color:#fff;border:0;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px">OK</button></div>`;

// Helper : attend le chargement réel (images + layout) avant de
// déclencher window.print(). Sur PC, Chrome lance parfois print()
// trop tôt et la page sort partiellement (couleurs, images manquantes).
// Inséré dans chaque template via <script>${PRINT_TRIGGER}</script>.
export const PRINT_TRIGGER = `
  (function(){
    function go(){
      var imgs = Array.prototype.slice.call(document.images || []);
      var p = imgs.length === 0 ? Promise.resolve()
        : Promise.all(imgs.map(function(img){
            if (img.complete) return Promise.resolve();
            return new Promise(function(res){ img.onload = res; img.onerror = res; });
          }));
      p.then(function(){ setTimeout(function(){ window.print(); }, 250); });
    }
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
  })();
`;

// Filigrane logo école : injecté dans chaque document imprimable.
// `position: fixed` est traité par le moteur d'impression de Chrome comme un
// élément répétant sur chaque page — c'est ce qu'on veut pour les documents
// multi-pages (bulletins groupés, livret, certificat). `z-index: -1` envoie
// le filigrane derrière tout le contenu sans bloquer la sélection ; on
// compense avec `position: relative` sur les conteneurs principaux quand
// nécessaire (déjà le cas dans les templates existants).
export const WATERMARK_CSS = `
.lc-watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999}
.lc-watermark img{width:55%;max-width:380px;height:auto;object-fit:contain;opacity:.05;transform:rotate(-28deg)}
@media print{.lc-watermark{position:fixed;inset:0}.lc-watermark img{opacity:.06}}
`;

export const watermarkHtml = (schoolInfo = {}) => {
  if (!schoolInfo?.logo) return "";
  return `<div class="lc-watermark" aria-hidden="true"><img src="${schoolInfo.logo}" alt=""/></div>`;
};

export const MINISTERE_DEFAUT = "Ministère de l'Éducation Nationale, de l'Alphabétisation, de l'Enseignement Technique et de la Formation Professionnelle";

// Helpers défensifs : tolèrent null/undefined/"" et chaînes blanches
export const orDefault = (v, def) => (typeof v === "string" && v.trim() ? v : def);

export const enteteDoc = (si = {}, logoUrl) => {
  const pays = orDefault(si.pays, "République de Guinée");
  const lf = resolveLegalFields(si);
  const ministere = orDefault(lf.ministere, MINISTERE_DEFAUT);
  return `
<div style="display:flex;align-items:flex-start;gap:14px;border-bottom:3px solid #0A1628;padding-bottom:12px;margin-bottom:16px">
  <div style="flex:1;font-size:10px;color:#444;line-height:1.8;min-width:0">
    <strong style="font-size:11px;color:#0A1628">${pays}</strong><br/>
    ${getNationalDeviseHTML(si.pays)}<br/>
    <strong>${ministere}</strong><br/>
    ${lf.ire?`${lf.ire}<br/>`:""}
    ${lf.dpe||""}
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    ${logoUrl?`<img src="${logoUrl}" alt="Logo" style="width:78px;height:78px;object-fit:contain"/>`:`<div style="width:78px;height:78px"></div>`}
  </div>
  <div style="flex:1;text-align:right;min-width:0">
    <strong style="display:block;font-size:15px;color:#0A1628;line-height:1.3">${si.nom||""}</strong>
    ${lf.agrement?`<span style="font-size:10px;color:#555">Agrément : ${lf.agrement}</span>`:""}
  </div>
</div>`;
};

// Loaders dynamiques — gardent les modules lourds (xlsx, qrcode) hors
// du bundle initial. Réexportés depuis le barrel pour que les
// sous-modules puissent les utiliser sans dupliquer la fonction.
export const loadXLSX = () => import("xlsx");
export const loadQRCode = async () => (await import("qrcode")).default;

// ── Marque EduGest sur les documents imprimés ──────────────────
// Une seule ligne, discrète et grise : le document reste celui de
// l'ÉCOLE (logo, couleurs), mais chaque bulletin remis à un parent
// devient une carte de visite d'EduGest. Affichée pour tous les plans,
// Premium compris (décision 2026-07).
//
// Lien officiel du site (cohérent avec la balise canonical d'index.html).
export const EDUGEST_SITE = "edugest-gn.pages.dev";

// Petit emblème EduGest inline (badge vert + livre + toque), ~13 px, pour
// l'impression : un SVG inline reste net à toute résolution, sans
// dépendre d'un fichier externe que l'aperçu d'impression ne chargerait pas.
const EDUGEST_LOGO_SVG = `<svg width="13" height="13" viewBox="14 14 132 132" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;flex-shrink:0"><defs><linearGradient id="egb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00DC9C"/><stop offset="1" stop-color="#00916B"/></linearGradient></defs><rect x="20" y="20" width="120" height="120" rx="30" fill="url(#egb)"/><path d="M80 79 C72 71 60 68 47 71 L47 107 C60 104 72 107 80 115 Z" fill="#fff"/><path d="M80 79 C88 71 100 68 113 71 L113 107 C100 104 88 107 80 115 Z" fill="#fff"/><path d="M80 79 L80 115" stroke="#04321F" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/><path d="M80 35 L118 50 L80 65 L42 50 Z" fill="#0F2440"/><circle cx="80" cy="50" r="3" fill="#FFB547"/></svg>`;

export const edugestBrandHTML = () => (
  `<div style="text-align:center;font-size:7.5px;color:#9ca3af;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:0.02em;line-height:1.4">${EDUGEST_LOGO_SVG} Édité avec <strong>EduGest</strong> — la gestion scolaire moderne · <strong>${EDUGEST_SITE}</strong> · edugest26@gmail.com · +224 627 73 85 79</div>`
);
