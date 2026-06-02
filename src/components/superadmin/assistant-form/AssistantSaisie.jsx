import { C } from "../../../constants";
import { inputStyle, labelStyle } from "../assistant-styles";

// Champs de saisie (école, contexte, demande), message d'erreur et boutons
// d'action (générer / réinitialiser).
export function AssistantSaisie({
  schoolName, setSchoolName, context, setContext,
  prompt, setPrompt, error, loading, clearForm, generate,
}) {
  return (
    <>
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
          onClick={clearForm}
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
    </>
  );
}
