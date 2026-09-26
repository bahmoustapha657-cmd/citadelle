// Production de la photo : image figée en pleine définition, recadrage 3:4
// centré sur le visage, réduction soignée, encodage JPEG. Et normalisation
// des images importées (galerie), réduites au lieu d'être refusées.
import {
  QUALITE_JPEG, SORTIE_MAX, calculerRecadrage, regionVisible, tailleMaxCote, tailleSortie,
} from "./photo-framing";

const creerCanvas = (largeur, hauteur) => {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  return canvas;
};

// Libère la mémoire d'un canvas sans attendre le ramasse-miettes : Safari
// iOS plafonne la mémoire totale des canvas et refuserait les suivants.
export const libererCanvas = (canvas) => {
  if (canvas) { canvas.width = 0; canvas.height = 0; }
};

// Image courante de la vidéo, en pleine définition du capteur.
export function figerImage(video) {
  const canvas = creerCanvas(video.videoWidth, video.videoHeight);
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas;
}

// Copie réduite d'une zone de `source`. Au-delà d'un facteur 2, la réduction
// procède par moitiés : Firefox ignore imageSmoothingQuality et une
// réduction directe crénelerait les contours (cheveux, yeux).
export function dessinerReduit(source, zone, largeur, hauteur) {
  let courant = source;
  let { x, y, w, h } = zone;
  const intermediaires = [];
  while (w / 2 >= largeur && h / 2 >= hauteur) {
    const etape = creerCanvas(Math.round(w / 2), Math.round(h / 2));
    const ctx = etape.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(courant, x, y, w, h, 0, 0, etape.width, etape.height);
    intermediaires.push(etape);
    courant = etape;
    x = 0; y = 0; w = etape.width; h = etape.height;
  }
  const sortie = creerCanvas(largeur, hauteur);
  const ctx = sortie.getContext("2d");
  // Fond blanc : une image importée transparente (PNG) ne doit pas virer au
  // noir une fois encodée en JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(courant, x, y, w, h, 0, 0, largeur, hauteur);
  intermediaires.forEach(libererCanvas);
  return sortie;
}

// Photo finale à partir d'une image figée : recadrage centré sur le visage
// s'il est connu, sinon le cadre montré par l'aperçu.
export function recadrerPhoto(image, visage) {
  const zone = visage
    ? calculerRecadrage(visage, image.width, image.height)
    : regionVisible(image.width, image.height);
  const { largeur, hauteur } = tailleSortie(zone.w, zone.h, SORTIE_MAX);
  const canvas = dessinerReduit(image, zone, largeur, hauteur);
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITE_JPEG);
  libererCanvas(canvas);
  return { dataUrl, largeur, hauteur, recadree: !!visage };
}

// Copie réduite d'une zone pour l'analyse du visage : le détecteur travaille
// en 128×128, lui passer une image 4K ne coûterait que du temps de transfert.
export function dessinerPourAnalyse(source, zone, canvas, coteMax = 480) {
  const { largeur, hauteur } = tailleMaxCote(zone.w, zone.h, coteMax);
  if (canvas.width !== largeur) canvas.width = largeur;
  if (canvas.height !== hauteur) canvas.height = hauteur;
  canvas.getContext("2d").drawImage(source, zone.x, zone.y, zone.w, zone.h, 0, 0, largeur, hauteur);
  return canvas;
}

// Côté maximal d'une image importée : une photo de téléphone (4 000 px,
// 3 à 8 Mo) est ramenée à une taille raisonnable au lieu d'être refusée.
export const COTE_MAX_IMPORT = 1200;

function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = url;
  });
}

// Fichier image → data URL JPEG réduite. L'orientation EXIF des photos de
// téléphone est appliquée par le navigateur au décodage.
export async function lireImageNormalisee(fichier, cote = COTE_MAX_IMPORT) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(url);
    const { largeur, hauteur } = tailleMaxCote(img.naturalWidth, img.naturalHeight, cote);
    const canvas = dessinerReduit(img, { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }, largeur, hauteur);
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITE_JPEG);
    libererCanvas(canvas);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
