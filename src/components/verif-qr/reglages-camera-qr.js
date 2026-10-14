// Réglages de la caméra du scanner QR, déduits de piste.getCapabilities().
// Module PUR (testé par tests/reglages-camera-qr.test.js).
//
// Pourquoi le ZOOM : un QR de document fait ~25 mm. Pour qu'il couvre assez de
// pixels, il fallait approcher le téléphone à ~10 cm — en deçà de la distance
// minimale de mise au point de la plupart des capteurs : l'image devenait
// floue. Zoomé ×2, le même QR est aussi grand à 20–25 cm, là où l'autofocus
// travaille bien.

// Zoom exploitable : celui des téléphones s'exprime en RAPPORT (1 à 8–10).
// Certaines webcams déclarent une plage dans une unité propre (100 à 500…) :
// on n'y touche pas, faute de savoir ce que vaut une valeur.
export function plageZoom(caps = {}) {
  const z = caps?.zoom;
  if (!z || typeof z.max !== "number" || typeof z.min !== "number") return null;
  if (z.max <= z.min || z.min < 0.5 || z.max > 20) return null;
  return { min: z.min, max: z.max, step: z.step > 0 ? z.step : 0.1 };
}

// Zoom appliqué à l'ouverture : ×2, borné par ce que permet l'appareil.
export const ZOOM_DEPART = 2;
export function zoomInitial(caps = {}) {
  const p = plageZoom(caps);
  if (!p) return null;
  return Math.min(p.max, Math.max(p.min, ZOOM_DEPART));
}

export const aLampe = (caps = {}) => caps?.torch === true
  || (Array.isArray(caps?.torch) && caps.torch.includes(true));

// Mise au point au toucher : « single-shot » relance une mise au point, puis
// on revient en continu. Renvoie les contraintes à appliquer, dans l'ordre.
export function etapesMiseAuPoint(caps = {}, point = null) {
  const modes = Array.isArray(caps?.focusMode) ? caps.focusMode : [];
  const etapes = [];
  const pointOk = point && "pointsOfInterest" in (caps || {});
  if (modes.includes("single-shot")) {
    etapes.push({ ...(pointOk ? { pointsOfInterest: [point] } : {}), focusMode: "single-shot" });
  } else if (pointOk) {
    etapes.push({ pointsOfInterest: [point] });
  }
  if (etapes.length && modes.includes("continuous")) etapes.push({ focusMode: "continuous" });
  return etapes;
}
