import { useState } from "react";
import { getAuthHeaders } from "../apiClient";
import { C } from "../constants";

const MODES = [
  {
    id: "support",
    label: "Support",
    desc: "Reponses claires aux demandes des ecoles.",
  },
  {
    id: "annonce",
    label: "Annonce",
    desc: "Messages officiels et communications produit.",
  },
  {
    id: "incident",
    label: "Incident",
    desc: "Resume, causes probables et plan d'action.",
  },
  {
    id: "commercial",
    label: "Commercial",
    desc: "Messages sobres pour prospection ou relance.",
  },
];

export default function SuperAdminAssistant() {
  const [mode, setMode] = useState("support");
  const [schoolName, setSchoolName] = useState("");
  const [context, setContext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Precise au moins la demande principale.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/ia", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "assistant_superadmin",
          payload: {
            mode,
            schoolName,
            context,
            prompt,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erreur assistant");
      }

      setResult(data.result || "");
    } catch (e) {
      setError(e.message || "Erreur lors de la generation.");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: 14,
    padding: "22px 24px",
    boxShadow: "0 2px 16px rgba(0,32,80,0.07)",
  };

  const inputStyle = {
    width: "100%",
    border: "1.5px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  };

  const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 800,
    color: C.blue,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
            Assistant Superadmin
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            Outil interne de redaction et d'analyse. Rien n'est publie automatiquement :
            tu gardes toujours la validation finale.
          </p>
        </div>

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Ecole concernee</label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Ex. : Groupe Scolaire Excellence"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Contexte</label>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex. : incident de paiement, demande parent, annonce produit"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Demande</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex. : Redige une reponse breve a une directrice qui signale des problemes de connexion depuis ce matin..."
            style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 14, background: "#fee2e2", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              background: `linear-gradient(90deg,${C.blue},${C.green})`,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 20px",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Generation en cours..." : "Generer un brouillon"}
          </button>
          <button
            onClick={() => {
              setPrompt("");
              setContext("");
              setSchoolName("");
              setError("");
              setResult("");
            }}
            style={{
              background: "#f3f4f6",
              color: "#4b5563",
              border: "none",
              borderRadius: 10,
              padding: "11px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reinitialiser
          </button>
        </div>
      </div>

      {result && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900, color: C.blueDark }}>
                Brouillon genere
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Relis et ajuste avant envoi ou publication.
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
      )}
    </div>
  );
}
