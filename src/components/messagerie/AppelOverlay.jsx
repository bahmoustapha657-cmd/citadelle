import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { formatChrono } from "./messagerie-logic";

const LIBELLES_PHASE = {
  preparation: "Préparation de l'appel…",
  appel: "Ça sonne…",
  sonnerie: "vous appelle",
  connexion: "Connexion…",
};

function Chrono({ debut }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{formatChrono((maintenant - debut) / 1000)}</span>;
}

const bouton = (fond) => ({
  width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
  background: fond, color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
});

// Écran d'appel flottant, visible sur toutes les pages : sonnerie entrante,
// appel sortant, conversation en cours (chrono, micro coupé), fin.
export function AppelOverlay({ appels, annuaire }) {
  const { appel, repondre, raccrocher, basculerMuet } = appels;
  if (!appel) return null;
  const correspondant = annuaire.get(appel.correspondantId);
  const nom = correspondant?.nom || "Correspondant";
  const entrantQuiSonne = appel.sens === "entrant" && appel.phase === "sonnerie";

  return (
    <div role="dialog" aria-label={`Appel avec ${nom}`}
      style={{
        position: "fixed", zIndex: 1200, insetInlineEnd: 16, bottom: 16, textAlign: "start",
        width: "min(340px, calc(100vw - 32px))",
        background: "linear-gradient(160deg,#0f2a4a,#123a5e)", color: "#fff",
        borderRadius: 20, padding: "20px 18px 18px", boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
        animation: entrantQuiSonne ? "lc-appel-pulse 1.6s ease-in-out infinite" : undefined,
      }}>
      <style>{"@keyframes lc-appel-pulse{0%,100%{box-shadow:0 18px 50px rgba(0,0,0,.4),0 0 0 0 rgba(34,197,94,.5)}50%{box-shadow:0 18px 50px rgba(0,0,0,.4),0 0 0 14px rgba(34,197,94,0)}}"}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar id={appel.correspondantId} nom={nom} taille={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {appel.phase === "en_cours" && appel.debut ? <>📞 En ligne · <Chrono debut={appel.debut} /></>
              : appel.phase === "fin" ? appel.message
                : `📞 ${LIBELLES_PHASE[appel.phase] || ""}`}
          </div>
          {correspondant?.poste && appel.phase !== "fin" && (
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{correspondant.poste}</div>
          )}
        </div>
      </div>

      {appel.phase !== "fin" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 18 }}>
          {entrantQuiSonne ? (
            <>
              <button type="button" onClick={raccrocher} title="Refuser" style={bouton("#dc2626")}>✕</button>
              <button type="button" onClick={repondre} title="Répondre" style={bouton("#16a34a")}>📞</button>
            </>
          ) : (
            <>
              {(appel.phase === "en_cours" || appel.phase === "connexion") && (
                <button type="button" onClick={basculerMuet} title={appel.muet ? "Réactiver le micro" : "Couper le micro"}
                  style={bouton(appel.muet ? "#f59e0b" : "rgba(255,255,255,0.18)")}>
                  {appel.muet ? "🔇" : "🎤"}
                </button>
              )}
              <button type="button" onClick={raccrocher} title="Raccrocher" style={bouton("#dc2626")}>
                <span style={{ display: "inline-block", transform: "rotate(135deg)" }}>📞</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
