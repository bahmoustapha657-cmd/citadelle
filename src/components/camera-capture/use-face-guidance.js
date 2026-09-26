import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  analyserCadrage, mesurerLumiere, versVisages, visagePrincipal, zoneAnalyse, zoneLoupe, zoneLumiere,
} from "./photo-framing";
import { dessinerPourAnalyse, figerImage, libererCanvas, recadrerPhoto } from "./photo-capture";

// Guidage du visage pendant l'aperçu : le détecteur (chargé à la demande)
// analyse ~8 images par seconde une copie réduite de la vidéo, et chaque
// analyse devient une consigne (« Approchez-vous », « Redressez la tête »…).
// Cadrage bon et stable pendant DUREE_AUTO_MS → photo automatique. La prise
// de vue elle-même vit ici : le recadrage dépend du détecteur.
//
// Sans détecteur (appareil sans WebGL2 ni WebAssembly, chargement impossible)
// la caméra reste pleinement utilisable : on cadre à l'œil dans l'ovale.

const INTERVALLE_MS = 120;
export const DUREE_AUTO_MS = 1200;
// La lumière varie lentement : une mesure toutes les 4 analyses suffit.
const MESURE_LUMIERE_TOUTES = 4;
// Visage de la dernière analyse, réutilisé pour recadrer une capture si
// l'image figée elle-même ne peut pas être analysée.
const FRAICHEUR_VISAGE_MS = 600;
// La mesure de lumière se fait sur une vignette : quelques milliers de
// pixels suffisent.
const COTE_VIGNETTE_LUMIERE = 64;
// Un visage manqué sur une seule image (flou de bougé, première image de la
// caméra) ne doit ni afficher « Aucun visage » ni relancer le compte à
// rebours de la photo automatique : l'absence ne compte qu'à la 3e analyse
// consécutive (~0,4 s).
const ABSENCES_TOLEREES = 3;

const chargerModule = () => import("./face-detector.js");

// Détection en deux passes (cf. zoneAnalyse / zoneLoupe) : la zone de
// l'aperçu, puis, si elle ne contient aucun visage, la loupe sur son centre.
// Renvoie les visages en pixels de l'image entière, et la zone qui les a
// fournis (le canvas en garde la copie).
function detecterVisages(detecteur, source, largeur, hauteur, canvas, coteMax) {
  let zone = null;
  for (zone of [zoneAnalyse(largeur, hauteur), zoneLoupe(largeur, hauteur)]) {
    dessinerPourAnalyse(source, zone, canvas, coteMax);
    const visages = versVisages(detecteur.detecter(canvas), {
      largeurAnalyse: canvas.width, hauteurAnalyse: canvas.height, zone,
    });
    if (visages.length) return { visages, zone };
  }
  return { visages: [], zone };
}

// `onPhoto` reçoit { dataUrl, largeur, hauteur, recadree } à chaque prise,
// manuelle (capturer) ou automatique.
export function useFaceGuidance({ videoRef, actif, auto, onPhoto }) {
  const [statut, setStatut] = useState("chargement");
  const [guidage, setGuidage] = useState(null);
  const detecteurRef = useRef(null);
  const dernierVisageRef = useRef(null);

  // Image figée en pleine définition, visage recherché sur CETTE image (le
  // sujet a pu bouger depuis la dernière analyse), puis recadrage.
  const capturer = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const image = figerImage(video);
    let visage = null;
    if (detecteurRef.current) {
      const analyse = document.createElement("canvas");
      try {
        visage = visagePrincipal(
          detecterVisages(detecteurRef.current, image, image.width, image.height, analyse, 640).visages,
        ).principal;
      } catch { /* recadrage sur la dernière analyse */ }
      libererCanvas(analyse);
    }
    if (!visage) {
      const dernier = dernierVisageRef.current;
      if (dernier && performance.now() - dernier.instant < FRAICHEUR_VISAGE_MS) visage = dernier.visage;
    }
    const photo = recadrerPhoto(image, visage);
    libererCanvas(image);
    onPhoto(photo);
  };

  useEffect(() => {
    let annule = false;
    chargerModule()
      .then((module) => module.chargerDetecteurVisage())
      .then((detecteur) => {
        if (annule) return;
        detecteurRef.current = detecteur;
        setStatut("pret");
      })
      .catch(() => { if (!annule) setStatut("indisponible"); });
    return () => { annule = true; };
  }, []);

  const declencherAuto = useEffectEvent(() => { if (auto) capturer(); });

  useEffect(() => {
    if (!actif || statut !== "pret") return undefined;
    const canvas = document.createElement("canvas");
    const vignette = document.createElement("canvas");
    let raf = 0;
    let derniere = 0;
    let numero = 0;
    let precedent = null;
    let lumiere = null;
    let debutBon = 0;
    let absences = 0;

    const analyser = (maintenant) => {
      raf = requestAnimationFrame(analyser);
      if (maintenant - derniere < INTERVALLE_MS) return;
      derniere = maintenant;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      const largeur = video.videoWidth;
      const hauteur = video.videoHeight;
      let detection;
      try {
        detection = detecterVisages(detecteurRef.current, video, largeur, hauteur, canvas, 480);
      } catch {
        // Détecteur hors d'usage (contexte graphique perdu…) : la prise de vue
        // continue sans guidage ; la prochaine ouverture en recrée un.
        cancelAnimationFrame(raf);
        chargerModule().then((module) => module.oublierDetecteurVisage());
        detecteurRef.current = null;
        setStatut("indisponible");
        return;
      }

      const { visages, zone } = detection;
      const { principal } = visagePrincipal(visages);
      absences = principal ? 0 : absences + 1;
      if (absences && absences < ABSENCES_TOLEREES) return;
      if (!principal) lumiere = null;
      else if (numero % MESURE_LUMIERE_TOUTES === 0) lumiere = mesurerZone(canvas, vignette, principal, zone);
      numero += 1;

      const resultat = analyserCadrage({ visages, largeur, hauteur, precedent, lumiere });
      precedent = resultat.visage;
      dernierVisageRef.current = resultat.visage ? { visage: resultat.visage, instant: maintenant } : null;

      debutBon = resultat.bon ? (debutBon || maintenant) : 0;
      const progression = debutBon ? Math.min(1, (maintenant - debutBon) / DUREE_AUTO_MS) : 0;
      setGuidage({ ...resultat, largeur, hauteur, progression });
      if (progression >= 1) {
        debutBon = 0;
        declencherAuto();
      }
    };

    raf = requestAnimationFrame(analyser);
    return () => cancelAnimationFrame(raf);
  }, [actif, statut, videoRef]);

  return { statut, guidage, capturer };
}

// Exposition mesurée sur le centre du visage : la zone est copiée du canvas
// d'analyse (qui représente `zone` de l'image) dans une vignette lue par le
// processeur (willReadFrequently), le canvas d'analyse restant sur la carte
// graphique.
function mesurerZone(canvas, vignette, visage, zone) {
  const ex = canvas.width / zone.w;
  const ey = canvas.height / zone.h;
  const z = zoneLumiere(visage);
  const x = Math.max(0, (z.x - zone.x) * ex);
  const y = Math.max(0, (z.y - zone.y) * ey);
  const w = Math.min(canvas.width - x, z.w * ex);
  const h = Math.min(canvas.height - y, z.h * ey);
  if (w < 2 || h < 2) return null;
  const reduction = Math.min(1, COTE_VIGNETTE_LUMIERE / Math.max(w, h));
  vignette.width = Math.max(1, Math.round(w * reduction));
  vignette.height = Math.max(1, Math.round(h * reduction));
  try {
    const ctx = vignette.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, x, y, w, h, 0, 0, vignette.width, vignette.height);
    return mesurerLumiere(ctx.getImageData(0, 0, vignette.width, vignette.height).data);
  } catch {
    return null;
  }
}
