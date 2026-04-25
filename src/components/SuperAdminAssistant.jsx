import { useEffect, useMemo, useState } from "react";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C } from "../constants";
import {
  buildAssistantHistoryEntry,
  MAX_SUPERADMIN_HISTORY,
  sanitizeAssistantHistoryEntries,
  SUPERADMIN_ASSISTANT_HISTORY_KEY,
  SUPERADMIN_ASSISTANT_PRESETS,
} from "./superadminAssistantConfig";

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

export default function SuperAdminAssistant() {
  const [mode, setMode] = useState("support");
  const [schoolName, setSchoolName] = useState("");
  const [context, setContext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(SUPERADMIN_ASSISTANT_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setHistory(sanitizeAssistantHistoryEntries(parsed));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SUPERADMIN_ASSISTANT_HISTORY_KEY,
        JSON.stringify(history.slice(0, MAX_SUPERADMIN_HISTORY)),
      );
    } catch {
      // best effort only
    }
  }, [history]);

  const modeLabel = useMemo(
    () => SUPERADMIN_ASSISTANT_PRESETS.find((item) => item.mode === mode)?.mode || mode,
    [mode],
  );

  const applyPreset = (preset) => {
    setMode(preset.mode);
    setSchoolName(preset.schoolName || "");
    setContext(preset.context || "");
    setPrompt(preset.prompt || "");
    setError("");
  };

  const loadHistoryEntry = (entry) => {
    setMode(entry.mode || "support");
    setSchoolName(entry.schoolName || "");
    setContext(entry.context || "");
    setPrompt(entry.prompt || "");
    setResult(entry.result || "");
    setError("");
  };

  const clearForm = () => {
    setPrompt("");
    setContext("");
    setSchoolName("");
    setError("");
    setResult("");
  };

  const clearHistory = () => {
    setHistory([]);
  };

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
      const response = await apiFetch("/ia", {
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

      const generatedResult = data.result || "";
      setResult(generatedResult);
      setHistory((current) => sanitizeAssistantHistoryEntries([
        buildAssistantHistoryEntry({
          mode,
          schoolName,
          context,
          prompt,
          result: generatedResult,
        }),
        ...current,
      ]));
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
          {[
            { id: "support", label: "Support", desc: "Reponses claires aux demandes des ecoles." },
            { id: "annonce", label: "Annonce", desc: "Messages officiels et communications produit." },
            { id: "incident", label: "Incident", desc: "Resume, causes probables et plan d'action." },
            { id: "commercial", label: "Commercial", desc: "Messages sobres pour prospection ou relance." },
          ].map((item) => (
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

        <div style={{ marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Prompts prets a l'emploi</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            {SUPERADMIN_ASSISTANT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  border: "1px solid #dbe4ef",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "left",
                  background: "#f8fbff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: C.blueDark }}>
                  {preset.title}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                  {preset.context}
                </div>
              </button>
            ))}
          </div>
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
      </div>

      {result && (
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
      )}

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
    </div>
  );
}
