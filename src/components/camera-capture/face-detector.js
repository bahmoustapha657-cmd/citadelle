// Détecteur de visage : MediaPipe BlazeFace, modèle « short range » (visages
// à moins de 2 m de la caméra — le cas d'une photo d'identité). Licence
// Apache-2.0, modèle compris.
//
// Chargé À LA DEMANDE (import dynamique depuis use-face-guidance) : ~3,4 Mo
// compressés de WebAssembly qui ne pèsent rien tant que la caméra n'est pas
// ouverte, puis servis par le cache du service worker. Tout est auto-hébergé
// — ni CDN ni domaine tiers : la CSP (connect-src 'self') et l'isolation
// COEP de l'app n'ont pas à changer, et le guidage marche hors ligne.
//
// Fichiers publiés tels quels via `?url` : le chargeur Emscripten est un
// script classique que MediaPipe injecte lui-même, il ne doit pas passer par
// le bundler.
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import chargeurSimd from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import binaireSimd from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import chargeurSansSimd from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import binaireSansSimd from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
// Source : storage.googleapis.com/mediapipe-models/face_detector/
// blaze_face_short_range/float16/1/blaze_face_short_range.tflite
import modele from "../../assets/models/blaze_face_short_range.tflite?url";

let chargement = null;
let dernierHorodatage = 0;

async function creerDetecteur() {
  // Navigateurs sans SIMD WebAssembly (Safari < 16.4, vieux Android) : la
  // variante sans SIMD, plus lente mais identique.
  const simd = await FilesetResolver.isSimdSupported();
  const fichiers = simd
    ? { wasmLoaderPath: chargeurSimd, wasmBinaryPath: binaireSimd }
    : { wasmLoaderPath: chargeurSansSimd, wasmBinaryPath: binaireSansSimd };
  const detecteur = await FaceDetector.createFromOptions(fichiers, {
    // CPU : le modèle est minuscule (quelques millisecondes par image) et le
    // délégué GPU est capricieux sur les pilotes graphiques anciens.
    baseOptions: { modelAssetPath: modele, delegate: "CPU" },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.5,
  });
  return {
    // Détections sur une image (canvas réduit). Le mode VIDEO exige des
    // horodatages strictement croissants, y compris d'une ouverture de la
    // caméra à la suivante : le détecteur est partagé.
    detecter(source) {
      dernierHorodatage = Math.max(performance.now(), dernierHorodatage + 1);
      return detecteur.detectForVideo(source, dernierHorodatage).detections || [];
    },
  };
}

// Un seul détecteur pour toute la session : l'initialisation (compilation du
// WebAssembly, chargement du modèle) prend une à deux secondes, les photos
// suivantes en sont dispensées. Un échec n'est pas mémorisé : l'ouverture
// suivante retente (réseau revenu, par exemple).
export function chargerDetecteurVisage() {
  if (!chargement) {
    chargement = creerDetecteur().catch((e) => {
      chargement = null;
      throw e;
    });
  }
  return chargement;
}

// Détecteur devenu inutilisable (contexte WebGL perdu, par exemple) : le
// prochain chargement en recrée un.
export function oublierDetecteurVisage() {
  chargement = null;
}
