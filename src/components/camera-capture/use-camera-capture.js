import { useState, useEffect, useRef, useCallback } from "react";
import { getCameraErrorMessage } from "./camera-errors";
import {
  CLE_CAMERA_PREFEREE, apercuEnMiroir, cameraRetrouvee, cameraSuivante, ecrirePreferenceCamera,
  libelleResolution, lirePreferenceCamera, ouvrirMeilleurFlux,
} from "./camera-constraints";

// Gestion du flux caméra : ouverture à la meilleure définition du capteur
// (camera-constraints.js), choix et mémorisation de la caméra, miroir de
// l'aperçu, arrêt. La vue reste dans CameraCapture.jsx, le guidage du visage
// dans use-face-guidance.js.

const lirePreference = () => {
  try { return lirePreferenceCamera(localStorage.getItem(CLE_CAMERA_PREFEREE)); } catch { return lirePreferenceCamera(""); }
};
const memoriserPreference = (deviceId, label) => {
  try {
    if (deviceId) localStorage.setItem(CLE_CAMERA_PREFEREE, ecrirePreferenceCamera(deviceId, label));
  } catch { /* stockage indisponible */ }
};

const arreterFlux = (flux) => flux?.getTracks().forEach((t) => t.stop());

// Caméras présentes. Leurs noms ne sont lisibles qu'une fois l'accès accordé.
async function listerCameras() {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((a) => a.kind === "videoinput" && a.deviceId);
  } catch {
    return [];
  }
}

// Mise au point continue quand la caméra la propose sans l'appliquer d'office
// (certains téléphones restent en mise au point unique sur un flux vidéo).
function activerMiseAuPointContinue(piste) {
  try {
    const modes = piste?.getCapabilities?.().focusMode || [];
    if (modes.includes("continuous") && piste.getSettings().focusMode !== "continuous") {
      piste.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
    }
  } catch { /* capacités non exposées (Firefox, Safari) */ }
}

export function useCameraCapture() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Numéro de la dernière ouverture demandée : une bascule rapide entre deux
  // caméras ne doit pas laisser tourner le flux d'une ouverture dépassée.
  const demandeRef = useRef(0);
  const [erreur, setErreur] = useState("");
  const [pret, setPret] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [miroir, setMiroir] = useState(true);
  const [resolution, setResolution] = useState({ largeur: 0, hauteur: 0 });

  const arreterCamera = useCallback(() => {
    arreterFlux(streamRef.current);
    streamRef.current = null;
  }, []);

  // `choix` : deviceId d'une caméra choisie à l'écran. Sans choix (ouverture,
  // « Réessayer ») : la caméra mémorisée.
  const demarrerCamera = useCallback(async (choix = "") => {
    const demande = ++demandeRef.current;
    arreterCamera();
    setPret(false);
    setErreur("");

    if (!window.isSecureContext) {
      setErreur("Caméra indisponible : la caméra ne fonctionne que sur une page sécurisée (https).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreur("Caméra indisponible : votre navigateur ou votre appareil ne prend pas en charge l'accès caméra.");
      return;
    }

    const preference = choix ? null : lirePreference();
    let deviceVoulu = choix || preference.deviceId;
    let flux = null;
    let presentes = [];
    // Deux tours au plus : si la caméra mémorisée a changé d'identifiant, le
    // premier tour ouvre une autre caméra, et le second la caméra retrouvée
    // par son nom.
    for (let tour = 0; tour < 2; tour += 1) {
      try {
        flux = await ouvrirMeilleurFlux((c) => navigator.mediaDevices.getUserMedia(c), { deviceId: deviceVoulu });
      } catch (e) {
        if (demande === demandeRef.current) setErreur(getCameraErrorMessage(e));
        return;
      }
      presentes = await listerCameras();
      if (demande !== demandeRef.current) {
        arreterFlux(flux);
        return;
      }
      const ouverte = flux.getVideoTracks()[0]?.getSettings?.().deviceId;
      const retrouvee = tour === 0 ? cameraRetrouvee(presentes, preference, ouverte) : null;
      if (!retrouvee) break;
      arreterFlux(flux);
      deviceVoulu = retrouvee.deviceId;
    }

    streamRef.current = flux;
    const piste = flux.getVideoTracks()[0];
    const reglages = piste?.getSettings?.() || {};
    setMiroir(apercuEnMiroir(reglages.facingMode));
    setDeviceId(reglages.deviceId || "");
    setCameras(presentes);
    memoriserPreference(reglages.deviceId, piste?.label);
    activerMiseAuPointContinue(piste);
    if (videoRef.current) videoRef.current.srcObject = flux;
  }, [arreterCamera]);

  // Élément <video> (re)monté — après une erreur puis « Réessayer » — : il
  // reprend le flux en cours.
  const attacherVideo = useCallback((element) => {
    videoRef.current = element;
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      element.srcObject = streamRef.current;
    }
  }, []);

  // Définition réellement obtenue ; elle change quand le téléphone pivote.
  const surDimensions = useCallback((e) => {
    const v = e.currentTarget;
    if (!v.videoWidth) return;
    setResolution({ largeur: v.videoWidth, hauteur: v.videoHeight });
    setPret(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => demarrerCamera(), 0);
    return () => {
      clearTimeout(timer);
      demandeRef.current += 1;
      arreterCamera();
    };
  }, [arreterCamera, demarrerCamera]);

  const basculerCamera = () => {
    const suivante = cameraSuivante(cameras, deviceId);
    if (suivante) demarrerCamera(suivante.deviceId);
  };

  return {
    videoRef, attacherVideo, surDimensions, erreur, pret, cameras, deviceId, miroir,
    resolution, libelleDefinition: libelleResolution(resolution.largeur, resolution.hauteur),
    demarrerCamera, basculerCamera, arreterCamera,
  };
}
