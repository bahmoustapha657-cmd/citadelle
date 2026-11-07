// Rendu de la retouche d'une photo d'élève (canvas) : chargement de la photo
// enregistrée, quart de tour, recadrage 3:4, lumière, fond. Les calculs sont
// dans retouche.js (purs, testés) ; le détourage dans detourage.js, chargé à
// la demande comme à la prise de vue. Tout se fait sur l'appareil : aucune
// photo ne part ailleurs que dans le stockage de l'école.
import { composerFond, fenetreContour, FOND_ORIGINAL, hexVersRgb, recadrerMasque } from "./fond-photo";
import { dessinerPourAnalyse, dessinerReduit, libererCanvas } from "./photo-capture";
import { QUALITE_JPEG, SORTIE_MAX, tailleMaxCote, tailleSortie, versVisages, visagePrincipal } from "./photo-framing";
import {
  appliquerTons, dimensionsTournees, estNeutre, memoireRetouche, normaliserReglages, tableTons, zoneCadrage,
  zonesRecherche,
} from "./retouche";

// Côté maximal de l'image de travail : celui des photos importées
// (COTE_MAX_IMPORT). Les photos prises à la caméra font 768×1024.
const COTE_TRAVAIL = 1200;

export const MESSAGE_PHOTO_INACCESSIBLE = "Photo impossible à ouvrir : sans réseau, seules les photos déjà affichées sur cet appareil s'ouvrent. Réessayez avec le réseau, ou reprenez la photo.";

// Photo enregistrée (URL du stockage) ou toute fraîche (data URL). Une photo
// d'un autre domaine se charge en CORS (crossOrigin) : sans cela, le canvas
// serait « teinté » et ses pixels illisibles — l'app exige déjà ce mode pour
// afficher les photos (COEP).
export function chargerPhoto(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("Pas de photo")); return; }
    const img = new Image();
    if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(MESSAGE_PHOTO_INACCESSIBLE));
    img.src = url;
  });
}

// Image de travail : la photo tournée d'un quart de tour (0, 90, 180, 270°),
// réduite au besoin.
export function tournerImage(img, rotation = 0) {
  const { largeur: l0, hauteur: h0 } = tailleMaxCote(img.naturalWidth || img.width, img.naturalHeight || img.height, COTE_TRAVAIL);
  const { largeur, hauteur } = dimensionsTournees(l0, h0, rotation);
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.translate(largeur / 2, hauteur / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -l0 / 2, -h0 / 2, l0, h0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    // Photo servie sans en-tête CORS : pixels illisibles, autant le dire
    // tout de suite plutôt qu'au premier réglage.
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    libererCanvas(canvas);
    throw new Error(MESSAGE_PHOTO_INACCESSIBLE);
  }
  return canvas;
}

// Lumière et fond appliqués aux pixels de `cible`, où le cadre `zone` de
// l'image de travail vient d'être dessiné.
function retoucherPixels(cible, image, masque, zone, reglages) {
  const tons = reglages.luminosite || reglages.contraste;
  const fond = reglages.fond !== FOND_ORIGINAL && masque;
  if (!tons && !fond) return;
  const { width: largeur, height: hauteur } = cible;
  const ctx = cible.getContext("2d", { willReadFrequently: true });
  const donnees = ctx.getImageData(0, 0, largeur, hauteur);
  // La lumière d'abord, le fond ensuite : la couleur choisie reste exacte.
  if (tons) appliquerTons(donnees.data, tableTons(reglages.luminosite, reglages.contraste));
  if (fond) {
    composerFond(donnees.data, recadrerMasque(masque, image.width, image.height, zone, largeur, hauteur),
      hexVersRgb(reglages.fond), fenetreContour(reglages.contour));
  }
  ctx.putImageData(donnees, 0, 0);
}

// Aperçu : la retouche dessinée dans le canvas `cible` (à sa taille). Sans
// masque (détourage en cours ou indisponible), le fond reste celui d'origine.
export function dessinerApercu(cible, image, masque, reglages) {
  // Image de travail déjà rendue à la mémoire (quart de tour en cours).
  if (!image.width || !image.height) return;
  const zone = zoneCadrage(image.width, image.height, reglages);
  const ctx = cible.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, zone.x, zone.y, zone.w, zone.h, 0, 0, cible.width, cible.height);
  retoucherPixels(cible, image, masque, zone, reglages);
}

// Vue « Recadrer » : la photo de travail ENTIÈRE dans `cible` (à son
// format), lumière et fond compris ; le cadre se dessine par-dessus (HTML).
export function dessinerImageEntiere(cible, image, masque, reglages) {
  if (!image.width || !image.height) return;
  const zone = { x: 0, y: 0, w: image.width, h: image.height };
  const ctx = cible.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, cible.width, cible.height);
  retoucherPixels(cible, image, masque, zone, reglages);
}

// Pixels du cadre courant, en petit : de quoi régler la lumière automatique.
export function pixelsDuCadre(image, reglages, cote = 160) {
  const zone = zoneCadrage(image.width, image.height, reglages);
  const { largeur, hauteur } = tailleMaxCote(zone.w, zone.h, cote);
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, zone.x, zone.y, zone.w, zone.h, 0, 0, largeur, hauteur);
  const pixels = ctx.getImageData(0, 0, largeur, hauteur).data;
  libererCanvas(canvas);
  return pixels;
}

// Taille de la photo produite : celle du cadre, ramenée à SORTIE_MAX, jamais
// agrandie (un agrandissement n'ajoute aucun détail).
export function tailleRetouche(image, reglages) {
  const zone = zoneCadrage(image.width, image.height, reglages);
  return tailleSortie(zone.w, zone.h, SORTIE_MAX);
}

// Photo finale (data URL JPEG) : réduction soignée, puis lumière et fond.
export function exporterRetouche(image, masque, reglages) {
  const zone = zoneCadrage(image.width, image.height, reglages);
  const { largeur, hauteur } = tailleSortie(zone.w, zone.h, SORTIE_MAX);
  const canvas = dessinerReduit(image, zone, largeur, hauteur);
  retoucherPixels(canvas, image, masque, zone, reglages);
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITE_JPEG);
  libererCanvas(canvas);
  return dataUrl;
}

// Visage principal de l'image de travail (null si aucun), pour « Centrer le
// visage ». Même détecteur qu'à la prise de vue, chargé à la demande ; la
// photo entière d'abord, puis par carrés (zonesRecherche) pour un enfant
// photographié de loin.
export async function trouverVisage(image) {
  const { chargerDetecteurVisage } = await import("./face-detector");
  const detecteur = await chargerDetecteurVisage();
  const analyse = document.createElement("canvas");
  try {
    for (const zones of zonesRecherche(image.width, image.height)) {
      const visages = zones.flatMap((zone) => {
        dessinerPourAnalyse(image, zone, analyse);
        return versVisages(detecteur.detecter(analyse), {
          largeurAnalyse: analyse.width, hauteurAnalyse: analyse.height, zone,
        });
      });
      const { principal } = visagePrincipal(visages);
      if (principal) return principal;
    }
    return null;
  } finally {
    libererCanvas(analyse);
  }
}

// Masque « personne » de l'image de travail (detourage.js, chargé à la demande).
export const detourerImage = (image) => import("./detourage").then((m) => m.masquePersonne(image));

// Retouche complète d'une photo, sans écran (fond de toute une classe) :
// → { photo, retouche } ; `photo` = la source elle-même si les réglages ne
// changent rien.
export async function retoucherPhoto(source, reglages) {
  const r = normaliserReglages(reglages);
  const img = await chargerPhoto(source);
  const image = tournerImage(img, r.rotation);
  try {
    if (estNeutre(r, image.width, image.height)) return { photo: source, retouche: null };
    const masque = r.fond !== FOND_ORIGINAL ? await detourerImage(image) : null;
    const photo = exporterRetouche(image, masque, r);
    return { photo, retouche: memoireRetouche(source, r, photo) };
  } finally {
    libererCanvas(image);
  }
}
