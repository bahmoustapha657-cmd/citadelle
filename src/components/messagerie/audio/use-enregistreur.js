import { useCallback, useEffect, useRef, useState } from "react";
import { arreterFlux, capterMicro } from "./webrtc";
import i18n from "../../../i18n";

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
  // demarrage : un démarrage attend le micro (jeton), pour refuser le second.
  const ref = useRef({ rec: null, flux: null, debut: 0, minuteur: null, resoudre: null, demarrage: null });

  const nettoyer = useCallback(() => {
    const r = ref.current;
    clearInterval(r.minuteur);
    arreterFlux(r.flux);
    Object.assign(r, { rec: null, flux: null, minuteur: null, demarrage: null });
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
    if (!enregistrementDisponible()) { setErreur(i18n.t("msg.rec.unsupported")); return false; }
    const r = ref.current;
    // Un seul enregistreur à la fois. Un double appui sur le micro en lançait
    // deux : le premier, jamais arrêté, gardait le micro ouvert et mêlait ses
    // morceaux à ce vocal et aux suivants, qui devenaient illisibles
    // (scripts/vocal-entrelace.mjs les répare).
    if (r.rec || r.demarrage) return false;
    const tour = {};
    r.demarrage = tour;
    try {
      const flux = await capterMicro();
      // Annulé (ou écran quitté) pendant l'attente du micro : on le relâche.
      if (r.demarrage !== tour) { arreterFlux(flux); return false; }
      r.demarrage = null;
      const format = choisirFormat();
      const rec = new MediaRecorder(flux, format ? { mimeType: format, audioBitsPerSecond: 32000 } : undefined);
      // Morceaux propres à CET enregistreur : aucun autre ne peut y écrire.
      const morceaux = [];
      const debut = Date.now();
      Object.assign(r, { rec, flux, debut, resoudre: null });
      rec.ondataavailable = (e) => { if (e.data?.size) morceaux.push(e.data); };
      rec.onstop = () => {
        const duree = (Date.now() - debut) / 1000;
        const blob = new Blob(morceaux, { type: rec.mimeType || format || "audio/webm" });
        const courant = r.rec === rec;
        const resoudre = courant ? r.resoudre : null;
        arreterFlux(flux);
        if (courant) nettoyer();
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
      if (r.demarrage === tour) r.demarrage = null;
      setErreur(e.message || i18n.t("msg.rec.micUnavailable"));
      if (!r.rec) nettoyer();
      return false;
    }
  }, [dureeMax, nettoyer]);

  const annuler = useCallback(() => {
    const r = ref.current;
    r.resoudre = null;
    r.demarrage = null; // un démarrage en attente du micro est abandonné
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
