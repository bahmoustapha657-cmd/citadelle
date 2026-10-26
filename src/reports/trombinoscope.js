// ══════════════════════════════════════════════════════════════
//  Trombinoscope de classe + badges de maternelle
// ══════════════════════════════════════════════════════════════
// Pour reconnaître les enfants qui ne connaissent pas leur nom (voir
// identite-enfant.js) :
//  • trombinoscope : une feuille A4 par classe (20 enfants par page), à
//    afficher dans la classe ou à confier à une remplaçante ;
//  • badges : 9 par page A4 (62 × 90 mm), à découper, plastifier, porter en
//    collier ou coller sur le sac, le casier, le porte-manteau.
// En gros : le nom d'appel (surnom, sinon prénom) ; dessous : le nom officiel.
// Aucun téléphone sur un badge : porté par un enfant, il se lit dans la rue.

import {
  aUnePhoto, couleurClasse, grouperParClasse, initiales, nomAppel, nomOfficiel,
} from "../identite-enfant.js";
import { PRINT_NOTICE, PRINT_TRIGGER, printResetFor } from "./print-helpers.js";

// Noms et surnoms sont saisis à la main : un « < » ou un « & » ne doit ni
// casser la page ni y injecter de balise.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decouper = (liste, taille) => {
  const paquets = [];
  for (let i = 0; i < liste.length; i += taille) paquets.push(liste.slice(i, i + taille));
  return paquets;
};

const photoOuInitiales = (eleve, couleur) => (aUnePhoto(eleve)
  ? `<img crossOrigin="anonymous" src="${echapper(eleve.photo)}" alt=""/>`
  : `<div class="sans-photo" style="background:${couleur}1f;color:${couleur}"><strong>${echapper(initiales(eleve))}</strong><span>Photo à prendre</span></div>`);

const pageHtml = (titre, pageCss, styles, corps) => `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"/><title>${echapper(titre)}</title>
<style>${printResetFor(pageCss)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff}
@media screen{body{background:#e2e8f0;padding:12mm 0}}
${styles}</style></head><body>
${PRINT_NOTICE}
${corps}
<script>${PRINT_TRIGGER}</script>
</body></html>`;

// ── Trombinoscope ────────────────────────────────────────────

export const TROMBI_PAR_PAGE = 20;

const TROMBI_CSS = `
.page{width:190mm;margin:0 auto;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
@media screen{.page{width:210mm;min-height:297mm;padding:10mm;background:#fff;margin-bottom:8mm;box-shadow:0 2px 10px rgba(0,0,0,.15)}}
.entete{display:flex;align-items:center;gap:4mm;border-bottom:1.2mm solid;padding-bottom:2.5mm;margin-bottom:3mm}
.entete img{height:11mm;width:11mm;object-fit:contain}
.ecole{flex:1;min-width:0}
.ecole strong{display:block;font-size:13pt}
.ecole span{font-size:8.5pt;color:#475569}
.classe{color:#fff;font-weight:900;font-size:15pt;padding:2mm 4mm;border-radius:2mm;white-space:nowrap}
.effectif{font-size:8pt;color:#475569;text-align:end;white-space:nowrap}
.grille{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm}
.enfant{break-inside:avoid;text-align:center}
.photo{aspect-ratio:6/7;border-radius:2mm;overflow:hidden;border:.6mm solid;background:#f8fafc}
.photo img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
.sans-photo{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm}
.sans-photo strong{font-size:20pt}
.sans-photo span{font-size:7pt;font-weight:700}
/* Deux lignes au plus : 4 rangées de 5 tiennent sur la page même avec des
   noms longs (« Mamadou Saliou »). */
.appel,.officiel{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.appel{font-size:11.5pt;font-weight:900;margin-top:1.2mm;line-height:1.15}
.officiel{font-size:7.5pt;color:#475569;line-height:1.2}
.legende{margin-top:3mm;font-size:7.5pt;color:#64748b;text-align:center}
`;

const ficheTrombi = (eleve, couleur) => `<div class="enfant">
  <div class="photo" style="border-color:${couleur}">${photoOuInitiales(eleve, couleur)}</div>
  <div class="appel">${echapper(nomAppel(eleve))}</div>
  <div class="officiel">${echapper(nomOfficiel(eleve))}</div>
</div>`;

export function trombinoscopeHTML(eleves = [], { schoolInfo = {}, annee = "", parPage = TROMBI_PAR_PAGE } = {}) {
  const nomEcole = schoolInfo.nom || "École";
  const pages = grouperParClasse(eleves).flatMap(([classe, enfants]) => {
    const couleur = couleurClasse(classe, schoolInfo.couleur1 || "#0A1628");
    const paquets = decouper(enfants, parPage);
    return paquets.map((paquet, i) => `<div class="page">
  <div class="entete" style="border-color:${couleur}">
    ${schoolInfo.logo ? `<img crossOrigin="anonymous" src="${echapper(schoolInfo.logo)}" alt=""/>` : ""}
    <div class="ecole"><strong>${echapper(nomEcole)}</strong><span>Trombinoscope${annee ? ` · ${echapper(annee)}` : ""}${schoolInfo.ville ? ` · ${echapper(schoolInfo.ville)}` : ""}</span></div>
    <div class="classe" style="background:${couleur}">${echapper(classe)}</div>
    <div class="effectif">${enfants.length} enfant${enfants.length > 1 ? "s" : ""}${paquets.length > 1 ? `<br/>page ${i + 1}/${paquets.length}` : ""}</div>
  </div>
  <div class="grille">${paquet.map((eleve) => ficheTrombi(eleve, couleur)).join("")}</div>
  <div class="legende">En gros : le nom auquel l'enfant répond (son surnom s'il est renseigné). Dessous : son nom officiel.</div>
</div>`);
  });
  return pageHtml(`Trombinoscope — ${nomEcole}`, "size:A4 portrait;margin:10mm", TROMBI_CSS, pages.join(""));
}

// ── Badges ───────────────────────────────────────────────────

export const BADGES_PAR_PAGE = 9;

const BADGES_CSS = `
.page{display:grid;grid-template-columns:repeat(3,62mm);grid-auto-rows:90mm;gap:4mm;justify-content:center;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
@media screen{.page{width:210mm;min-height:297mm;padding:6mm;margin:0 auto 8mm;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15);align-content:start}}
.badge{border:.3mm dashed #94a3b8;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;align-items:center;background:#fff;break-inside:avoid}
.bandeau{width:100%;color:#fff;text-align:center;padding:1.6mm 2mm}
.bandeau .ecole{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bandeau .classe{font-size:10pt;font-weight:900}
.photo{width:42mm;height:50mm;margin-top:3mm;border-radius:2.5mm;overflow:hidden;border:.8mm solid;background:#f8fafc}
.photo img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
.sans-photo{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm}
.sans-photo strong{font-size:24pt}
.sans-photo span{font-size:7pt;font-weight:700}
.appel{font-weight:900;line-height:1.05;margin-top:2mm;padding:0 2mm;text-align:center;overflow-wrap:anywhere}
.officiel{font-size:7.5pt;color:#475569;margin-top:.8mm;padding:0 2mm;text-align:center;line-height:1.2;overflow-wrap:anywhere}
.annee{margin-top:auto;font-size:6pt;color:#94a3b8;padding-bottom:1.5mm}
`;

// Le nom d'appel doit rester sur une ou deux lignes de 58 mm.
export const taillePoliceAppel = (nom = "") => {
  const n = String(nom).length;
  return n <= 8 ? 22 : n <= 12 ? 18 : n <= 18 ? 14 : 11;
};

const badge = (eleve, { schoolInfo, annee }) => {
  const couleur = couleurClasse(eleve.classe, schoolInfo.couleur1 || "#0A1628");
  const appel = nomAppel(eleve);
  return `<div class="badge">
  <div class="bandeau" style="background:${couleur}">
    <div class="ecole">${echapper(schoolInfo.nom || "École")}</div>
    <div class="classe">${echapper(eleve.classe || "")}</div>
  </div>
  <div class="photo" style="border-color:${couleur}">${photoOuInitiales(eleve, couleur)}</div>
  <div class="appel" style="font-size:${taillePoliceAppel(appel)}pt;color:${couleur}">${echapper(appel)}</div>
  <div class="officiel">${echapper(nomOfficiel(eleve))}</div>
  ${annee ? `<div class="annee">${echapper(annee)}</div>` : ""}
</div>`;
};

export function badgesHTML(eleves = [], { schoolInfo = {}, annee = "" } = {}) {
  const ordre = grouperParClasse(eleves).flatMap(([, enfants]) => enfants);
  const pages = decouper(ordre, BADGES_PAR_PAGE)
    .map((paquet) => `<div class="page">${paquet.map((eleve) => badge(eleve, { schoolInfo, annee })).join("")}</div>`);
  return pageHtml(`Badges — ${schoolInfo.nom || "École"}`, "size:A4 portrait;margin:6mm", BADGES_CSS, pages.join(""));
}

// ── Impression ───────────────────────────────────────────────

const imprimer = (html, vide) => {
  if (!html) { alert(vide); return; }
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour imprimer."); return; }
  w.document.write(html);
  w.document.close();
};

export const imprimerTrombinoscope = (eleves = [], options = {}) =>
  imprimer(eleves.length ? trombinoscopeHTML(eleves, options) : "", "Aucun enfant à imprimer.");

export const imprimerBadges = (eleves = [], options = {}) =>
  imprimer(eleves.length ? badgesHTML(eleves, options) : "", "Aucun enfant à imprimer.");
