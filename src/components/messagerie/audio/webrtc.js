// ── Outils WebRTC / micro de la messagerie (appels et vocaux) ───────────────
// Signalisation « sans trickle » : chaque côté attend la fin de la collecte
// ICE puis publie SA description complète (une seule écriture en base par
// côté, dans msg_appels) — plus simple et plus robuste sur réseau faible
// qu'un échange de candidats un par un.

import i18n from "../../../i18n";

export function messageErreurMicro(e) {
  const nom = e?.name || "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return i18n.t("msg.device.micDenied");
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return i18n.t("msg.device.micNotFound");
  if (nom === "NotReadableError") return i18n.t("msg.device.micBusy");
  return i18n.t("msg.device.micUnavailable");
}

export async function capterMicro() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(i18n.t("msg.device.micInsecure"));
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    throw new Error(messageErreurMicro(e));
  }
}

export function arreterFlux(flux) {
  flux?.getTracks?.().forEach((piste) => { try { piste.stop(); } catch { /* déjà arrêtée */ } });
}

export const webrtcDisponible = () => typeof window !== "undefined" && "RTCPeerConnection" in window;

// Un relais TURN figure-t-il parmi les serveurs ICE ?
export const relaisPrevu = (iceServers) => (iceServers || [])
  .some((s) => [].concat(s.urls || []).some((u) => /^turns?:/i.test(u)));

// Sans relais, seule la collecte des candidats directs compte ; avec relais,
// sa réponse peut tarder sur réseau faible et c'est elle qui fait passer
// l'appel entre deux réseaux mobiles.
export const delaiCollecteIce = (iceServers) => (relaisPrevu(iceServers) ? 8000 : 4000);

// Attend la fin de la collecte ICE (ou `delaiMs`, au-delà duquel on part avec
// les candidats déjà trouvés). Sans trickle, un candidat arrivé après coup est
// perdu : on patiente pour le relais, et on part dès qu'il a répondu.
export function attendreCollecteIce(pc, delaiMs = delaiCollecteIce(pc.getConfiguration?.().iceServers)) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const fin = () => {
      clearTimeout(minuteur);
      pc.removeEventListener("icegatheringstatechange", verifier);
      pc.removeEventListener("icecandidate", surCandidat);
      resolve();
    };
    const verifier = () => { if (pc.iceGatheringState === "complete") fin(); };
    const surCandidat = (e) => { if (/ typ relay /.test(e.candidate?.candidate || "")) fin(); };
    const minuteur = setTimeout(fin, delaiMs);
    pc.addEventListener("icegatheringstatechange", verifier);
    pc.addEventListener("icecandidate", surCandidat);
  });
}

export const descriptionJson = (d) => (d ? { type: d.type, sdp: d.sdp } : null);

// Crée la connexion, y branche le micro, et joue l'audio distant.
// `onLecture(ok)` : le haut-parleur a-t-il accepté de jouer la voix reçue ?
export function creerConnexion({ iceServers, flux, onEtat, onLecture }) {
  const pc = new RTCPeerConnection({ iceServers });
  flux.getTracks().forEach((piste) => pc.addTrack(piste, flux));
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0] || new MediaStream([e.track]);
    audio.play().then(() => onLecture?.(true))
      .catch(() => { onLecture?.(false); /* lecture relancée au prochain geste */ });
  };
  pc.onconnectionstatechange = () => onEtat?.(pc.connectionState);
  return { pc, audio };
}

export function messageErreurCamera(e) {
  const nom = e?.name || "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return i18n.t("msg.device.cameraDenied");
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return i18n.t("msg.device.cameraNotFound");
  if (nom === "NotReadableError") return i18n.t("msg.device.cameraBusy");
  return e?.message || i18n.t("msg.device.cameraUnavailable");
}

// Vidéo d'appel de groupe : 360p, 15 images/s — lisible et sobre en data.
export const CONTRAINTES_VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } };

// Plafonne le débit vidéo envoyé (données mobiles).
export async function limiterDebit(emetteur, debitMax = 350000) {
  try {
    const params = emetteur.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    params.encodings[0].maxBitrate = debitMax;
    await emetteur.setParameters(params);
  } catch { /* navigateur sans setParameters : débit par défaut */ }
}
