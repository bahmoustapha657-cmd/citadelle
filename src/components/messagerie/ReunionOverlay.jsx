import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { formatChrono } from "./messagerie-logic";
import { ordreTuiles } from "./audio/reunion-logic";

function Chrono({ debut }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{formatChrono((maintenant - debut) / 1000)}</>;
}

function VideoFlux({ flux, miroir }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== flux) ref.current.srcObject = flux;
  }, [flux]);
  return (
    <video ref={ref} autoPlay playsInline muted
      style={{ width: "100%", height: "100%", objectFit: "cover", transform: miroir ? "scaleX(-1)" : undefined, background: "#000" }} />
  );
}

const commande = (fond, actif = true) => ({
  width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 21,
  background: fond, color: "#fff", opacity: actif ? 1 : 0.5,
  display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
});

// Écran de l'appel de groupe (plein écran, ou réduit en pastille pour
// continuer à naviguer). Tuiles : vidéo si la caméra est allumée et reçue,
// sinon initiales ; 🔇 quand le micro est coupé.
export function ReunionOverlay({ r, annuaire, moi, titre }) {
  const { reunion } = r;
  if (!reunion) return null;
  const tuiles = ordreTuiles(reunion.participants || [], moi);
  const nb = tuiles.length;
  const telephone = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  // Écran étroit : deux tuiles par ligne (un groupe de 4 tient sans défiler).
  const etroit = typeof window !== "undefined" && window.innerWidth < 640;

  if (reunion.reduite && reunion.phase === "en_cours") {
    return (
      <div role="dialog" aria-label="Appel de groupe en cours"
        // Au-dessus de la zone de saisie des discussions (bouton 📎).
        style={{ position: "fixed", zIndex: 1200, insetInlineStart: 16, bottom: 84, textAlign: "start", display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#065f46,#047857)", color: "#fff", borderRadius: 30, padding: "8px 8px 8px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", maxWidth: "calc(100vw - 32px)" }}>
        <span style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📞 {titre} · <Chrono debut={reunion.debut} /> · {nb} 👤
        </span>
        {!reunion.micro && <span title="Micro coupé">🔇</span>}
        <button type="button" onClick={() => r.reduire(false)} style={{ ...commande("rgba(255,255,255,0.2)"), width: 36, height: 36, fontSize: 15 }} aria-label="Agrandir l'appel">⤢</button>
        <button type="button" onClick={r.quitter} style={{ ...commande("#dc2626"), width: 36, height: 36, fontSize: 15 }} aria-label="Quitter l'appel">✕</button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-label={`Appel de groupe : ${titre}`}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#0b1726", color: "#fff", display: "flex", flexDirection: "column", textAlign: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📞 {titre}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {reunion.phase === "connexion" ? "Connexion à l'appel…"
              : reunion.phase === "fin" ? reunion.message
                : <>Appel de groupe · <Chrono debut={reunion.debut} /> · {nb} participant{nb > 1 ? "s" : ""}</>}
          </div>
        </div>
        {reunion.phase === "en_cours" && (
          <button type="button" onClick={() => r.reduire(true)} title="Réduire (continuer à naviguer)"
            style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
            ⤡ Réduire
          </button>
        )}
      </div>

      {reunion.erreur && (
        <div style={{ background: "#7f1d1d", padding: "8px 16px", fontSize: 12.5, fontWeight: 600 }}>{reunion.erreur}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "grid", gap: 10, alignContent: "start",
        gridTemplateColumns: `repeat(auto-fill, minmax(${etroit ? 140 : 190}px, 1fr))` }}>
        {tuiles.map((p) => {
          const moiMeme = p.compte_id === moi;
          const flux = moiMeme ? reunion.videoLocale : (p.camera ? reunion.videos?.[p.compte_id] : null);
          const nom = moiMeme ? "Vous" : (annuaire.get(p.compte_id)?.nom || "Participant");
          const micro = moiMeme ? reunion.micro : p.micro;
          return (
            <div key={p.compte_id} style={{ position: "relative", aspectRatio: "4 / 3", background: "#15263b", borderRadius: 14, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {flux ? <VideoFlux flux={flux} miroir={moiMeme} /> : <Avatar id={p.compte_id} nom={annuaire.get(p.compte_id)?.nom || nom} taille={64} />}
              <div style={{ position: "absolute", insetInlineStart: 8, bottom: 8, insetInlineEnd: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                <span style={{ background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "2px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom}</span>
                {!micro && <span style={{ background: "#dc2626", borderRadius: 8, padding: "2px 6px" }} title="Micro coupé">🔇</span>}
              </div>
            </div>
          );
        })}
        {reunion.phase === "connexion" && tuiles.length === 0 && (
          <p style={{ gridColumn: "1 / -1", textAlign: "center", opacity: 0.7, marginTop: 40 }}>Connexion au serveur d'appels…</p>
        )}
        {reunion.phase === "en_cours" && nb <= 1 && (
          <p style={{ gridColumn: "1 / -1", textAlign: "center", opacity: 0.7, fontSize: 13 }}>
            Vous êtes seul pour l'instant : les membres du groupe ont été prévenus.
          </p>
        )}
      </div>

      {reunion.phase !== "fin" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 18, padding: "14px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button type="button" onClick={r.basculerMicro} disabled={reunion.phase !== "en_cours"}
            title={reunion.micro ? "Couper le micro" : "Réactiver le micro"}
            style={commande(reunion.micro ? "rgba(255,255,255,0.16)" : "#f59e0b", reunion.phase === "en_cours")}>
            {reunion.micro ? "🎤" : "🔇"}
          </button>
          <button type="button" onClick={r.basculerCamera} disabled={reunion.phase !== "en_cours"}
            title={reunion.camera ? "Couper la caméra" : "Allumer la caméra"}
            style={commande(reunion.camera ? "#2563eb" : "rgba(255,255,255,0.16)", reunion.phase === "en_cours")}>
            {reunion.camera ? "📹" : "📷"}
          </button>
          {reunion.camera && telephone && (
            <button type="button" onClick={r.retournerCamera} title="Caméra avant / arrière" style={commande("rgba(255,255,255,0.16)")}>🔄</button>
          )}
          <button type="button" onClick={r.quitter} title="Quitter l'appel" style={commande("#dc2626")}>
            <span style={{ display: "inline-block", transform: "rotate(135deg)" }}>📞</span>
          </button>
        </div>
      )}
    </div>
  );
}
