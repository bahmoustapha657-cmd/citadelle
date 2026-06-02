import { C } from "../../../constants";
import { formatHistoryDate } from "./format-history-date";

// Une ligne de l'historique des brouillons de l'assistant.
export function AssistantHistoryEntry({ entry, loadHistoryEntry }) {
  return (
    <div
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
  );
}
