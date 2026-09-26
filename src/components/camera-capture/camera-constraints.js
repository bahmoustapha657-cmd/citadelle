// Choix du flux caméra pour la photo d'élève : la meilleure définition que
// l'appareil sait fournir, quelle que soit la caméra (webcam USB, caméra
// intégrée, avant/arrière d'un téléphone).
//
// Les dimensions sont des valeurs « ideal » : le navigateur retient le mode
// natif le plus proche et n'échoue jamais pour une question de résolution —
// demander 4K revient à obtenir le maximum du capteur. La cadence (ideal 30)
// pèse dans ce choix : une webcam USB 2 qui ne livre sa pleine définition
// qu'à 5 images/s (flux non compressé) se voit préférer un mode fluide. Les
// paliers inférieurs ne servent qu'aux pilotes qui refusent d'ouvrir le
// capteur en très haute définition (NotReadableError, OverconstrainedError).
export const PALIERS_RESOLUTION = [
  { width: 3840, height: 2160 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

// Caméra choisie par l'utilisateur, retrouvée à l'ouverture suivante : le
// comptable qui branche une webcam HD n'a pas à la resélectionner à chaque
// élève. On garde son identifiant ET son nom : le navigateur peut renouveler
// les identifiants (permission non enregistrée, navigation privée, données
// du site effacées), le nom (« HD Pro Webcam C920 ») permet alors de la
// retrouver.
export const CLE_CAMERA_PREFEREE = "edugest_camera_photo";

export function lirePreferenceCamera(brut) {
  if (!brut) return { deviceId: "", label: "" };
  try {
    const p = JSON.parse(brut);
    return { deviceId: String(p?.deviceId || ""), label: String(p?.label || "") };
  } catch {
    return { deviceId: String(brut), label: "" };
  }
}

export const ecrirePreferenceCamera = (deviceId, label = "") => JSON.stringify({ deviceId, label });

// Caméra mémorisée dont l'identifiant a changé, retrouvée par son nom parmi
// les caméras présentes ; null si c'est déjà elle qui est ouverte.
export function cameraRetrouvee(cameras = [], preference, deviceIdOuvert) {
  if (!preference?.label || preference.deviceId === deviceIdOuvert) return null;
  const camera = cameras.find((c) => c.label === preference.label);
  return camera && camera.deviceId !== deviceIdOuvert ? camera : null;
}

const videoPalier = ({ width, height }) => ({
  width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30 },
});

// Tentatives getUserMedia, dans l'ordre. Sans caméra mémorisée, la caméra
// ARRIÈRE est demandée (ideal, donc sans échec sur un ordinateur à webcam
// unique) : sur téléphone c'est elle qui photographie un élève placé en face,
// avec la meilleure optique. Le dernier recours `video: true` laisse le
// navigateur décider seul.
export function tentativesCamera({ deviceId = "", facing = "environment" } = {}) {
  const tentatives = [];
  if (deviceId) {
    for (const palier of PALIERS_RESOLUTION) {
      tentatives.push({ parAppareil: true, contraintes: { audio: false, video: { ...videoPalier(palier), deviceId: { exact: deviceId } } } });
    }
  }
  for (const palier of PALIERS_RESOLUTION) {
    tentatives.push({ parAppareil: false, contraintes: { audio: false, video: { ...videoPalier(palier), facingMode: { ideal: facing } } } });
  }
  tentatives.push({ parAppareil: false, contraintes: { audio: false, video: true } });
  return tentatives;
}

// Accès refusé : inutile d'insister avec d'autres contraintes, la réponse
// de l'utilisateur (ou de la politique du site) ne changera pas.
export const estRefusCamera = (e) =>
  ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(e?.name);

// Caméra mémorisée débranchée (ou renommée) : on passe aux tentatives
// génériques sans réessayer les autres paliers de ce même appareil.
export const estAppareilIntrouvable = (e) =>
  ["OverconstrainedError", "ConstraintNotSatisfiedError", "NotFoundError", "DevicesNotFoundError"].includes(e?.name);

// Déroule les tentatives jusqu'au premier flux obtenu.
export async function ouvrirMeilleurFlux(getUserMedia, options = {}) {
  let derniereErreur = null;
  let appareilIntrouvable = false;
  for (const { parAppareil, contraintes } of tentativesCamera(options)) {
    if (parAppareil && appareilIntrouvable) continue;
    try {
      return await getUserMedia(contraintes);
    } catch (e) {
      if (estRefusCamera(e)) throw e;
      if (parAppareil && estAppareilIntrouvable(e)) appareilIntrouvable = true;
      derniereErreur = e;
    }
  }
  throw derniereErreur || new Error("Aucune caméra disponible");
}

// Libellé de définition, d'après le PETIT côté (une image portrait de
// téléphone, 1080×1920, est du Full HD comme 1920×1080).
export function libelleResolution(largeur, hauteur) {
  const petitCote = Math.min(Number(largeur) || 0, Number(hauteur) || 0);
  if (!petitCote) return "";
  const qualite = petitCote >= 2160 ? "4K"
    : petitCote >= 1440 ? "QHD"
      : petitCote >= 1080 ? "Full HD"
        : petitCote >= 720 ? "HD" : "SD";
  return `${largeur}×${hauteur} · ${qualite}`;
}

// Nom lisible d'une caméra. Chrome suffixe les webcams USB de leur
// identifiant matériel « (046d:0825) », sans intérêt pour l'utilisateur.
export function libelleCamera(camera, index = 0) {
  const brut = String(camera?.label || "").replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "").trim();
  return brut || `Caméra ${index + 1}`;
}

// Caméra suivante dans la liste (bouton de bascule), en boucle.
export function cameraSuivante(cameras = [], deviceIdActif = "") {
  if (!cameras.length) return null;
  const i = cameras.findIndex((camera) => camera.deviceId === deviceIdActif);
  return cameras[(i + 1) % cameras.length];
}

// Miroir de l'aperçu : une caméra tournée vers l'utilisateur s'affiche comme
// un miroir (se placer devient naturel). Les webcams d'ordinateur ne
// déclarent souvent AUCUNE orientation : elles font face à l'utilisateur.
// La photo enregistrée, elle, n'est jamais inversée.
export const apercuEnMiroir = (facingMode) => facingMode !== "environment";
