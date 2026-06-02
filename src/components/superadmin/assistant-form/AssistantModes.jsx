import { C } from "../../../constants";

const MODES = [
  { id: "support", label: "Support", desc: "Reponses claires aux demandes des ecoles." },
  { id: "annonce", label: "Annonce", desc: "Messages officiels et communications produit." },
  { id: "incident", label: "Incident", desc: "Resume, causes probables et plan d'action." },
  { id: "commercial", label: "Commercial", desc: "Messages sobres pour prospection ou relance." },
];

// Sélecteur de mode de rédaction (support / annonce / incident / commercial).
export function AssistantModes({ mode, setMode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 18 }}>
      {MODES.map((item) => (
        <button
          key={item.id}
          onClick={() => setMode(item.id)}
          style={{
            border: `2px solid ${mode === item.id ? C.blue : "#e5e7eb"}`,
            borderRadius: 12,
            padding: "12px 14px",
            textAlign: "left",
            background: mode === item.id ? "#f0f6ff" : "#fff",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: mode === item.id ? C.blue : "#1f2937" }}>
            {item.label}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
            {item.desc}
          </div>
        </button>
      ))}
    </div>
  );
}
