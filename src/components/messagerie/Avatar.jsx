import { couleurAvatar, initiales } from "./messagerie-logic";

// Pastille aux initiales, couleur stable par compte (ou 👥 pour un groupe).
export function Avatar({ id, nom, taille = 38, groupe = false }) {
  return (
    <div aria-hidden="true" style={{
      width: taille, height: taille, borderRadius: "50%", flexShrink: 0,
      background: groupe ? "linear-gradient(135deg,#64748b,#334155)" : couleurAvatar(id),
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: Math.round(taille * (groupe ? 0.5 : 0.38)), letterSpacing: "0.02em",
    }}>
      {groupe ? "👥" : initiales(nom)}
    </div>
  );
}
