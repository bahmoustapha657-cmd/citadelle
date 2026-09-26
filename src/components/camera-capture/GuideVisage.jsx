import { useId } from "react";
import { OVALE, versApercu } from "./photo-framing";

// Calque de l'aperçu (repère 300×400 du cadre visible 3:4) : ovale où placer
// la tête, extérieur assombri, boîte du visage détecté, et anneau qui se
// remplit avant la photo automatique.
const VUE = { largeur: 300, hauteur: 400 };
const CX = OVALE.cx * VUE.largeur;
const CY = OVALE.cy * VUE.hauteur;
const RX = OVALE.rx * VUE.largeur;
const RY = OVALE.ry * VUE.hauteur;
// Ovale tracé depuis son sommet, dans le sens horaire : l'anneau de
// progression part du haut.
const TRACE_OVALE = `M ${CX} ${CY - RY} A ${RX} ${RY} 0 1 1 ${CX} ${CY + RY} A ${RX} ${RY} 0 1 1 ${CX} ${CY - RY}`;

const COULEURS_GUIDAGE = {
  neutre: "rgba(255,255,255,0.92)",
  attention: "#fbbf24",
  bon: "#22c55e",
};

// Coins de visée autour du visage détecté (plus discrets qu'un rectangle).
const coinsVisee = ({ x, y, w, h }) => {
  const l = Math.min(w, h) * 0.2;
  return `M ${x} ${y + l} L ${x} ${y} L ${x + l} ${y} M ${x + w - l} ${y} L ${x + w} ${y} L ${x + w} ${y + l} `
    + `M ${x + w} ${y + h - l} L ${x + w} ${y + h} L ${x + w - l} ${y + h} M ${x + l} ${y + h} L ${x} ${y + h} L ${x} ${y + h - l}`;
};

const couleurGuidage = (guidage) => (
  !guidage || guidage.etat === "absent" ? COULEURS_GUIDAGE.neutre
    : guidage.bon || guidage.etat === "bouge" ? COULEURS_GUIDAGE.bon : COULEURS_GUIDAGE.attention
);

// `progression` (0 à 1) : remplissage de l'anneau, seulement quand la photo
// automatique est active — sinon il promettrait un déclenchement qui n'a
// pas lieu.
export function GuideVisage({ guidage, miroir, progression = 0 }) {
  const masque = useId();
  const couleur = couleurGuidage(guidage);
  let boite = null;
  if (guidage?.visage && guidage.region) {
    boite = versApercu(guidage.visage, guidage.region, VUE);
    // L'aperçu est inversé (miroir), l'analyse ne l'est pas.
    if (miroir) boite = { ...boite, x: VUE.largeur - boite.x - boite.w };
  }

  return (
    <svg viewBox={`0 0 ${VUE.largeur} ${VUE.hauteur}`} preserveAspectRatio="none" aria-hidden="true"
      style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
      <defs>
        <mask id={masque}>
          <rect width={VUE.largeur} height={VUE.hauteur} fill="white"/>
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="black"/>
        </mask>
      </defs>
      <rect width={VUE.largeur} height={VUE.hauteur} fill="rgba(0,0,0,0.38)" mask={`url(#${masque})`}/>
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke={couleur} strokeWidth={3}
        strokeDasharray={!guidage || guidage.etat === "absent" ? "10 7" : undefined}/>
      {progression > 0 && (
        <path d={TRACE_OVALE} fill="none" stroke={COULEURS_GUIDAGE.bon} strokeWidth={7}
          strokeLinecap="round" pathLength={1} strokeDasharray={`${progression} 1`}/>
      )}
      {boite && (
        <path d={coinsVisee(boite)} fill="none" stroke={couleur} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85}/>
      )}
    </svg>
  );
}
