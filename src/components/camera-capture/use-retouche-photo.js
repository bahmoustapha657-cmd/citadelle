import { useEffect, useMemo, useRef, useState } from "react";
import { FOND_ORIGINAL, enregistrerFond, normaliserCouleur } from "./fond-photo";
import { libererCanvas } from "./photo-capture";
import {
  chargerPhoto, detourerImage, exporterRetouche, pixelsDuCadre, tailleRetouche, tournerImage, trouverVisage,
} from "./rendu-retouche";
import {
  REGLAGES_NEUTRES, cadrageSurVisage, deplacerCadre, estNeutre, memoireRetouche, normaliserReglages,
  sourceRetouche, tonsAuto, tourner, zoomerCadre,
} from "./retouche";

const stockage = () => {
  try { return window.localStorage; } catch { return null; }
};

const MESSAGE_FOND_INDISPONIBLE = "Changement de fond indisponible sur cet appareil : la photo garde son fond d'origine.";

// État de la retouche d'une photo (RetouchePhoto.jsx). Part de l'ORIGINE de
// la photo si elle a déjà été retouchée (`retouche`, cf. sourceRetouche),
// avec ses réglages d'alors. L'image de travail est refaite à chaque quart
// de tour ; le détourage, une fois par quart de tour et seulement si un fond
// est choisi — zoom, déplacement, lumière et couleur ne refont que le rendu.
export function useRetouchePhoto({ photo, retouche = null }) {
  // Point de départ figé à l'ouverture.
  const [depart] = useState(() => sourceRetouche(photo, retouche));
  const [img, setImg] = useState(null);
  const [erreurChargement, setErreurChargement] = useState("");
  const [reglages, setReglages] = useState(depart.reglages);
  const [masque, setMasque] = useState({ canvas: null, valeur: null, erreur: "" });
  const detourage = useRef({ canvas: null, promesse: null });
  const [visage, setVisage] = useState({ enCours: false, message: "" });

  useEffect(() => {
    let annule = false;
    chargerPhoto(depart.source)
      .then((i) => { if (!annule) setImg(i); })
      .catch((e) => { if (!annule) setErreurChargement(e.message); });
    return () => { annule = true; };
  }, [depart.source]);

  // { rotation, canvas } : image de travail du quart de tour courant.
  const { rotation } = reglages;
  const image = useMemo(() => {
    if (!img) return null;
    try {
      return { rotation, canvas: tournerImage(img, rotation), erreur: "" };
    } catch (e) {
      return { rotation, canvas: null, erreur: e.message };
    }
  }, [img, rotation]);
  // L'image précédente (photo pleine définition) est rendue à la mémoire :
  // Safari iOS plafonne la mémoire des canvas.
  useEffect(() => () => libererCanvas(image?.canvas), [image]);
  const erreur = erreurChargement || image?.erreur || "";
  const travail = image?.canvas || null;

  const avecFond = reglages.fond !== FOND_ORIGINAL;
  useEffect(() => {
    if (!travail || !avecFond) return undefined;
    if (detourage.current.canvas !== travail) {
      detourage.current = { canvas: travail, promesse: detourerImage(travail) };
    }
    const enCours = detourage.current;
    let annule = false;
    enCours.promesse
      .then((valeur) => { if (!annule) setMasque({ canvas: enCours.canvas, valeur, erreur: "" }); })
      .catch(() => {
        // Oublié : un autre choix retentera (modèle pas encore en cache…).
        if (detourage.current === enCours) detourage.current = { canvas: null, promesse: null };
        if (!annule) setMasque({ canvas: enCours.canvas, valeur: null, erreur: MESSAGE_FOND_INDISPONIBLE });
      });
    return () => { annule = true; };
  }, [travail, avecFond]);

  const masqueCourant = travail && masque.canvas === travail ? masque : { valeur: null, erreur: "" };
  const detourageEnCours = !!travail && avecFond && !masqueCourant.valeur && !masqueCourant.erreur;

  // Réglages qui dépendent de la taille de l'image de travail.
  const avecImage = (calcul) => {
    if (!travail) return;
    const { width: largeur, height: hauteur } = travail;
    setReglages((r) => normaliserReglages({ ...r, ...calcul(r, largeur, hauteur) }));
  };

  const changer = (champs) => setReglages((r) => normaliserReglages({ ...r, ...champs }));
  const choisirFond = (valeur) => {
    const fond = normaliserCouleur(valeur) || FOND_ORIGINAL;
    changer({ fond });
    // Comme à la prise de vue : le fond choisi sera proposé aux photos suivantes.
    enregistrerFond(stockage(), fond);
  };

  const centrerVisage = async () => {
    if (!travail || visage.enCours) return;
    setVisage({ enCours: true, message: "" });
    try {
      const trouve = await trouverVisage(travail);
      if (!trouve) { setVisage({ enCours: false, message: "Aucun visage trouvé : cadrez à la main (glisser, zoom)." }); return; }
      avecImage((_, l, h) => cadrageSurVisage(trouve, l, h));
      setVisage({ enCours: false, message: "" });
    } catch {
      setVisage({ enCours: false, message: "Détection du visage indisponible sur cet appareil : cadrez à la main." });
    }
  };

  const exporter = () => {
    if (!travail) return null;
    const { width: largeur, height: hauteur } = travail;
    // Masque indisponible : la photo garde son fond d'origine.
    const r = masqueCourant.valeur ? reglages : { ...reglages, fond: FOND_ORIGINAL };
    if (estNeutre(r, largeur, hauteur)) return { photo: depart.source, retouche: null };
    const resultat = exporterRetouche(travail, masqueCourant.valeur, r);
    return { photo: resultat, retouche: memoireRetouche(depart.source, r, resultat) };
  };

  const taille = travail ? tailleRetouche(travail, reglages) : null;
  return {
    erreur,
    image: travail,
    masque: masqueCourant.valeur,
    erreurFond: avecFond ? masqueCourant.erreur : "",
    detourageEnCours,
    reglages,
    taille,
    neutre: !!travail && estNeutre(reglages, travail.width, travail.height),
    changer,
    choisirFond,
    deplacer: (dx, dy, largeurApercu) => avecImage((r, l, h) => deplacerCadre(l, h, r, dx, dy, largeurApercu)),
    zoomer: (zoom, fx, fy) => avecImage((r, l, h) => zoomerCadre(l, h, r, typeof zoom === "function" ? zoom(r.zoom) : zoom, fx, fy)),
    tourner: (sens) => setReglages((r) => tourner(r, sens)),
    centrerVisage,
    visage,
    lumiereAuto: () => { if (travail) changer(tonsAuto(pixelsDuCadre(travail, reglages))); },
    reinitialiser: () => setReglages({ ...REGLAGES_NEUTRES }),
    exporter,
  };
}
