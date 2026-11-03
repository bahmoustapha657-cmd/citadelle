// Image du cachet signé, prête à imprimer.
// Le cachet arrive presque toujours en PHOTO de téléphone : papier gris ou
// beige, ombre légère. Posé tel quel sur un reçu, il imprimerait un rectangle
// grisé autour du tampon. On efface donc le papier (transparent), on garde
// l'encre, on recadre au plus près et on réduit l'image : 600 px suffisent
// largement pour 2 cm imprimés, et l'envoi reste léger sur réseau faible.
// Réglages (MonCachetModale → ReglagesCachet) : lumière, contraste, force de
// l'effacement, encre d'une couleur unie, redressement. Chacun repart de la
// photo décodée une seule fois (chargerCachet), jamais du résultat précédent.
import { TON_MAX, appliquerTons, tableTons } from "../camera-capture/retouche";
import { libererCanvas } from "../camera-capture/photo-capture";

const COTE_MAX = 600;
const MARGE = 6; // px laissés autour de l'encre au recadrage
const CELLULE = 24; // côté des zones où le niveau du papier est mesuré
const BLOC = 14; // côté d'un carré plein qui, au bord, n'est pas un trait d'encre
const ECART_PAPIER = 14; // assez clair à ce point près du papier : effacé
const AUCUN_TRACE = "Aucun tracé trouvé sur l'image : photographiez le cachet de plus près, bien éclairé, ou adoucissez l'effacement du papier.";

export const INCLINAISON_MAX = 15; // degrés, pour redresser une photo prise de biais
// Encre unie : tampon et signature d'une même couleur franche, comme imprimés.
export const COULEURS_ENCRE = [
  { id: "originale", libelle: "D'origine" },
  { id: "bleu", libelle: "Bleu", rgb: [27, 48, 138] },
  { id: "violet", libelle: "Violet", rgb: [86, 38, 152] },
  { id: "noir", libelle: "Noir", rgb: [20, 24, 36] },
];
export const REGLAGES_CACHET = Object.freeze({
  nettoyer: true, // effacer le papier (PNG transparent) ; sinon photo entière (JPEG)
  fond: 0, // force de l'effacement, de -TON_MAX (doux) à +TON_MAX (fort)
  luminosite: 0,
  contraste: 0,
  encre: "originale",
  quart: 0, // quarts de tour
  inclinaison: 0, // degrés, ±INCLINAISON_MAX
});

// Écart au papier en dessous duquel un pixel est effacé : 14 au neutre, de
// 3,5 (doux : garde les traits pâles) à 56 (fort : efface ombres et grisés).
const ecartPapier = (fond) => ECART_PAPIER * 2 ** (Math.max(-TON_MAX, Math.min(TON_MAX, fond)) / 25);

const luminance = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

// Centile `q` d'un histogramme de luminances comptant `n` pixels.
function centile(histo, n, q) {
  let cumul = 0;
  for (let l = 0; l < 256; l += 1) {
    cumul += histo[l];
    if (cumul >= n * q) return l;
  }
  return 255;
}

// Niveau du papier zone par zone : une photo de téléphone n'est jamais
// éclairée uniformément (ombre de la main, dégradé vers un coin). Dans chaque
// zone, le papier est la teinte claire (90e centile) ; chaque zone prend la
// plus claire de ses voisines, pour qu'un trait épais ne passe pas pour du
// papier, et ne descend jamais très en dessous du papier de toute l'image.
function grillePapier(lum, visible, largeur, hauteur) {
  const nx = Math.ceil(largeur / CELLULE);
  const ny = Math.ceil(hauteur / CELLULE);
  const histo = new Uint32Array(256);
  let n = 0;
  for (let p = 0; p < lum.length; p += 1) if (visible[p]) { histo[lum[p]] += 1; n += 1; }
  if (!n) return null;
  const global = centile(histo, n, 0.75);

  const brute = new Float32Array(nx * ny);
  for (let cy = 0; cy < ny; cy += 1) {
    for (let cx = 0; cx < nx; cx += 1) {
      histo.fill(0);
      let k = 0;
      for (let y = cy * CELLULE; y < Math.min(hauteur, (cy + 1) * CELLULE); y += 1) {
        for (let x = cx * CELLULE; x < Math.min(largeur, (cx + 1) * CELLULE); x += 1) {
          const p = y * largeur + x;
          if (visible[p]) { histo[lum[p]] += 1; k += 1; }
        }
      }
      brute[cy * nx + cx] = k ? centile(histo, k, 0.9) : global;
    }
  }
  const grille = new Float32Array(nx * ny);
  for (let cy = 0; cy < ny; cy += 1) {
    for (let cx = 0; cx < nx; cx += 1) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = cx + dx; const y = cy + dy;
          if (x >= 0 && y >= 0 && x < nx && y < ny) v = Math.max(v, brute[y * nx + x]);
        }
      }
      grille[cy * nx + cx] = Math.max(v, global * 0.85);
    }
  }
  // Niveau au pixel (x, y) : interpolation entre les centres des zones.
  return (x, y) => {
    const gx = Math.min(nx - 1, Math.max(0, (x + 0.5) / CELLULE - 0.5));
    const gy = Math.min(ny - 1, Math.max(0, (y + 0.5) / CELLULE - 0.5));
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const x1 = Math.min(nx - 1, x0 + 1); const y1 = Math.min(ny - 1, y0 + 1);
    const fx = gx - x0; const fy = gy - y0;
    const haut = grille[y0 * nx + x0] * (1 - fx) + grille[y0 * nx + x1] * fx;
    const bas = grille[y1 * nx + x0] * (1 - fx) + grille[y1 * nx + x1] * fx;
    return haut * (1 - fy) + bas * fy;
  };
}

// Retire (transparent) ce qui part du bord de la photo sans être de l'encre :
// bureau, bord de la feuille, doigts qui la tiennent devant la webcam. Plus
// sombres que le papier, ils passeraient pour de l'encre et élargiraient le
// recadrage. Une zone opaque est retirée si elle touche le bord en bande (au
// moins un quart du côté) ou en bloc plein (carré de BLOC px) ; un trait de
// cachet ou de signature qui effleure le bord n'est ni l'un ni l'autre.
function retirerBords(px, largeur, hauteur) {
  const total = largeur * hauteur;
  const graines = [];
  const cotes = [
    { n: largeur, p: (i) => i, carre: (i) => [i, 0] },
    { n: largeur, p: (i) => (hauteur - 1) * largeur + i, carre: (i) => [i, hauteur - BLOC] },
    { n: hauteur, p: (i) => i * largeur, carre: (i) => [0, i] },
    { n: hauteur, p: (i) => i * largeur + largeur - 1, carre: (i) => [largeur - BLOC, i] },
  ];
  const opaque = (p) => px[p * 4 + 3] > 128;

  // Bandes : suites de pixels opaques le long d'un côté.
  for (const cote of cotes) {
    let debut = -1;
    for (let i = 0; i <= cote.n; i += 1) {
      if (i < cote.n && opaque(cote.p(i))) { if (debut < 0) debut = i; continue; }
      if (debut >= 0 && i - debut >= cote.n / 4) graines.push(cote.p(debut));
      debut = -1;
    }
  }

  // Blocs pleins : image intégrale des pixels opaques, un carré se teste en
  // quatre lectures.
  if (largeur >= BLOC && hauteur >= BLOC) {
    const l1 = largeur + 1;
    const somme = new Uint32Array(l1 * (hauteur + 1));
    for (let y = 0; y < hauteur; y += 1) {
      let ligne = 0;
      for (let x = 0; x < largeur; x += 1) {
        ligne += opaque(y * largeur + x) ? 1 : 0;
        somme[(y + 1) * l1 + x + 1] = somme[y * l1 + x + 1] + ligne;
      }
    }
    const plein = (x, y) => somme[(y + BLOC) * l1 + x + BLOC] - somme[y * l1 + x + BLOC]
      - somme[(y + BLOC) * l1 + x] + somme[y * l1 + x] === BLOC * BLOC;
    for (const cote of cotes) {
      for (let i = 0; i + BLOC <= cote.n; i += 1) {
        if (plein(...cote.carre(i))) graines.push(cote.p(i));
      }
    }
  }

  // Toute la zone reliée à ces départs, fondu des bords compris.
  const pile = new Int32Array(total);
  let n = 0;
  const pousser = (p) => { if (px[p * 4 + 3] > 32) { px[p * 4 + 3] = 0; pile[n] = p; n += 1; } };
  graines.forEach(pousser);
  while (n) {
    n -= 1;
    const p = pile[n];
    const x = p % largeur;
    if (x > 0) pousser(p - 1);
    if (x < largeur - 1) pousser(p + 1);
    if (p >= largeur) pousser(p - largeur);
    if (p < total - largeur) pousser(p + largeur);
  }
}

// Efface le fond papier de pixels RGBA (modifiés en place). Nettement plus
// clair que l'encre — à une marge près du papier de sa zone : transparent ;
// nettement plus sombre : encre opaque ; entre les deux, un fondu qui garde
// les bords du tracé nets. Ce qui part du bord sans être de l'encre est
// retiré ensuite (retirerBords). `ecart` : voir ecartPapier.
// Renvoie le cadre de l'encre (cadreEncre), ou null si rien ne reste.
export function effacerFondPapier(px, largeur, hauteur, { ecart = ECART_PAPIER } = {}) {
  const total = largeur * hauteur;
  const lum = new Uint8Array(total);
  const visible = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) {
    lum[p] = Math.round(luminance(px, p * 4));
    visible[p] = px[p * 4 + 3] > 0 ? 1 : 0;
  }
  const papierEn = grillePapier(lum, visible, largeur, hauteur);
  if (!papierEn) return null;

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const p = y * largeur + x;
      const papier = papierEn(x, y);
      const haut = papier - ecart; // ≥ : papier → transparent
      const bas = papier * 0.6; // ≤ : encre → opaque
      const l = lum[p];
      const opacite = l >= haut ? 0 : l <= bas ? 1 : (haut - l) / (haut - bas);
      px[p * 4 + 3] = Math.min(px[p * 4 + 3], Math.round(opacite * 255));
    }
  }
  retirerBords(px, largeur, hauteur);
  return cadreEncre(px, largeur, hauteur);
}

// Cadre de l'encre { x, y, l, h } dans des pixels RGBA déjà détourés, marge
// comprise, ou null s'il n'en reste pas. Une ligne ou une colonne n'y compte
// qu'à partir de deux points d'encre : un grain isolé du papier n'élargit pas
// le recadrage.
export function cadreEncre(px, largeur, hauteur) {
  const total = largeur * hauteur;
  const parLigne = new Uint32Array(hauteur);
  const parColonne = new Uint32Array(largeur);
  for (let p = 0; p < total; p += 1) {
    if (px[p * 4 + 3] > 128) { parLigne[Math.floor(p / largeur)] += 1; parColonne[p % largeur] += 1; }
  }
  const bornes = (comptes) => {
    let debut = -1; let fin = -1;
    for (let i = 0; i < comptes.length; i += 1) {
      if (comptes[i] >= 2) { if (debut < 0) debut = i; fin = i; }
    }
    return [debut, fin];
  };
  const [y0, y1] = bornes(parLigne);
  const [x0, x1] = bornes(parColonne);
  if (x0 < 0 || y0 < 0) return null;
  const gauche = Math.max(0, x0 - MARGE); const dessus = Math.max(0, y0 - MARGE);
  const droite = Math.min(largeur - 1, x1 + MARGE); const dessous = Math.min(hauteur - 1, y1 + MARGE);
  return { x: gauche, y: dessus, l: droite - gauche + 1, h: dessous - dessus + 1 };
}

async function chargerImage(fichier) {
  if (typeof createImageBitmap === "function") return createImageBitmap(fichier);
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Lumière, papier et encre appliqués EN PLACE à des pixels RGBA. Renvoie
// false si, le papier effacé, il ne reste aucun tracé.
export function traiterPixels(px, largeur, hauteur, reglages = REGLAGES_CACHET) {
  const r = { ...REGLAGES_CACHET, ...reglages };
  if (r.luminosite || r.contraste) appliquerTons(px, tableTons(r.luminosite, r.contraste));
  if (!r.nettoyer) return true;
  if (!effacerFondPapier(px, largeur, hauteur, { ecart: ecartPapier(r.fond) })) return false;
  // Encre unie : seule la couleur change, l'opacité garde le dessin du trait.
  const couleur = COULEURS_ENCRE.find((c) => c.id === r.encre)?.rgb;
  if (couleur) {
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]) px.set(couleur, i);
  }
  return true;
}

const creerCanvas = (largeur, hauteur) => {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  return canvas;
};

// Fichier choisi ou photo prise → pixels de travail (≤ COTE_MAX), décodés une
// seule fois. Lève une erreur lisible si l'image est illisible.
export async function chargerCachet(fichier) {
  if (!fichier || !/^image\//.test(fichier.type || "")) throw new Error("Choisissez une image (photo ou scan).");
  let image;
  try {
    image = await chargerImage(fichier);
  } catch {
    throw new Error("Image illisible : essayez une autre photo (JPEG ou PNG).");
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.max(1, Math.round(image.width * echelle));
  const hauteur = Math.max(1, Math.round(image.height * echelle));
  const canvas = creerCanvas(largeur, hauteur);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close?.();
  const pixels = ctx.getImageData(0, 0, largeur, hauteur).data;
  libererCanvas(canvas);
  return { largeur, hauteur, pixels };
}

// Canvas tourné de `degres`, agrandi pour ne rien couper ; coins blancs si
// `blanc` (photo gardée entière), transparents sinon.
function tournerCanvas(canvas, degres, blanc) {
  const rad = (degres * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)); const sin = Math.abs(Math.sin(rad));
  const sortie = creerCanvas(
    Math.round(canvas.width * cos + canvas.height * sin),
    Math.round(canvas.width * sin + canvas.height * cos),
  );
  const ctx = sortie.getContext("2d", { willReadFrequently: true });
  if (blanc) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, sortie.width, sortie.height); }
  ctx.translate(sortie.width / 2, sortie.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return sortie;
}

// Pixels de travail + réglages → { url, largeur, hauteur } : PNG transparent
// recadré sur l'encre, ou JPEG de la photo entière si le papier est gardé.
// Lève une erreur lisible s'il ne reste aucun tracé.
export function rendreCachet(source, reglages = REGLAGES_CACHET) {
  const r = { ...REGLAGES_CACHET, ...reglages };
  const px = new Uint8ClampedArray(source.pixels);
  if (!traiterPixels(px, source.largeur, source.hauteur, r)) throw new Error(AUCUN_TRACE);
  const plan = creerCanvas(source.largeur, source.hauteur);
  plan.getContext("2d").putImageData(new ImageData(px, source.largeur, source.hauteur), 0, 0);
  const tourne = tournerCanvas(plan, (((r.quart % 4) + 4) % 4) * 90 + r.inclinaison, !r.nettoyer);
  libererCanvas(plan);

  let zone = { x: 0, y: 0, l: tourne.width, h: tourne.height };
  if (r.nettoyer) {
    // Recadrage APRÈS le redressement : au plus près de l'encre remise droite.
    zone = cadreEncre(tourne.getContext("2d").getImageData(0, 0, tourne.width, tourne.height).data, tourne.width, tourne.height);
    if (!zone) { libererCanvas(tourne); throw new Error(AUCUN_TRACE); }
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(zone.l, zone.h));
  const sortie = creerCanvas(Math.max(1, Math.round(zone.l * echelle)), Math.max(1, Math.round(zone.h * echelle)));
  const ctx = sortie.getContext("2d");
  if (!r.nettoyer) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, sortie.width, sortie.height); }
  ctx.drawImage(tourne, zone.x, zone.y, zone.l, zone.h, 0, 0, sortie.width, sortie.height);
  libererCanvas(tourne);
  const url = r.nettoyer ? sortie.toDataURL("image/png") : sortie.toDataURL("image/jpeg", 0.9);
  const resultat = { url, largeur: sortie.width, hauteur: sortie.height };
  libererCanvas(sortie);
  return resultat;
}
