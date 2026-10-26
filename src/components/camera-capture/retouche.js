// Retouche d'une photo d'élève déjà prise — logique pure, sans DOM (testée
// dans tests/retouche.test.js) : cadrage (quart de tour, zoom, déplacement,
// recentrage sur le visage), lumière (luminosité, contraste, réglage
// automatique) et mémoire de la retouche dans la fiche. Le rendu des pixels
// est dans rendu-retouche.js, l'écran dans RetouchePhoto.jsx.
import { FORMAT_PHOTO, calculerRecadrage } from "./photo-framing.js";
import { CONTOUR_MAX, CONTOUR_MIN, FOND_ORIGINAL, normaliserCouleur } from "./fond-photo.js";

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const nombre = (v, parDefaut) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : parDefaut);
const arrondi = (v, decimales = 4) => Math.round(v * 10 ** decimales) / 10 ** decimales;

// Zoom jusqu'à ×4 : au-delà, une photo de 768 px de large n'a plus assez de
// détail pour un visage net.
export const ZOOM_MAX = 4;
// Luminosité et contraste : de -50 à +50.
export const TON_MAX = 50;

export const REGLAGES_NEUTRES = Object.freeze({
  rotation: 0, zoom: 1, cx: 0.5, cy: 0.5, luminosite: 0, contraste: 0, fond: FOND_ORIGINAL, contour: 0,
});

// Réglages lus d'une fiche ou d'un curseur : bornés, rotation en quarts de tour.
export function normaliserReglages(r = {}) {
  const quart = Math.round(nombre(r.rotation, 0) / 90) * 90;
  return {
    rotation: ((quart % 360) + 360) % 360,
    zoom: arrondi(borner(nombre(r.zoom, 1), 1, ZOOM_MAX)),
    cx: arrondi(borner(nombre(r.cx, 0.5), 0, 1)),
    cy: arrondi(borner(nombre(r.cy, 0.5), 0, 1)),
    luminosite: Math.round(borner(nombre(r.luminosite, 0), -TON_MAX, TON_MAX)),
    contraste: Math.round(borner(nombre(r.contraste, 0), -TON_MAX, TON_MAX)),
    fond: normaliserCouleur(r.fond) || FOND_ORIGINAL,
    contour: Math.round(borner(nombre(r.contour, 0), CONTOUR_MIN, CONTOUR_MAX)),
  };
}

// ── Cadrage ─────────────────────────────────────────────────────────────────
// Mesures en pixels de l'image TOURNÉE ; centre (cx, cy) en fractions de
// celle-ci.

export const dimensionsTournees = (largeur, hauteur, rotation = 0) => (rotation % 180
  ? { largeur: hauteur, hauteur: largeur }
  : { largeur, hauteur });

// Cadre 3:4 de la photo retouchée : au zoom 1, le plus grand cadre 3:4 qui
// tient dans l'image ; au zoom z, z fois plus petit. Centré sur (cx, cy),
// décalé s'il le faut pour rester dans l'image.
export function zoneCadrage(largeur, hauteur, { zoom = 1, cx = 0.5, cy = 0.5 } = {}, format = FORMAT_PHOTO) {
  const w = Math.min(largeur, hauteur * format) / borner(zoom, 1, ZOOM_MAX);
  const h = w / format;
  return {
    x: borner(cx * largeur - w / 2, 0, largeur - w),
    y: borner(cy * hauteur - h / 2, 0, hauteur - h),
    w,
    h,
  };
}

// Centre ramené là où le cadre tient dans l'image : glisser au-delà du bord
// ne s'accumule pas (le retour ne demande pas de « rattraper » l'excédent).
export function bornerCentre(largeur, hauteur, reglages) {
  const z = zoneCadrage(largeur, hauteur, reglages);
  return { cx: arrondi((z.x + z.w / 2) / largeur), cy: arrondi((z.y + z.h / 2) / hauteur) };
}

// Glisser la photo de (dx, dy) pixels d'écran dans un aperçu large de
// `largeurApercu` : la photo suit le doigt, le cadre part en sens inverse.
export function deplacerCadre(largeur, hauteur, reglages, dx, dy, largeurApercu) {
  const z = zoneCadrage(largeur, hauteur, reglages);
  const echelle = z.w / Math.max(1, largeurApercu);
  return bornerCentre(largeur, hauteur, {
    ...reglages,
    cx: reglages.cx - (dx * echelle) / largeur,
    cy: reglages.cy - (dy * echelle) / hauteur,
  });
}

// Zoom autour d'un point de l'aperçu (fx, fy : fractions du cadre, 0,5 au
// centre) : le point sous les doigts ou la souris y reste.
export function zoomerCadre(largeur, hauteur, reglages, zoom, fx = 0.5, fy = 0.5) {
  const avant = zoneCadrage(largeur, hauteur, reglages);
  const px = avant.x + fx * avant.w;
  const py = avant.y + fy * avant.h;
  const z = arrondi(borner(nombre(zoom, 1), 1, ZOOM_MAX));
  const w = Math.min(largeur, hauteur * FORMAT_PHOTO) / z;
  const h = w / FORMAT_PHOTO;
  const centre = bornerCentre(largeur, hauteur, {
    zoom: z, cx: (px - fx * w + w / 2) / largeur, cy: (py - fy * h + h / 2) / hauteur,
  });
  return { zoom: z, ...centre };
}

// ── Vue « Recadrer » : la photo entière et son cadre ────────────────────────
// Le cadre se manipule directement : déplacé en le glissant, agrandi ou
// rétréci par ses coins. Toujours au format 3:4 et dans la photo ; il se
// traduit en zoom et centre, comme le reste de la retouche.

// Réglages (zoom, centre) qui donnent le cadre `zone` voulu ; sa taille est
// ramenée entre la photo entière (zoom 1) et ZOOM_MAX.
export function cadrageDepuisZone(largeur, hauteur, zone) {
  const base = Math.min(largeur, hauteur * FORMAT_PHOTO);
  const zoom = arrondi(borner(base / Math.max(1, zone.w), 1, ZOOM_MAX));
  const centre = bornerCentre(largeur, hauteur, {
    zoom, cx: (zone.x + zone.w / 2) / largeur, cy: (zone.y + zone.h / 2) / hauteur,
  });
  return { zoom, ...centre };
}

// Cadre glissé de (dx, dy) pixels de la photo : il suit le doigt.
export function deplacerZone(largeur, hauteur, reglages, dx, dy) {
  return bornerCentre(largeur, hauteur, {
    ...reglages, cx: reglages.cx + dx / largeur, cy: reglages.cy + dy / hauteur,
  });
}

// Coins du cadre : h(aut)/b(as) + g(auche)/d(roite).
export const COINS = ["hg", "hd", "bg", "bd"];

// Coin `coin` tiré de (dx, dy) pixels de la photo : le coin opposé reste
// fixe, le cadre garde le format 3:4 (la largeur suit la moyenne des deux
// déplacements) et ne sort pas de la photo.
export function redimensionnerZone(largeur, hauteur, reglages, coin, dx, dy, format = FORMAT_PHOTO) {
  const z = zoneCadrage(largeur, hauteur, reglages, format);
  const sx = coin.endsWith("d") ? 1 : -1;
  const sy = coin.startsWith("b") ? 1 : -1;
  // Coin opposé, fixe.
  const ax = sx > 0 ? z.x : z.x + z.w;
  const ay = sy > 0 ? z.y : z.y + z.h;
  const base = Math.min(largeur, hauteur * format);
  // Place disponible depuis le coin fixe, dans la direction du coin tiré.
  const placeX = sx > 0 ? largeur - ax : ax;
  const placeY = (sy > 0 ? hauteur - ay : ay) * format;
  const voulue = z.w + (sx * dx + sy * dy * format) / 2;
  const w = borner(voulue, base / ZOOM_MAX, Math.min(base, placeX, placeY));
  const h = w / format;
  return cadrageDepuisZone(largeur, hauteur, {
    x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h,
  });
}

// Quart de tour (sens +1 : horaire) : le cadrage repart de la photo entière.
export const tourner = (reglages, sens = 1) => ({
  ...reglages,
  rotation: (((reglages.rotation + 90 * Math.sign(sens || 1)) % 360) + 360) % 360,
  zoom: 1, cx: 0.5, cy: 0.5,
});

// Cadrage d'identité sur le visage trouvé (même composition qu'à la prise de
// vue : photo-framing, calculerRecadrage).
export function cadrageSurVisage(visage, largeur, hauteur) {
  const r = calculerRecadrage(visage, largeur, hauteur);
  const zoom = arrondi(borner(Math.min(largeur, hauteur * FORMAT_PHOTO) / r.w, 1, ZOOM_MAX));
  const reglages = { zoom, cx: (r.x + r.w / 2) / largeur, cy: (r.y + r.h / 2) / hauteur };
  return { zoom, ...bornerCentre(largeur, hauteur, reglages) };
}

// Zones où chercher le visage, par passes de plus en plus fines : la photo
// entière, puis des carrés qui se chevauchent de moitié (côté : la moitié,
// puis 30 % du petit côté). Le détecteur travaille en 128×128 : un enfant
// photographié en pied a un visage trop petit pour la photo entière, il
// apparaît dans un carré.
export function zonesRecherche(largeur, hauteur, cotes = [0.5, 0.3]) {
  const passes = [[{ x: 0, y: 0, w: largeur, h: hauteur }]];
  for (const fraction of cotes) {
    const cote = Math.round(Math.min(largeur, hauteur) * fraction);
    const pas = cote / 2;
    const positions = (taille) => {
      const liste = [];
      for (let v = 0; v < taille - cote; v += pas) liste.push(Math.round(v));
      liste.push(taille - cote);
      return liste;
    };
    const ys = positions(hauteur);
    passes.push(positions(largeur).flatMap((x) => ys.map((y) => ({ x, y, w: cote, h: cote }))));
  }
  return passes;
}

// Rien à refaire : la photo produite serait la photo de départ elle-même
// (pas de tour, de recadrage, de lumière ni de fond). `largeur` × `hauteur` :
// l'image de départ — une photo importée qui n'est pas en 3:4 serait
// recadrée même sans zoom.
export function estNeutre(reglages, largeur, hauteur) {
  const r = normaliserReglages(reglages);
  if (r.rotation || r.luminosite || r.contraste || r.fond !== FOND_ORIGINAL) return false;
  const z = zoneCadrage(largeur, hauteur, r);
  return z.w >= largeur - 1 && z.h >= hauteur - 1;
}

// ── Lumière ─────────────────────────────────────────────────────────────────

// Table des tons (256 valeurs). La luminosité agit en gamma : elle éclaircit
// les tons moyens sans griser les noirs ni brûler les blancs — une peau
// foncée garde son relief. Le contraste étire autour du gris moyen.
export function tableTons(luminosite = 0, contraste = 0) {
  const gamma = 2 ** (-borner(luminosite, -TON_MAX, TON_MAX) / TON_MAX);
  const k = 2 ** (borner(contraste, -TON_MAX, TON_MAX) / (TON_MAX * 1.5));
  const table = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    table[v] = Math.round((255 * (v / 255) ** gamma - 128) * k + 128);
  }
  return table;
}

// Tons appliqués EN PLACE aux pixels RGBA.
export function appliquerTons(pixels, table) {
  for (let p = 0; p < pixels.length; p += 4) {
    pixels[p] = table[pixels[p]];
    pixels[p + 1] = table[pixels[p + 1]];
    pixels[p + 2] = table[pixels[p + 2]];
  }
  return pixels;
}

const luma = (pixels, p) => 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];

function centile(histogramme, total, q) {
  const cible = q * total;
  let cumul = 0;
  for (let v = 0; v < 256; v++) {
    cumul += histogramme[v];
    if (cumul >= cible) return v;
  }
  return 255;
}

// Lumière automatique, d'après l'histogramme de TOUTE la photo et non du
// seul visage : une photo sombre dans son ensemble (classe peu éclairée) est
// éclaircie ; un enfant à la peau foncée devant un mur clair ne l'est pas —
// sa photo n'est pas sous-exposée. Seulement éclaircir et redonner du relief,
// avec mesure : le réglage se reprend ensuite aux curseurs.
export function tonsAuto(pixels) {
  const histogramme = new Uint32Array(256);
  let total = 0;
  for (let p = 0; p + 2 < pixels.length; p += 4) {
    histogramme[Math.round(luma(pixels, p))] += 1;
    total += 1;
  }
  if (!total) return { luminosite: 0, contraste: 0 };
  const haut = centile(histogramme, total, 0.98);
  let luminosite = 0;
  if (haut > 8 && haut < 200) {
    // Gamma qui amène les tons clairs de la photo vers 225.
    const gamma = Math.log(225 / 255) / Math.log(haut / 255);
    luminosite = Math.round(borner(-TON_MAX * Math.log2(gamma), 0, 40));
  }
  const table = tableTons(luminosite, 0);
  const etendue = table[haut] - table[centile(histogramme, total, 0.02)];
  let contraste = 0;
  if (etendue > 0 && etendue < 170) {
    contraste = Math.round(borner(TON_MAX * 1.5 * Math.log2(170 / etendue), 0, 25));
  }
  return { luminosite, contraste };
}

// ── Mémoire de la retouche dans la fiche ────────────────────────────────────
// Champ `photoRetouche` de l'élève (rangé dans `extra`) : la photo
// d'ORIGINE et les réglages appliqués. Rouvrir la retouche repart de
// l'origine : pas de perte de qualité d'une retouche à l'autre, et un
// recadrage serré se desserre plus tard. Elle ne vaut que tant que la photo
// de la fiche est celle qu'elle a produite (`resultat`) : une photo reprise
// entre-temps la rend caduque.

const estUrlDistante = (url) => /^https?:\/\//i.test(String(url || ""));

// Point de départ de la retouche d'une photo : son origine et ses réglages
// si elle a déjà été retouchée, sinon elle-même, sans réglage.
export function sourceRetouche(photo, retouche) {
  if (photo && retouche?.origine && retouche.resultat === photo) {
    return { source: retouche.origine, reglages: normaliserReglages(retouche) };
  }
  return { source: photo || "", reglages: { ...REGLAGES_NEUTRES } };
}

// Mémoire à la sortie de la retouche, avant envoi (`resultat` : la photo
// produite, encore en data URL).
export const memoireRetouche = (origine, reglages, resultat) => ({
  origine, resultat, ...normaliserReglages(reglages),
});

// Mémoire à enregistrer avec la photo `photoUrl` une fois téléversée.
// `photoAvant` : la photo envoyée, à laquelle la mémoire doit se rapporter.
// Rien (null) si l'origine n'est pas elle-même enregistrée : une photo de la
// caméra pas encore envoyée ne se garde pas en double, et une data URL n'a
// pas sa place dans la fiche.
export function finaliserRetouche(retouche, photoAvant, photoUrl) {
  if (!retouche || !photoUrl || retouche.resultat !== photoAvant) return null;
  if (!estUrlDistante(retouche.origine) || !estUrlDistante(photoUrl) || retouche.origine === photoUrl) return null;
  return memoireRetouche(retouche.origine, retouche, photoUrl);
}

// Fond d'une photo enregistrée changé pour `fond` (fond de toute une
// classe) : point de départ et réglages, ou null s'il n'y a rien à faire —
// ce fond déjà posé par une retouche, ou « fond d'origine » demandé pour une
// photo jamais retouchée. Les autres réglages (cadrage, lumière) restent.
export function retoucheFond(photo, retouche, fond) {
  if (!photo) return null;
  const { source, reglages } = sourceRetouche(photo, retouche);
  const choix = normaliserCouleur(fond) || FOND_ORIGINAL;
  if (reglages.fond === choix) return null;
  return { source, reglages: { ...reglages, fond: choix } };
}
