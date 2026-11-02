// ══════════════════════════════════════════════════════════════
//  Documents d'apparat — ornements vectoriels et typographie
// ══════════════════════════════════════════════════════════════
// Cadre guilloché, rosace, laurier, médaillon, médailles : le style
// « diplôme » partagé par le bulletin Prestige et l'affiche du tableau
// d'honneur. Des SVG en ligne, calculés ici : rien n'est chargé depuis
// Internet, le rendu reste net à toute résolution d'imprimante et lisible
// en noir et blanc (des traits fins, peu d'aplats). Les couleurs passent par
// les variables CSS de la page (--c1 : couleur principale de l'école) ; l'or
// est fixe, il donne le caractère d'apparat quelles que soient les couleurs.

export const OR = "#B08D57";
export const OR_FONCE = "#7a6338";

// Polices installées d'office (Windows, Android, Linux) : aucune n'est
// téléchargée, le document s'imprime pareil hors ligne.
export const SERIF = `"Palatino Linotype","Book Antiqua",Palatino,"URW Palladio L","Noto Serif",Georgia,"Times New Roman",serif`;

const echapper = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

// Sans logo, les initiales de l'école (sans accent) dans un double cercle.
const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "et", "d", "l"]);
export const monogramme = (nom) => {
  const initiales = String(nom || "").split(/[\s'’-]+/)
    .filter((m) => m && !MOTS_VIDES.has(m.toLowerCase()))
    .slice(0, 3).map((m) => m[0].normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()).join("");
  return `<div class="mono">${echapper(initiales || "★")}</div>`;
};

// Filet de sécurité des documents à page fixe : une page qui dépasse encore
// sa feuille malgré les densités CSS (texte très long, beaucoup de lignes)
// voit son bloc `.ajustable` réduit (`zoom`) juste assez pour y tenir, au
// lieu de déborder sur une seconde feuille. Le cadre et les marges, eux, ne
// bougent pas. Toutes les tailles sont fixées en CSS (logo, photo, QR) : la
// mesure est juste dès l'analyse du document, avant le chargement des images.
export const ajusterPagesScript = (selecteurPage, hauteurMm) => `
  (function(){
    var max = ${hauteurMm} * 96 / 25.4 - 1;
    var blocs = document.querySelectorAll("${selecteurPage} .ajustable");
    for (var i = 0; i < blocs.length; i++) {
      var c = blocs[i], page = c.closest("${selecteurPage}"), z = 1;
      c.style.zoom = "";
      while (page.getBoundingClientRect().height > max && z > 0.79) { z -= 0.02; c.style.zoom = z.toFixed(2); }
    }
  })();
`;

const f = (v) => Number(v.toFixed(2));

// Une onde sinusoïdale sur une période, en segments de droite (assez fins
// pour paraître courbes à l'impression).
function onde(largeur, milieu, amplitude, phase) {
  const pas = 24;
  return Array.from({ length: pas + 1 }, (_, i) => {
    const x = (i * largeur) / pas;
    const y = milieu + amplitude * Math.sin((2 * Math.PI * x) / largeur + phase);
    return `${i ? "L" : "M"}${f(x)} ${f(y)}`;
  }).join("");
}

// Motif guilloché d'une bande : trois ondes déphasées entre deux filets,
// comme sur un diplôme ou un billet. `id` unique par sens (h / v).
function motifGuilloche(id, periode, bande, rotation) {
  const m = bande / 2;
  const ondes = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
    .map((p) => `<path d="${onde(periode, m, bande * 0.36, p)}"/>`).join("");
  return `<pattern id="${id}" width="${periode}" height="${bande}" patternUnits="userSpaceOnUse"${rotation ? ` patternTransform="rotate(${rotation})"` : ""}>
    <g fill="none" stroke="var(--c1)" stroke-width=".13">${ondes}</g></pattern>`;
}

// Cadre de page (mm) : filet extérieur à la couleur de l'école, bande
// guillochée, micro-texte de sécurité, filet intérieur doré, médaillons
// d'angle. `microTexte` est déjà échappé.
export function cadreGuilloche({ largeur = 210, hauteur = 297, marge = 6, bande = 2.8, microTexte = "" } = {}) {
  const x0 = marge, y0 = marge, x1 = largeur - marge, y1 = hauteur - marge;
  const b = bande;
  // Micro-texte : une ligne courant le long du cadre, juste à l'intérieur de
  // la bande. Le texte est répété assez pour faire le tour.
  const im = marge + b + 1.15;
  const r = 2.5;
  const chemin = `M${im + r} ${im}H${largeur - im - r}A${r} ${r} 0 0 1 ${largeur - im} ${im + r}V${hauteur - im - r}A${r} ${r} 0 0 1 ${largeur - im - r} ${hauteur - im}H${im + r}A${r} ${r} 0 0 1 ${im} ${hauteur - im - r}V${im + r}A${r} ${r} 0 0 1 ${im + r} ${im}Z`;
  const perimetre = 2 * (largeur + hauteur - 4 * im);
  const motif = microTexte ? `${microTexte} ✦ ` : "";
  // Une lettre fait moins de 0,8 mm : on répète large, le surplus ne
  // s'affiche pas au-delà du chemin.
  const texte = motif ? motif.repeat(Math.ceil(perimetre / (motif.length * 0.55)) + 1) : "";
  const angle = (x, y) => `<g transform="translate(${f(x)} ${f(y)})">
      <rect x="${-b / 2 - .5}" y="${-b / 2 - .5}" width="${b + 1}" height="${b + 1}" fill="#fff" stroke="var(--c1)" stroke-width=".35"/>
      <path d="M0 ${-b / 2 + .2}L${b / 2 - .2} 0L0 ${b / 2 - .2}L${-b / 2 + .2} 0Z" fill="${OR}"/></g>`;
  return `<svg class="cadre" viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="none" aria-hidden="true">
    <defs>${motifGuilloche("orn-gui-h", 4.2, b, 0)}${motifGuilloche("orn-gui-v", 4.2, b, 90)}</defs>
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${b}" fill="url(#orn-gui-h)"/>
    <rect x="${x0}" y="${y1 - b}" width="${x1 - x0}" height="${b}" fill="url(#orn-gui-h)"/>
    <rect x="${x0}" y="${y0}" width="${b}" height="${y1 - y0}" fill="url(#orn-gui-v)"/>
    <rect x="${x1 - b}" y="${y0}" width="${b}" height="${y1 - y0}" fill="url(#orn-gui-v)"/>
    <rect x="${x0 - .5}" y="${y0 - .5}" width="${x1 - x0 + 1}" height="${y1 - y0 + 1}" fill="none" stroke="var(--c1)" stroke-width=".6"/>
    <rect x="${x0 + b}" y="${y0 + b}" width="${x1 - x0 - 2 * b}" height="${y1 - y0 - 2 * b}" fill="none" stroke="var(--c1)" stroke-width=".2"/>
    ${texte ? `<path id="orn-micro" d="${chemin}" fill="none"/><text font-family="Arial,Helvetica,sans-serif" font-size="1.25" letter-spacing=".12" fill="var(--c1)" fill-opacity=".75"><textPath href="#orn-micro">${texte}</textPath></text>` : ""}
    <rect x="${im + .95}" y="${im + .95}" width="${largeur - 2 * im - 1.9}" height="${hauteur - 2 * im - 1.9}" rx="1.6" fill="none" stroke="${OR}" stroke-width=".3"/>
    ${angle(x0 + b / 2, y0 + b / 2)}${angle(x1 - b / 2, y0 + b / 2)}${angle(x0 + b / 2, y1 - b / 2)}${angle(x1 - b / 2, y1 - b / 2)}
  </svg>`;
}

// Rosace guillochée : `n` cercles de rayon `rCercle` centrés sur un cercle de
// rayon `rCentre`. Quelques dizaines d'éléments seulement, très légère.
export function rosace({ n = 36, rCentre = 10, rCercle = 10, couleur = "var(--c1)", epaisseur = 0.12, opacite = 1 } = {}) {
  return `<g fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-opacity="${opacite}">${Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return `<circle cx="${f(rCentre * Math.cos(a))}" cy="${f(rCentre * Math.sin(a))}" r="${rCercle}"/>`;
  }).join("")}</g>`;
}

// Couronne de laurier dorée autour de l'emblème (diamètre `d` en mm).
export function laurier(d = 30) {
  const R = 44, pas = 10;
  const feuilles = [];
  for (const cote of [-1, 1]) {
    for (let i = 0; i < pas; i++) {
      // De bas (90°) vers le haut du côté choisi, en laissant le sommet ouvert.
      const t = 104 + i * 15.5;
      const a = ((cote < 0 ? t : 180 - t) * Math.PI) / 180;
      const x = R * Math.cos(a), y = R * Math.sin(a);
      const tangente = (Math.atan2(Math.cos(a), -Math.sin(a)) * 180) / Math.PI + (cote < 0 ? 0 : 180);
      for (const s of [-1, 1]) {
        const ox = x + s * 4.6 * Math.cos(a), oy = y + s * 4.6 * Math.sin(a);
        feuilles.push(`<ellipse cx="${f(ox)}" cy="${f(oy)}" rx="5.4" ry="1.9" transform="rotate(${f(tangente + s * cote * 32)} ${f(ox)} ${f(oy)})"/>`);
      }
    }
  }
  const tige = (cote) => {
    const a0 = (104 * Math.PI) / 180, a1 = ((104 + (pas - 1) * 15.5) * Math.PI) / 180;
    const p = (a) => (cote < 0 ? [R * Math.cos(a), R * Math.sin(a)] : [-R * Math.cos(a), R * Math.sin(a)]);
    const [xa, ya] = p(a0), [xb, yb] = p(a1);
    return `<path d="M${f(xa)} ${f(ya)}A${R} ${R} 0 0 ${cote < 0 ? 1 : 0} ${f(xb)} ${f(yb)}" fill="none" stroke="${OR}" stroke-width="1"/>`;
  };
  return `<svg class="laurier" width="${d}mm" height="${d}mm" viewBox="-55 -55 110 110" aria-hidden="true">
    ${tige(-1)}${tige(1)}<g fill="${OR}">${feuilles.join("")}</g>
    <path d="M-7 49 L0 44 L7 49 M-4 50 L-9 56 M4 50 L9 56" fill="none" stroke="${OR}" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
}

// Médaillon de la moyenne générale : anneau guilloché, double filet doré.
export function medaillon(d = 34) {
  return `<svg class="medaillon" width="${d}mm" height="${d}mm" viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="49" fill="#fff"/>
    ${rosace({ n: 72, rCentre: 42, rCercle: 6.5, epaisseur: 0.35, opacite: 0.55 })}
    <circle r="48.6" fill="none" stroke="var(--c1)" stroke-width=".8"/>
    <circle r="35" fill="#fff" stroke="${OR}" stroke-width=".9"/>
    <circle r="32.6" fill="none" stroke="${OR}" stroke-width=".35"/>
  </svg>`;
}

// Médaille du podium : ruban à la couleur de l'école, disque en or, argent
// ou bronze selon le rang, rang gravé au centre (lisible en noir et blanc).
const METAUX = [
  { clair: "#F6E3A1", fonce: "#B8871B", texte: "#5c4210" },
  { clair: "#F4F5F7", fonce: "#8E949C", texte: "#3d4248" },
  { clair: "#F2CDA6", fonce: "#A0602E", texte: "#5a3112" },
];
export function medaille(rang, largeur = 16) {
  const k = Math.max(1, Math.min(3, rang)) - 1;
  const m = METAUX[k];
  const petales = Array.from({ length: 24 }, (_, i) => {
    const a = (2 * Math.PI * i) / 24;
    return `<circle cx="${f(37 * Math.cos(a))}" cy="${f(37 * Math.sin(a))}" r="5.4"/>`;
  }).join("");
  return `<svg class="medaille" width="${largeur}mm" height="${f(largeur * 1.32)}mm" viewBox="0 0 100 132" aria-hidden="true">
    <defs><radialGradient id="orn-metal-${k}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${m.clair}"/><stop offset="1" stop-color="${m.fonce}"/></radialGradient></defs>
    <path d="M17 0H39L60 54L45 60Z" fill="var(--c1)"/><path d="M83 0H61L40 54L55 60Z" fill="var(--c1)"/>
    <path d="M28 0L52 57M72 0L48 57" stroke="${OR}" stroke-width="2.2"/>
    <g transform="translate(50 88)">
      <g fill="${m.fonce}">${petales}</g>
      <circle r="37" fill="url(#orn-metal-${k})" stroke="${m.fonce}" stroke-width="1.2"/>
      <circle r="29" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.4"/>
      <text y="13" font-family='${SERIF}' font-size="36" font-weight="700" fill="${m.texte}" text-anchor="middle">${rang}</text>
    </g>
  </svg>`;
}
