// ── Outils WebRTC / micro de la messagerie (appels et vocaux) ───────────────
// Signalisation « sans trickle » : chaque côté attend la fin de la collecte
// ICE puis publie SA description complète (une seule écriture en base par
// côté, dans msg_appels) — plus simple et plus robuste sur réseau faible
// qu'un échange de candidats un par un.

export function messageErreurMicro(e) {
  const nom = e?.name || "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return "Accès au micro refusé : autorisez le micro pour ce site dans le navigateur.";
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return "Aucun micro détecté sur cet appareil.";
  if (nom === "NotReadableError") return "Le micro est déjà utilisé par une autre application.";
  return "Micro indisponible sur cet appareil.";
}

export async function capterMicro() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Micro indisponible sur cet appareil (connexion non sécurisée ?).");
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

// Attend la fin de la collecte ICE (ou `delaiMs`, au-delà duquel on part avec
// les candidats déjà trouvés : un relais TURN lent ne doit pas bloquer).
export function attendreCollecteIce(pc, delaiMs = 4000) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const fin = () => {
      clearTimeout(minuteur);
      pc.removeEventListener("icegatheringstatechange", verifier);
      resolve();
    };
    const verifier = () => { if (pc.iceGatheringState === "complete") fin(); };
    const minuteur = setTimeout(fin, delaiMs);
    pc.addEventListener("icegatheringstatechange", verifier);
  });
}

export const descriptionJson = (d) => (d ? { type: d.type, sdp: d.sdp } : null);

// Crée la connexion, y branche le micro, et joue l'audio distant.
export function creerConnexion({ iceServers, flux, onEtat }) {
  const pc = new RTCPeerConnection({ iceServers });
  flux.getTracks().forEach((piste) => pc.addTrack(piste, flux));
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0] || new MediaStream([e.track]);
    audio.play().catch(() => { /* lecture relancée au prochain geste */ });
  };
  pc.onconnectionstatechange = () => onEtat?.(pc.connectionState);
  return { pc, audio };
}

export function messageErreurCamera(e) {
  const nom = e?.name || "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return "Accès à la caméra refusé : autorisez la caméra pour ce site dans le navigateur.";
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return "Aucune caméra détectée sur cet appareil.";
  if (nom === "NotReadableError") return "La caméra est déjà utilisée par une autre application.";
  return e?.message || "Caméra indisponible.";
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
