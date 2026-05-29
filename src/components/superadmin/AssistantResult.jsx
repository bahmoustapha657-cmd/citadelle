import { C } from "../../constants";
import { cardStyle } from "./assistant-styles";

export function AssistantResult({ result, modeLabel }) {
  if (!result) {
    return null;
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900, color: C.blueDark }}>
            Brouillon genere
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Mode actuel : <strong>{modeLabel}</strong>. Relis et ajuste avant envoi ou publication.
          </p>
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(result)}
          style={{
            background: C.blue,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "9px 14px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Copier
        </button>
      </div>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "18px 20px",
          background: "#fafafa",
          whiteSpace: "pre-wrap",
          fontSize: 14,
          lineHeight: 1.75,
          color: "#1f2937",
        }}
      >
        {result}
      </div>
    </div>
  );
}
