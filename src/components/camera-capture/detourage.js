// Détourage de la photo d'élève : MediaPipe Selfie Segmenter (licence
// Apache-2.0, modèle compris) sépare l'enfant du décor pour en changer le
// fond (fond-photo.js).
//
// Même organisation que face-detector.js : chargé À LA DEMANDE (import
// dynamique depuis CameraCapture, au premier fond choisi), même WebAssembly
// auto-hébergé — ni CDN ni domaine tiers, aucune photo ne quitte l'appareil,
// et le détourage marche hors ligne une fois l'app en cache.
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import chargeur from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import binaire from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
// Source : storage.googleapis.com/mediapipe-models/image_segmenter/
// selfie_segmenter/float16/latest/selfie_segmenter.tflite (244 Ko)
import modele from "../../assets/models/selfie_segmenter.tflite?url";
import { composerFond, fenetreContour, hexVersRgb, masqueDetoure, redimensionnerMasque } from "./fond-photo";
import { libererCanvas } from "./photo-capture";
import { QUALITE_JPEG } from "./photo-framing";

let chargement = null;

async function creerDetoureur() {
  // Sans SIMD WebAssembly (Safari < 16.4, vieux Android) : pas de détourage,
  // la photo garde son fond d'origine.
  if (!(await FilesetResolver.isSimdSupported())) {
    throw new Error("WebAssembly SIMD non pris en charge : détourage indisponible");
  }
  return ImageSegmenter.createFromOptions({ wasmLoaderPath: chargeur, wasmBinaryPath: binaire }, {
    baseOptions: { modelAssetPath: modele, delegate: "CPU" },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

// Un seul détoureur pour la session ; un échec n'est pas mémorisé.
function chargerDetoureur() {
  if (!chargement) {
    chargement = creerDetoureur().catch((e) => {
      chargement = null;
      throw e;
    });
  }
  return chargement;
}

function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = url;
  });
}

// Masque « personne » (confiance 0 → 1) d'une image déjà dessinée dans un
// canvas, à sa taille, recalé sur ses vrais contours (masqueDetoure). Sert
// aussi à la retouche d'une photo enregistrée (rendu-retouche.js).
export async function masquePersonne(canvas) {
  const detoureur = await chargerDetoureur();
  const { width: largeur, height: hauteur } = canvas;
  // Canvas rendu à la mémoire pendant le chargement du modèle (retouche
  // fermée, photo tournée) : rien à détourer.
  if (!largeur || !hauteur) throw new Error("Image vide");
  const resultat = detoureur.segment(canvas);
  try {
    // Le modèle n'a qu'une sortie (sigmoïde) : selon la version, MediaPipe
    // rend un masque « personne » seul, ou [fond, personne]. Le dernier est
    // toujours celui de la personne.
    const masques = resultat.confidenceMasks || [];
    const personne = masques[masques.length - 1];
    if (!personne) throw new Error("Détourage sans résultat");
    const brut = redimensionnerMasque(personne.getAsFloat32Array(), personne.width, personne.height, largeur, hauteur);
    const pixels = canvas.getContext("2d").getImageData(0, 0, largeur, hauteur).data;
    return masqueDetoure(brut, pixels, largeur, hauteur);
  } finally {
    resultat.close?.();
  }
}

// Photo (data URL) → { canvas, masque }. Calculé une fois par photo ;
// changer de couleur ou de réglage de contour ne refait que la fusion.
export async function detourerPhoto(dataUrl) {
  const [, img] = await Promise.all([chargerDetoureur(), chargerImage(dataUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return { canvas, masque: await masquePersonne(canvas) };
}

// Photo détourée + couleur + réglage « Contour » → nouvelle photo JPEG.
export function appliquerFond({ canvas, masque }, couleur, reglage = 0) {
  const sortie = document.createElement("canvas");
  sortie.width = canvas.width;
  sortie.height = canvas.height;
  const ctx = sortie.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, sortie.width, sortie.height);
  composerFond(image.data, masque, hexVersRgb(couleur), fenetreContour(reglage));
  ctx.putImageData(image, 0, 0);
  const dataUrl = sortie.toDataURL("image/jpeg", QUALITE_JPEG);
  libererCanvas(sortie);
  return dataUrl;
}
