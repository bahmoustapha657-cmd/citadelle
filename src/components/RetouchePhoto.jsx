import { useContext, useEffect, useRef, useState } from "react";
import { C } from "../constants";
import { Btn } from "./ui";
import { SchoolContext } from "../contexts/SchoolContext";
import { ChoixFond } from "./camera-capture/ChoixFond";
import { VueRecadrage } from "./camera-capture/VueRecadrage";
import { dessinerApercu } from "./camera-capture/rendu-retouche";
import { TON_MAX, ZOOM_MAX } from "./camera-capture/retouche";
import { useRetouchePhoto } from "./camera-capture/use-retouche-photo";

// Modale de retouche d'une photo d'élève DÉJÀ prise, sans reprendre l'enfant
// en photo : quart de tour, zoom et déplacement (au doigt, à la souris ou aux
// curseurs), vue « Recadrer » (la photo entière et son cadre 3:4 à déplacer
// ou à tirer par les coins, VueRecadrage), recentrage automatique sur le
// visage, luminosité et contraste,
// fond uni à la place du décor. Si la photo a déjà été retouchée, on repart
// de son ORIGINE avec les réglages d'alors (use-retouche-photo).
//
// `onValider(photo, retouche)` : `photo` = data URL de la nouvelle photo (ou
// l'origine elle-même si plus rien n'est retouché), `retouche` = mémoire à
// garder dans la fiche (cf. finaliserRetouche) ou null. Peut être async :
// la modale attend et montre l'erreur éventuelle.

// Définition de l'aperçu (pixels du canvas) : nette sur un écran de
// téléphone, assez légère pour suivre le doigt.
const APERCU = { largeur: 480, hauteur: 640 };
// En dessous, la photo produite manque de détail (zoom trop fort).
const HAUTEUR_PHOTO_CONSEILLEE = 480;

const styleTitre = { margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "#334155" };
const styleCurseur = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", marginTop: 6 };

function Curseur({ libelle, aide, min, max, step, value, onChange }) {
  return (
    <label style={styleCurseur}>
      <strong style={{ whiteSpace: "nowrap", minWidth: 92 }}>{libelle}</strong>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={aide} style={{ flex: 1, minWidth: 0 }}/>
      <span style={{ fontSize: 11, color: "#64748b", minWidth: 30, textAlign: "end" }}>
        {value > 0 && step >= 1 ? `+${value}` : step < 1 ? `×${Number(value).toFixed(1)}` : value}
      </span>
    </label>
  );
}

export function RetouchePhoto({ photo, retouche = null, onValider, onClose }) {
  const r = useRetouchePhoto({ photo, retouche });
  const { schoolInfo } = useContext(SchoolContext);
  const canvasRef = useRef(null);
  const zoneRef = useRef(null);
  const pointeurs = useRef(new Map());
  const pincement = useRef(null);
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: "" });
  const [recadrer, setRecadrer] = useState(false);
  const { reglages, image, masque, zoomer } = r;

  // Aperçu redessiné à chaque réglage, une fois par image affichée (et au
  // retour de la vue « Recadrer », qui remonte son canvas).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || recadrer) return undefined;
    const id = requestAnimationFrame(() => dessinerApercu(canvas, image, masque, reglages));
    return () => cancelAnimationFrame(id);
  }, [image, masque, reglages, recadrer]);

  // Molette : zoom autour du pointeur. Écouteur non passif (React les rend
  // passifs) pour que la page ne défile pas en même temps.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return undefined;
    const surMolette = (e) => {
      e.preventDefault();
      const b = zone.getBoundingClientRect();
      zoomer((z) => z * Math.exp(-e.deltaY * 0.0015), (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
    };
    zone.addEventListener("wheel", surMolette, { passive: false });
    return () => zone.removeEventListener("wheel", surMolette);
  }, [zoomer]);

  const position = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top, largeur: b.width, hauteur: b.height };
  };
  const surAppui = (e) => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointeur déjà relâché */ }
    pointeurs.current.set(e.pointerId, position(e));
    pincement.current = null;
  };
  // Un doigt : déplacer. Deux doigts : pincer pour zoomer.
  const surGlisse = (e) => {
    const avant = pointeurs.current.get(e.pointerId);
    if (!avant) return;
    const p = position(e);
    pointeurs.current.set(e.pointerId, p);
    if (pointeurs.current.size === 1) { r.deplacer(p.x - avant.x, p.y - avant.y, p.largeur); return; }
    const [a, b] = [...pointeurs.current.values()];
    const ecart = Math.hypot(a.x - b.x, a.y - b.y);
    if (!pincement.current) { pincement.current = { ecart, zoom: reglages.zoom }; return; }
    zoomer(pincement.current.zoom * (ecart / Math.max(1, pincement.current.ecart)),
      (a.x + b.x) / 2 / p.largeur, (a.y + b.y) / 2 / p.hauteur);
  };
  const surLacher = (e) => {
    pointeurs.current.delete(e.pointerId);
    pincement.current = null;
  };

  const utiliser = async () => {
    const resultat = r.exporter();
    if (!resultat) return;
    setEnvoi({ enCours: true, erreur: "" });
    try {
      await onValider(resultat.photo, resultat.retouche);
      onClose();
    } catch (e) {
      setEnvoi({ enCours: false, erreur: "Erreur à l'enregistrement : " + (e?.message || e) });
    }
  };

  const occupe = envoi.enCours || r.detourageEnCours;
  const petite = r.taille && r.taille.hauteur < HAUTEUR_PHOTO_CONSEILLEE;

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier la photo de l'élève"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 10, boxSizing: "border-box" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, maxWidth: 480, width: "100%", maxHeight: "100%", overflowY: "auto", boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", textAlign: "left", lineHeight: 1.4 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 800, color: C.blueDark, fontSize: 15 }}>✏️ Modifier la photo</p>

        {r.erreur ? (
          <p style={{ color: "#b91c1c", fontSize: 13, background: "#fee2e2", padding: "10px 14px", borderRadius: 8 }}>{r.erreur}</p>
        ) : recadrer && image ? (
          <VueRecadrage image={image} masque={masque} reglages={reglages} onCadrage={r.changer}/>
        ) : (
          <div ref={zoneRef}
            onPointerDown={surAppui} onPointerMove={surGlisse} onPointerUp={surLacher} onPointerCancel={surLacher}
            style={{ position: "relative", width: "max(200px, min(100%, calc((100vh - 360px) * 0.75)))", aspectRatio: "3 / 4", margin: "0 auto", borderRadius: 12, overflow: "hidden", background: "#0f172a", touchAction: "none", cursor: image ? "grab" : "default", userSelect: "none" }}>
            <canvas ref={canvasRef} width={APERCU.largeur} height={APERCU.hauteur} aria-label="Aperçu de la photo"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}/>
            {(!image || r.detourageEnCours) && (
              <p style={{ position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)", margin: 0, background: "rgba(15,23,42,0.78)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
                {image ? "Changement du fond…" : "Ouverture de la photo…"}
              </p>
            )}
          </div>
        )}

        {image && !r.erreur && (
          <>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b", textAlign: "center" }}>
              {recadrer
                ? "Glissez le cadre pour le déplacer ; tirez un coin pour l'agrandir ou le rétrécir (format de la carte, 3:4)."
                : "Glissez la photo pour la déplacer ; pincez (ou la molette) pour zoomer."}
              {r.taille && ` Photo finale : ${r.taille.largeur}×${r.taille.hauteur} px.`}
            </p>

            <p style={styleTitre}>✂️ Cadrage</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Btn sm v={recadrer ? "vert" : "ghost"} onClick={() => setRecadrer(!recadrer)} aria-pressed={recadrer}
                title="Voir la photo entière et choisir la partie gardée">
                {recadrer ? "✓ Terminer le recadrage" : "✂️ Recadrer"}
              </Btn>
              {recadrer && <Btn sm v="ghost" onClick={() => r.changer({ zoom: 1, cx: 0.5, cy: 0.5 })}
                title="Le plus grand cadre possible">⤢ Toute la photo</Btn>}
              <Btn sm v="ghost" onClick={() => r.tourner(-1)} title="Tourner d'un quart de tour à gauche" aria-label="Tourner à gauche">⟲ Tourner</Btn>
              <Btn sm v="ghost" onClick={() => r.tourner(1)} title="Tourner d'un quart de tour à droite" aria-label="Tourner à droite">⟳ Tourner</Btn>
              <Btn sm v="ghost" onClick={r.centrerVisage} disabled={r.visage.enCours}
                title="Recadrer comme une photo d'identité, centrée sur le visage">
                {r.visage.enCours ? "⏳ Recherche du visage…" : "🎯 Centrer le visage"}
              </Btn>
            </div>
            {r.visage.message && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#92400e" }}>{r.visage.message}</p>}
            <Curseur libelle="🔍 Zoom" aide="Zoom" min={1} max={ZOOM_MAX} step={0.05}
              value={reglages.zoom} onChange={(z) => zoomer(z)}/>
            {/* Sous les boutons : son apparition ne les déplace pas sous le doigt. */}
            {petite && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "8px 10px", borderRadius: 8 }}>
                💡 Zoom fort : la photo perd en netteté. Dézoomez un peu, ou reprenez la photo de plus près.
              </p>
            )}

            <p style={styleTitre}>☀️ Lumière</p>
            <Curseur libelle="Luminosité" aide="Luminosité : plus sombre ou plus clair" min={-TON_MAX} max={TON_MAX} step={5}
              value={reglages.luminosite} onChange={(luminosite) => r.changer({ luminosite })}/>
            <Curseur libelle="Contraste" aide="Contraste" min={-TON_MAX} max={TON_MAX} step={5}
              value={reglages.contraste} onChange={(contraste) => r.changer({ contraste })}/>
            <div style={{ marginTop: 6 }}>
              <Btn sm v="ghost" onClick={r.lumiereAuto} title="Éclaircir une photo trop sombre et lui redonner du relief">✨ Lumière automatique</Btn>
            </div>

            <ChoixFond fond={reglages.fond} choisirFond={r.choisirFond} couleurEcole={schoolInfo?.couleur1}
              enCours={r.detourageEnCours} erreur={r.erreurFond}
              reglage={reglages.contour} choisirContour={(contour) => r.changer({ contour })}/>
          </>
        )}

        {envoi.erreur && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#b91c1c" }}>{envoi.erreur}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn v="ghost" onClick={onClose} disabled={envoi.enCours}>Annuler</Btn>
          {image && !r.erreur && (
            <>
              <Btn v="ghost" onClick={r.reinitialiser} disabled={envoi.enCours || r.neutre}
                title="Revenir à la photo telle qu'elle a été prise">↺ Photo d'origine</Btn>
              <Btn v="vert" onClick={utiliser} disabled={occupe}>
                {envoi.enCours ? "⏳ Enregistrement…" : "✓ Utiliser cette photo"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
