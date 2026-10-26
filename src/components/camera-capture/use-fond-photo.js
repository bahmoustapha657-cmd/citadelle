import { useEffect, useRef, useState } from "react";
import { FOND_ORIGINAL, enregistrerFond, lireFond, normaliserCouleur } from "./fond-photo";
import { libererCanvas } from "./photo-capture";

const stockage = () => {
  try { return window.localStorage; } catch { return null; }
};

const MESSAGE_INDISPONIBLE = "Changement de fond indisponible sur cet appareil : la photo garde son fond d'origine.";

// Fond de la photo en cours de vérification (`revue`, celle de
// CameraCapture). Le choix est gardé d'une photo à l'autre ; le détourage
// est fait une fois par photo, chaque couleur ne refait que la fusion.
// Renvoie la photo à montrer et à utiliser : l'originale tant que le fond
// n'est pas prêt, ou si le détourage est impossible sur l'appareil.
export function useFondPhoto(revue) {
  const [fond, setFond] = useState(() => lireFond(stockage()));
  const [resultat, setResultat] = useState({ source: null, fond: null, dataUrl: null, erreur: "" });
  // { source, promesse } : détourage de la photo `source` (module + masque).
  const detourage = useRef({ source: null, promesse: null });
  const source = revue?.dataUrl || null;

  const choisirFond = (valeur) => {
    const choix = normaliserCouleur(valeur) || FOND_ORIGINAL;
    setFond(choix);
    enregistrerFond(stockage(), choix);
  };

  useEffect(() => {
    if (!source || fond === FOND_ORIGINAL) return undefined;
    let annule = false;
    if (detourage.current.source !== source) {
      detourage.current.promesse?.then(({ d }) => libererCanvas(d.canvas)).catch(() => {});
      detourage.current = {
        source,
        promesse: import("./detourage").then((m) => m.detourerPhoto(source).then((d) => ({ m, d }))),
      };
    }
    const enCours = detourage.current;
    enCours.promesse
      .then(({ m, d }) => {
        if (!annule) setResultat({ source, fond, dataUrl: m.appliquerFond(d, fond), erreur: "" });
      })
      .catch(() => {
        // Oublié : un autre choix retentera (modèle pas encore en cache…).
        if (detourage.current === enCours) detourage.current = { source: null, promesse: null };
        if (!annule) setResultat({ source, fond, dataUrl: null, erreur: MESSAGE_INDISPONIBLE });
      });
    return () => { annule = true; };
  }, [source, fond]);

  // Fermeture de la caméra : le canvas détouré (photo pleine définition)
  // est rendu à la mémoire — Safari iOS plafonne la mémoire des canvas.
  useEffect(() => {
    const memo = detourage;
    return () => { memo.current.promesse?.then(({ d }) => libererCanvas(d.canvas)).catch(() => {}); };
  }, []);

  const avecFond = !!source && fond !== FOND_ORIGINAL;
  const aJour = resultat.source === source && resultat.fond === fond;
  return {
    fond,
    choisirFond,
    photo: avecFond && aJour && resultat.dataUrl ? resultat.dataUrl : source,
    enCours: avecFond && !aJour,
    erreur: avecFond && aJour ? resultat.erreur : "",
  };
}
