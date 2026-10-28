// ══════════════════════════════════════════════════════════════
//  Trombinoscope de classe + badges des élèves
// ══════════════════════════════════════════════════════════════
// Pour reconnaître les enfants qui ne connaissent pas leur nom (voir
// identite-enfant.js) :
//  • trombinoscope : une feuille A4 par classe (20 enfants par page), à
//    afficher dans la classe ou à confier à une remplaçante ;
//  • badges, pour toutes les classes : écusson de poche pour la tenue, ou
//    badge portrait à plastifier (voir plus bas).
// En gros : le nom d'appel (surnom, sinon prénom) ; dessous : le nom officiel.
// Aucun téléphone sur un badge : porté par un enfant, il se lit dans la rue.

import {
  aUnePhoto, couleurClasse, grouperParClasse, identifiantBadge, initiales, nomAppel, nomOfficiel,
} from "../identite-enfant.js";
import { EDUGEST_SITE, PRINT_NOTICE, PRINT_TRIGGER, edugestEmbleme, printResetFor } from "./print-helpers.js";

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
// Deux formats, pour toutes les classes :
//  • « poche » : écusson horizontal de 80 × 60 mm, à la taille d'une poche
//    de chemise, 8 par page A4 ;
//  • « portrait » : 62 × 90 mm, le badge d'origine de la maternelle, à
//    plastifier et porter en collier, 9 par page.
// Sous le nom : l'IEN de l'élève, ou à défaut son matricule (identifiantBadge).
// Photo au choix ; sans photo, le logo de l'école s'affiche en grand à sa
// place (et plus dans l'en-tête). En haut, le nom de l'école ; en pied, une ligne
// « Édité avec EduGest · site » : petite, mais lisible et parlante (sans
// téléphone ni e-mail, comme partout sur le badge). « Miroir » : pour le
// papier transfert textile (tissu clair), chaque badge s'imprime inversé et
// se retrouve à l'endroit une fois repassé.

// Dimensions en taille normale (mm) ; marge de la page A4.
export const FORMATS_BADGE = {
  poche: { largeur: 80, hauteur: 60, marge: 8, nom: "Écusson de poche" },
  portrait: { largeur: 62, hauteur: 90, marge: 6, nom: "Badge portrait" },
};

// Taille d'impression : le badge entier (photo, logo, textes) à l'échelle,
// pour une poche plus petite ; plus de badges tiennent alors sur la page.
export const TAILLES_BADGE = {
  normale: { echelle: 1, nom: "Normale" },
  reduite: { echelle: 0.85, nom: "Réduite (−15 %)" },
  petite: { echelle: 0.75, nom: "Petite (−25 %)" },
};
const ECART_BADGES = 4;

// Grille d'une page A4 pour un format et une taille : dimensions du badge
// imprimé (mm, au dixième), colonnes, rangées, badges par page.
export function grilleBadges(format = "portrait", taille = "normale") {
  const f = FORMATS_BADGE[format] || FORMATS_BADGE.portrait;
  const { echelle } = TAILLES_BADGE[taille] || TAILLES_BADGE.normale;
  const largeur = Math.round(f.largeur * echelle * 10) / 10;
  const hauteur = Math.round(f.hauteur * echelle * 10) / 10;
  const place = (page, cote) => Math.max(1, Math.floor((page - 2 * f.marge + ECART_BADGES) / (cote + ECART_BADGES)));
  const colonnes = place(210, largeur);
  const rangees = place(297, hauteur);
  return { echelle, largeur, hauteur, colonnes, rangees, parPage: colonnes * rangees };
}
export const BADGES_PAR_PAGE = grilleBadges("portrait").parPage;

const BADGES_CSS = `
.page{display:grid;gap:4mm;justify-content:center;align-content:start;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
@media screen{.page{width:210mm;min-height:297mm;padding:6mm;margin:0 auto 8mm;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15)}}
/* Chaque case de la grille reçoit le badge dessiné en taille normale
   (--w × --h), réduit d'un bloc (--k) : tout garde ses proportions. */
.case{position:relative;break-inside:avoid}
.badge{position:absolute;left:50%;top:50%;width:var(--w);height:var(--h);transform:translate(-50%,-50%) scale(var(--k,1));border:.3mm dashed #94a3b8;border-radius:3mm;overflow:hidden;display:flex;background:#fff}
.miroir .badge{transform:translate(-50%,-50%) scale(calc(-1 * var(--k,1)),var(--k,1))}
.logo{background:#fff;border-radius:1.5mm;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.logo img{width:100%;height:100%;object-fit:contain;display:block}
.photo{border-radius:2.5mm;overflow:hidden;background:#f8fafc;flex-shrink:0}
.photo img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
.sans-photo{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm}
.sans-photo strong{font-size:22pt}
.sans-photo span{font-size:7pt;font-weight:700}
.appel{font-weight:900;line-height:1.05;overflow-wrap:anywhere}
.officiel{font-size:7.5pt;color:#475569;line-height:1.2;overflow-wrap:anywhere}
.ident{font-size:7pt;color:#334155;letter-spacing:.02em;overflow-wrap:anywhere}
.ident strong{font-weight:900;font-family:"Courier New",monospace;font-size:7.5pt}
.ecole{font-weight:800;text-transform:uppercase;letter-spacing:.03em;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.marque{position:absolute;left:0;right:0;bottom:.9mm;display:flex;align-items:center;justify-content:center;gap:.8mm;font-size:5.5pt;color:#64748b;letter-spacing:.01em;white-space:nowrap}
.marque svg{width:3mm;height:3mm}
.marque strong{color:#00916B;font-weight:900}
.portrait{flex-direction:column;align-items:center}
.portrait .bandeau{width:100%;color:#fff;display:flex;align-items:center;gap:1.6mm;padding:1.4mm 2mm}
.portrait .bandeau .logo{width:8mm;height:8mm}
.portrait .bandeau .titre{flex:1;min-width:0;text-align:center}
.portrait .bandeau .ecole{font-size:6.2pt}
.portrait .bandeau .classe{font-size:10pt;font-weight:900}
.portrait .photo{width:42mm;height:44mm;margin-top:2mm;border:.8mm solid}
.portrait .grand-logo{width:38mm;height:38mm;margin-top:4mm}
.portrait .appel{margin-top:2mm;padding:0 2mm;text-align:center}
.portrait .officiel{margin-top:.8mm;padding:0 2mm;text-align:center}
.portrait .ident{margin-top:.5mm;padding:0 2mm;text-align:center}
.portrait .annee{margin-top:auto;font-size:6pt;color:#94a3b8;padding-bottom:4.6mm}
.poche{flex-direction:column}
.poche .tete{display:flex;align-items:center;gap:2mm;padding:1.6mm 2.4mm;color:#fff}
.poche .tete .logo{width:10mm;height:10mm}
.poche .tete .ecole{font-size:7pt;flex:1;min-width:0}
.poche .corps{flex:1;min-height:0;display:flex;align-items:center;gap:3mm;padding:1.6mm 3mm 4.6mm}
.poche .photo{width:26mm;height:32mm;border:.6mm solid}
.poche .grand-logo{width:30mm;height:30mm}
.poche .texte{flex:1;min-width:0;display:flex;flex-direction:column;gap:1.2mm}
.poche .infos{display:flex;align-items:center;flex-wrap:wrap;gap:1.5mm;font-size:7pt;color:#64748b}
.poche .classe{color:#fff;font-weight:900;font-size:8.5pt;border-radius:1.5mm;padding:.5mm 2mm}
.avis{max-width:194mm;margin:0 auto 6mm;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;font-size:11px;color:#1e3a8a}
`;

// Le nom d'appel doit rester sur une ou deux lignes de la largeur donnée
// (58 mm : badge portrait).
export const taillePoliceAppel = (nom = "", largeurMm = 58) => {
  const n = String(nom).length;
  const base = n <= 8 ? 22 : n <= 12 ? 18 : n <= 18 ? 14 : 11;
  return Math.max(9, Math.round(base * Math.min(1, largeurMm / 58)));
};

const ligneIdentifiant = (eleve) => {
  const id = identifiantBadge(eleve);
  return id ? `<div class="ident">${id.libelle} <strong>${echapper(id.valeur)}</strong></div>` : "";
};

const logoEcole = (schoolInfo, classe = "logo") => (schoolInfo.logo
  ? `<div class="${classe}"><img crossOrigin="anonymous" src="${echapper(schoolInfo.logo)}" alt=""/></div>`
  : "");

const marqueEdugest = () => `<div class="marque">${edugestEmbleme(12)}<span>Édité avec <strong>EduGest</strong> · ${EDUGEST_SITE}</span></div>`;

// La photo de l'élève ou, sans photo, le logo de l'école en grand (s'il
// existe) : dans l'en-tête, le logo ne reste qu'à côté d'une photo.
const visuel = (eleve, schoolInfo, photo, couleur) => (photo
  ? `<div class="photo" style="border-color:${couleur}">${photoOuInitiales(eleve, couleur)}</div>`
  : logoEcole(schoolInfo, "logo grand-logo"));

const badgePortrait = (eleve, { schoolInfo, annee, photo }) => {
  const couleur = couleurClasse(eleve.classe, schoolInfo.couleur1 || "#0A1628");
  const appel = nomAppel(eleve);
  return `<div class="badge portrait">
  <div class="bandeau" style="background:${couleur}">
    ${photo ? logoEcole(schoolInfo) : ""}
    <div class="titre"><div class="ecole">${echapper(schoolInfo.nom || "École")}</div><div class="classe">${echapper(eleve.classe || "")}</div></div>
  </div>
  ${visuel(eleve, schoolInfo, photo, couleur)}
  <div class="appel" style="font-size:${taillePoliceAppel(appel) + (photo ? 0 : 4)}pt;color:${couleur}">${echapper(appel)}</div>
  <div class="officiel">${echapper(nomOfficiel(eleve))}</div>
  ${ligneIdentifiant(eleve)}
  ${annee ? `<div class="annee">${echapper(annee)}</div>` : ""}
  ${marqueEdugest()}
</div>`;
};

const badgePoche = (eleve, { schoolInfo, annee, photo }) => {
  const couleur = couleurClasse(eleve.classe, schoolInfo.couleur1 || "#0A1628");
  const appel = nomAppel(eleve);
  return `<div class="badge poche">
  <div class="tete" style="background:${couleur}">
    ${photo ? logoEcole(schoolInfo) : ""}
    <div class="ecole">${echapper(schoolInfo.nom || "École")}</div>
  </div>
  <div class="corps">
    ${visuel(eleve, schoolInfo, photo, couleur)}
    <div class="texte">
      <div class="appel" style="font-size:${taillePoliceAppel(appel, photo ? 45 : schoolInfo.logo ? 41 : 70)}pt;color:${couleur}">${echapper(appel)}</div>
      <div class="officiel">${echapper(nomOfficiel(eleve))}</div>
      ${ligneIdentifiant(eleve)}
      <div class="infos">${eleve.classe ? `<span class="classe" style="background:${couleur}">${echapper(eleve.classe)}</span>` : ""}${annee ? `<span>${echapper(annee)}</span>` : ""}</div>
    </div>
  </div>
  ${marqueEdugest()}
</div>`;
};

// `format` : "poche" ou "portrait" ; `taille` : "normale", "reduite" ou
// "petite" (TAILLES_BADGE) ; `photo` : avec la photo de l'élève ; `miroir` :
// impression inversée pour le papier transfert.
export function badgesHTML(eleves = [], {
  schoolInfo = {}, annee = "", format = "portrait", taille = "normale", photo = true, miroir = false,
} = {}) {
  const f = FORMATS_BADGE[format] || FORMATS_BADGE.portrait;
  const g = grilleBadges(format, taille);
  const dessiner = f === FORMATS_BADGE.poche ? badgePoche : badgePortrait;
  const ordre = grouperParClasse(eleves).flatMap(([, enfants]) => enfants);
  const grille = `grid-template-columns:repeat(${g.colonnes},${g.largeur}mm);grid-auto-rows:${g.hauteur}mm;`
    + `--w:${f.largeur}mm;--h:${f.hauteur}mm;--k:${g.echelle}`;
  const pages = decouper(ordre, g.parPage)
    .map((paquet) => `<div class="page" style="${grille}">${paquet.map((eleve) => `<div class="case">${dessiner(eleve, { schoolInfo, annee, photo })}</div>`).join("")}</div>`);
  const avis = miroir
    ? `<div class="avis no-print">🔁 Impression en <strong>miroir</strong> pour papier transfert sur tissu clair : le texte apparaît à l'envers ici, il sera à l'endroit une fois repassé. Faites d'abord un essai sur une feuille ordinaire.</div>`
    : "";
  return pageHtml(`Badges — ${schoolInfo.nom || "École"}`, `size:A4 portrait;margin:${f.marge}mm`, BADGES_CSS,
    `${avis}<div class="${miroir ? "miroir" : "endroit"}">${pages.join("")}</div>`);
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
