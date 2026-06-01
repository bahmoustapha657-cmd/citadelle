import { C } from "../../constants";
import { NIVEAUX } from "./messages-niveaux";

// Carte d'un message dans la boîte de réception : badge niveau, badge
// "NOUVEAU" si non lu, titre, date et corps. Cliquer marque comme lu.
export function MessageItem({ m, lus, marquerLu }) {
  const niv = NIVEAUX[m.niveau] || NIVEAUX.info;
  const dejaLu = !!lus[m._id];
  return (
    <div
      onClick={() => !dejaLu && marquerLu(m)}
      style={{
        border: `1px solid ${niv.border}`,
        borderLeft: `4px solid ${niv.couleur}`,
        borderRadius: 10,
        padding: "12px 14px",
        background: dejaLu ? "#fafafa" : niv.bg,
        cursor: dejaLu ? "default" : "pointer",
        opacity: dejaLu ? 0.75 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            background: niv.couleur,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.05em",
          }}
        >
          {niv.label.toUpperCase()}
        </span>
        {!dejaLu && (
          <span
            style={{
              background: "#ef4444",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 10,
              fontSize: 9,
              fontWeight: 800,
            }}
          >
            NOUVEAU
          </span>
        )}
        <strong style={{ fontSize: 13, color: C.blueDark, flex: 1 }}>{m.titre}</strong>
        <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>
          {new Date(m.createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "#374151",
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}
      >
        {m.corps}
      </p>
    </div>
  );
}
