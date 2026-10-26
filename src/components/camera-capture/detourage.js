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
import { adoucirMasque, composerFond, hexVersRgb, redimensionnerMasque } from "./fond-photo";
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

// Photo (data URL) → { canvas, masque } : masque de confiance « personne »
// (0 → 1) à la taille de la photo, contour adouci. Calculé une fois par
// photo ; changer de couleur ne refait que la fusion.
export async function detourerPhoto(dataUrl) {
  const [detoureur, img] = await Promise.all([chargerDetoureur(), chargerImage(dataUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const resultat = detoureur.segment(canvas);
  try {
    // Le modèle n'a qu'une sortie (sigmoïde) : selon la version, MediaPipe
    // rend un masque « personne » seul, ou [fond, personne]. Le dernier est
    // toujours celui de la personne.
    const masques = resultat.confidenceMasks || [];
    const personne = masques[masques.length - 1];
    if (!personne) throw new Error("Détourage sans résultat");
    const brut = redimensionnerMasque(personne.getAsFloat32Array(), personne.width, personne.height, canvas.width, canvas.height);
    const rayon = Math.max(1, Math.round(canvas.width / 400));
    return { canvas, masque: adoucirMasque(brut, canvas.width, canvas.height, rayon) };
  } finally {
    resultat.close?.();
  }
}

// Photo détourée + couleur → nouvelle photo JPEG (data URL).
export function appliquerFond({ canvas, masque }, couleur) {
  const sortie = document.createElement("canvas");
  sortie.width = canvas.width;
  sortie.height = canvas.height;
  const ctx = sortie.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, sortie.width, sortie.height);
  composerFond(image.data, masque, hexVersRgb(couleur));
  ctx.putImageData(image, 0, 0);
  const dataUrl = sortie.toDataURL("image/jpeg", QUALITE_JPEG);
  libererCanvas(sortie);
  return dataUrl;
}
