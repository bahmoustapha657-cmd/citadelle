import { C } from "../../constants";
import { NIVEAUX } from "./communications-constants";

export function MessagesHistorique({ messages, statsLectures, supprimerMessage }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,32,80,0.08)", padding: "22px 24px" }}>
      <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: C.blueDark }}>
        📜 Historique ({messages.length})
      </h3>
      {messages.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Aucun message envoyé pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m) => {
            const niv = NIVEAUX.find((n) => n.id === m.niveau) || NIVEAUX[0];
            const stat = statsLectures[m._id] || { lectures: 0, ecoles: 0 };
            const cible =
              m.cibleSchools?.[0] === "*"
                ? "Toutes les écoles"
                : `${m.cibleSchools?.length || 0} école(s)`;
            return (
              <div
                key={m._id}
                style={{
                  border: `1px solid ${niv.bg}`,
                  borderLeft: `4px solid ${niv.couleur}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ background: niv.bg, color: niv.couleur, padding: "2px 9px", borderRadius: 12, fontSize: 10, fontWeight: 800 }}>
                    {niv.label.toUpperCase()}
                  </span>
                  <strong style={{ fontSize: 14, color: C.blueDark, flex: 1 }}>{m.titre}</strong>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <button
                    onClick={() => supprimerMessage(m._id)}
                    title="Supprimer"
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
                  >
                    🗑
                  </button>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{m.corps}</p>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
                  <span>🎯 {cible}</span>
                  <span>👥 {(m.cibleRoles || []).join(", ")}</span>
                  <span>👁 {stat.ecoles} école(s) ont lu · {stat.lectures} lecture(s)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
