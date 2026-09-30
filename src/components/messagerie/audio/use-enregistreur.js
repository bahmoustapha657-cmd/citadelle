import { useCallback, useEffect, useRef, useState } from "react";
import { arreterFlux, capterMicro } from "./webrtc";

// Formats essayés dans l'ordre : Opus (Chrome, Android, Firefox), puis AAC
// (Safari / iPhone). Le bucket accepte les deux.
const FORMATS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

export const enregistrementDisponible = () =>
  typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

function choisirFormat() {
  try {
    return FORMATS.find((f) => window.MediaRecorder.isTypeSupported?.(f)) || "";
  } catch { return ""; }
}

// Enregistreur de message vocal : démarrer → arrêter (renvoie le blob) ou
// annuler. Coupé automatiquement à `dureeMax` secondes.
export function useEnregistreur({ dureeMax = 120 } = {}) {
  const [enCours, setEnCours] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState("");
  const ref = useRef({ rec: null, flux: null, morceaux: [], debut: 0, minuteur: null, resoudre: null });

  const nettoyer = useCallback(() => {
    const r = ref.current;
    clearInterval(r.minuteur);
    arreterFlux(r.flux);
    Object.assign(r, { rec: null, flux: null, minuteur: null });
    setEnCours(false);
  }, []);

  const arreter = useCallback(() => new Promise((resolve) => {
    const r = ref.current;
    if (!r.rec || r.rec.state === "inactive") { resolve(null); return; }
    r.resoudre = resolve;
    r.rec.stop();
  }), []);

  const demarrer = useCallback(async () => {
    setErreur("");
    if (!enregistrementDisponible()) { setErreur("Enregistrement audio non pris en charge par ce navigateur."); return false; }
    try {
      const flux = await capterMicro();
      const format = choisirFormat();
      const rec = new MediaRecorder(flux, format ? { mimeType: format, audioBitsPerSecond: 32000 } : undefined);
      const r = ref.current;
      Object.assign(r, { rec, flux, morceaux: [], debut: Date.now(), resoudre: null });
      rec.ondataavailable = (e) => { if (e.data?.size) r.morceaux.push(e.data); };
      rec.onstop = () => {
        const duree = (Date.now() - r.debut) / 1000;
        const blob = new Blob(r.morceaux, { type: rec.mimeType || format || "audio/webm" });
        const resoudre = r.resoudre;
        r.morceaux = [];
        nettoyer();
        resoudre?.(blob.size ? { blob, duree } : null);
      };
      rec.start(250);
      setSecondes(0);
      setEnCours(true);
      r.minuteur = setInterval(() => {
        const s = Math.floor((Date.now() - r.debut) / 1000);
        setSecondes(s);
        if (s >= dureeMax && r.rec?.state === "recording") r.rec.stop();
      }, 250);
      return true;
    } catch (e) {
      setErreur(e.message || "Micro indisponible.");
      nettoyer();
      return false;
    }
  }, [dureeMax, nettoyer]);

  const annuler = useCallback(() => {
    const r = ref.current;
    r.resoudre = null;
    if (r.rec && r.rec.state !== "inactive") {
      r.rec.onstop = () => nettoyer();
      r.rec.stop();
    } else {
      nettoyer();
    }
  }, [nettoyer]);

  useEffect(() => () => annuler(), [annuler]);

  return { enCours, secondes, erreur, demarrer, arreter, annuler, dureeMax };
}
