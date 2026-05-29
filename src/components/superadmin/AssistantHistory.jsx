import { C } from "../../constants";
import { MAX_SUPERADMIN_HISTORY } from "../superadminAssistantConfig";
import { cardStyle } from "./assistant-styles";

function formatHistoryDate(timestamp) {
  if (!timestamp) {
    return "Date inconnue";
  }

  try {
    return new Date(timestamp).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "Date inconnue";
  }
}

export function AssistantHistory({ history, loadHistoryEntry, clearHistory }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900, color: C.blueDark }}>
            Historique des brouillons
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Les {MAX_SUPERADMIN_HISTORY} derniers brouillons sont gardes localement dans ce navigateur.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              border: "none",
              borderRadius: 9,
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Vider l'historique
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: "18px 20px", color: "#6b7280", fontSize: 13 }}>
          Aucun brouillon pour le moment. Genere un premier texte et il apparaitra ici.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
                background: "#fbfdff",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.blueDark }}>
                      {entry.mode}
                    </span>
                    {entry.schoolName && (
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        - {entry.schoolName}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {formatHistoryDate(entry.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", fontWeight: 700, marginBottom: 4 }}>
                    {entry.prompt.slice(0, 160)}{entry.prompt.length > 160 ? "..." : ""}
                  </div>
                  {entry.context && (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      {entry.context}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => loadHistoryEntry(entry)}
                    style={{
                      background: "#e0f2fe",
                      color: "#0369a1",
                      border: "none",
                      borderRadius: 9,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Recharger
                  </button>
                  <button
                    onClick={() => navigator.clipboard?.writeText(entry.result)}
                    style={{
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "none",
                      borderRadius: 9,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Copier
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
