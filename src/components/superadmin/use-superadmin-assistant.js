import { useEffect, useMemo, useState } from "react";
import { assistantSuperadmin } from "../../backend/ia";
import {
  buildAssistantHistoryEntry,
  MAX_SUPERADMIN_HISTORY,
  sanitizeAssistantHistoryEntries,
  SUPERADMIN_ASSISTANT_HISTORY_KEY,
  SUPERADMIN_ASSISTANT_PRESETS,
} from "../superadminAssistantConfig";

// Toute la logique de l'assistant superadmin : état du formulaire,
// persistance locale de l'historique et appel à l'API /ia.
export function useSuperadminAssistant() {
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
      const data = await assistantSuperadmin({ mode, schoolName, context, prompt });
      if (!data.ok) {
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

  return {
    mode, setMode, schoolName, setSchoolName, context, setContext,
    prompt, setPrompt, result, error, loading, history,
    modeLabel, applyPreset, loadHistoryEntry, clearForm, clearHistory, generate,
  };
}
