import { C } from "../../constants";
import { MAX_SUPERADMIN_HISTORY } from "../superadminAssistantConfig";
import { cardStyle } from "./assistant-styles";
import { AssistantHistoryEntry } from "./assistant-history/AssistantHistoryEntry";

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
            <AssistantHistoryEntry key={entry.id} entry={entry} loadHistoryEntry={loadHistoryEntry} />
          ))}
        </div>
      )}
    </div>
  );
}
