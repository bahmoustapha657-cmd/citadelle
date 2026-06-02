import { useState, useEffect, useRef, useCallback } from "react";
import { getCameraErrorMessage } from "./camera-errors";

// Gestion du flux caméra : démarrage/arrêt, bascule avant/arrière, capture
// d'image (canvas → dataURL) et import d'un fichier. La vue reste dans
// CameraCapture.jsx.
export function useCameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const [erreur, setErreur] = useState("");
  const [pret, setPret] = useState(false);
  const [facing, setFacing] = useState("user");

  const arreterCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const demarrerCamera = useCallback(async (mode) => {
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

    const contraintes = [
      { video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    ];

    let lastError = null;
    for (const config of contraintes) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(config);
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setPret(true);
        }
        return;
      } catch (e) {
        lastError = e;
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") break;
      }
    }

    setErreur(getCameraErrorMessage(lastError));
  }, [arreterCamera]);

  const lireFichier = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onCapture(reader.result);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const timer = setTimeout(() => demarrerCamera("user"), 0);
    return () => {
      clearTimeout(timer);
      arreterCamera();
    };
  }, [arreterCamera, demarrerCamera]);

  const inverser = () => { const next = facing === "user" ? "environment" : "user"; setFacing(next); demarrerCamera(next); };

  const fermer = () => { arreterCamera(); onClose(); };

  const capturer = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
    fermer();
  };

  return { videoRef, inputRef, erreur, pret, facing, demarrerCamera, lireFichier, inverser, fermer, capturer };
}
