import { useEffect, useRef } from "react";
import { dessinerImageEntiere } from "./rendu-retouche";
import { COINS, deplacerZone, redimensionnerZone, zoneCadrage } from "./retouche";

// Définition du canvas (grand côté) : nette sur un téléphone, légère à
// redessiner quand la lumière ou le fond changent.
const COTE_APERCU = 640;

const POIGNEE = 26;
const MARGE = 14;
const placeCoin = {
  hg: { left: 0, top: 0, cursor: "nwse-resize" },
  hd: { left: "100%", top: 0, cursor: "nesw-resize" },
  bg: { left: 0, top: "100%", cursor: "nesw-resize" },
  bd: { left: "100%", top: "100%", cursor: "nwse-resize" },
};
const nomCoin = { hg: "haut gauche", hd: "haut droit", bg: "bas gauche", bd: "bas droit" };
const tiers = (vertical, position) => ({
  position: "absolute", background: "rgba(255,255,255,0.45)", pointerEvents: "none",
  ...(vertical ? { left: position, top: 0, bottom: 0, width: 1 } : { top: position, left: 0, right: 0, height: 1 }),
});

// Vue « Recadrer » de la retouche (RetouchePhoto) : la photo ENTIÈRE, et
// par-dessus le cadre 3:4 de la photo finale, le reste assombri. Glisser
// (dans le cadre ou autour) déplace le cadre ; tirer un coin l'agrandit ou
// le rétrécit. Chaque geste repart des réglages du début du geste : pas
// d'erreur qui s'accumule. `onCadrage({ zoom?, cx, cy })`.
export function VueRecadrage({ image, masque, reglages, onCadrage }) {
  const canvasRef = useRef(null);
  const zoneRef = useRef(null);
  const geste = useRef(null);
  const { width: largeur, height: hauteur } = image;
  const echelle = Math.min(1, COTE_APERCU / Math.max(largeur, hauteur));
  const { luminosite, contraste, fond, contour } = reglages;

  // Redessinée seulement quand l'image, la lumière ou le fond changent : le
  // cadre, lui, est en HTML par-dessus.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const id = requestAnimationFrame(() => dessinerImageEntiere(canvas, image, masque, { luminosite, contraste, fond, contour }));
    return () => cancelAnimationFrame(id);
  }, [image, masque, luminosite, contraste, fond, contour]);

  const commencer = (type) => (e) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointeur déjà relâché */ }
    const b = zoneRef.current.getBoundingClientRect();
    geste.current = { type, id: e.pointerId, x: e.clientX, y: e.clientY, k: largeur / Math.max(1, b.width), depart: reglages };
  };
  const suivre = (e) => {
    const g = geste.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = (e.clientX - g.x) * g.k;
    const dy = (e.clientY - g.y) * g.k;
    onCadrage(g.type === "deplacer"
      ? deplacerZone(largeur, hauteur, g.depart, dx, dy)
      : redimensionnerZone(largeur, hauteur, g.depart, g.type, dx, dy));
  };
  const finir = (e) => { if (geste.current?.id === e.pointerId) geste.current = null; };
  // Sur le conteneur seulement : les événements d'une poignée (capturés par
  // elle) remontent jusqu'à lui.
  const evenements = { onPointerMove: suivre, onPointerUp: finir, onPointerCancel: finir };

  const z = zoneCadrage(largeur, hauteur, reglages);
  const pourcent = (v, total) => `${(v / total) * 100}%`;

  // Marge autour de la photo : les poignées d'un cadre collé au bord
  // restent entières sous le doigt.
  return (
    <div onPointerDown={commencer("deplacer")} {...evenements}
      style={{ padding: MARGE, width: `max(200px, min(100%, calc((100vh - 360px) * ${largeur / hauteur} + ${2 * MARGE}px)))`, margin: "0 auto", boxSizing: "border-box", overflow: "hidden", borderRadius: 12, background: "#0f172a", touchAction: "none", userSelect: "none", cursor: "move" }}>
      <div ref={zoneRef} style={{ position: "relative", width: "100%", aspectRatio: `${largeur} / ${hauteur}` }}>
        <canvas ref={canvasRef} width={Math.round(largeur * echelle)} height={Math.round(hauteur * echelle)}
          aria-label="Photo entière" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}/>
        <div aria-label="Cadre de la photo"
          style={{ position: "absolute", left: pourcent(z.x, largeur), top: pourcent(z.y, hauteur), width: pourcent(z.w, largeur), height: pourcent(z.h, hauteur), boxSizing: "border-box", border: "2px solid #fff", boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)", pointerEvents: "none" }}>
          <div style={tiers(true, "33.33%")}/>
          <div style={tiers(true, "66.67%")}/>
          <div style={tiers(false, "33.33%")}/>
          <div style={tiers(false, "66.67%")}/>
          {COINS.map((coin) => (
            <div key={coin} aria-hidden="true" title={`Coin ${nomCoin[coin]} : tirer pour agrandir ou rétrécir le cadre`}
              onPointerDown={commencer(coin)}
              style={{ position: "absolute", ...placeCoin[coin], width: POIGNEE, height: POIGNEE, transform: "translate(-50%, -50%)", pointerEvents: "auto", touchAction: "none" }}>
              <span style={{ position: "absolute", inset: 6, background: "#fff", border: "2px solid #2563eb", borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
