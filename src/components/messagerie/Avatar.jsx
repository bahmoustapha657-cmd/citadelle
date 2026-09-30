import { COULEURS_PRESENCE, couleurAvatar, initiales, libellePresence } from "./messagerie-logic";

// Pastille aux initiales, couleur stable par compte (ou 👥 pour un groupe).
// `presence` : point vert (en ligne) ou orange (absent) en bas à droite.
export function Avatar({ id, nom, taille = 38, groupe = false, presence = null }) {
  const couleur = COULEURS_PRESENCE[presence?.etat];
  return (
    <div aria-hidden="true" style={{ position: "relative",
      width: taille, height: taille, borderRadius: "50%", flexShrink: 0,
      background: groupe ? "linear-gradient(135deg,#64748b,#334155)" : couleurAvatar(id),
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: Math.round(taille * (groupe ? 0.5 : 0.38)), letterSpacing: "0.02em",
    }}>
      {groupe ? "👥" : initiales(nom)}
      {couleur && (
        <span title={libellePresence(presence)} style={{
          position: "absolute", insetInlineEnd: -1, bottom: -1,
          width: Math.max(10, Math.round(taille * 0.3)), height: Math.max(10, Math.round(taille * 0.3)),
          borderRadius: "50%", background: couleur, border: "2px solid var(--lc-surface)", boxSizing: "border-box",
        }} />
      )}
    </div>
  );
}
