import { NIVEAUX } from "./messages-niveaux";

// Bandeaux d'alerte (messages important/critique non lus) affichés en haut.
export function MessagesBandeaux({ bandeauxAffiches, setBoiteOuverte, setBandeauFerme }) {
  return bandeauxAffiches.map((m) => {
    const niv = NIVEAUX[m.niveau] || NIVEAUX.info;
    return (
      <div
        key={m._id}
        style={{
          background: niv.bg,
          borderBottom: `2px solid ${niv.border}`,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: niv.couleur,
          fontSize: 13,
        }}
      >
        <span style={{ fontSize: 18 }}>{m.niveau === "critique" ? "🚨" : "⚠️"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontWeight: 800, marginRight: 8 }}>{m.titre}</strong>
          <span style={{ color: niv.couleur, opacity: 0.85 }}>
            {m.corps.length > 140 ? `${m.corps.slice(0, 140)}…` : m.corps}
          </span>
        </div>
        <button
          onClick={() => setBoiteOuverte(true)}
          style={{
            background: niv.couleur,
            color: "#fff",
            border: "none",
            borderRadius: 7,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Lire
        </button>
        <button
          onClick={() => setBandeauFerme((p) => ({ ...p, [m._id]: true }))}
          title="Masquer"
          style={{
            background: "none",
            border: "none",
            color: niv.couleur,
            fontSize: 18,
            cursor: "pointer",
            padding: "0 4px",
            opacity: 0.6,
          }}
        >
          ✕
        </button>
      </div>
    );
  });
}
