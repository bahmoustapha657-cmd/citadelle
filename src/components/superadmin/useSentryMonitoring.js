import { useState } from "react";
import { apiFetch, getAuthHeaders } from "../../apiClient";

// Surveillance Sentry du panel super-admin : chargement de la configuration,
// des issues, et déclenchement d'un event de test. `setMsgSucces` sert au
// feedback transverse de l'orchestrateur.
export function useSentryMonitoring(setMsgSucces) {
  const [sentryIssues, setSentryIssues] = useState([]);
  const [sentryConfig, setSentryConfig] = useState(null);
  const [sentryLoading, setSentryLoading] = useState(false);
  const [sentryTesting, setSentryTesting] = useState(false);
  const [sentryError, setSentryError] = useState("");

  const chargerSentry = async () => {
    setSentryLoading(true);
    setSentryError("");
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const rCfg = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "config" }) });
      const cfg = await rCfg.json().catch(() => ({}));
      setSentryConfig(cfg);
      if (!cfg.configured) {
        setSentryIssues([]);
        setSentryError(cfg.error || "Sentry non configure.");
        return;
      }
      const r = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "issues" }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSentryError(data.error || "Erreur de chargement des issues Sentry.");
        setSentryIssues([]);
      } else {
        setSentryIssues(Array.isArray(data.issues) ? data.issues : []);
      }
    } catch (e) {
      setSentryError(e?.message || "Erreur reseau.");
    } finally {
      setSentryLoading(false);
    }
  };

  const testerSentry = async () => {
    if (!confirm("Declencher une erreur de test capturee par Sentry ?\n\nUn event apparaitra dans le dashboard Sentry dans la minute.")) return;
    setSentryTesting(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const r = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "test" }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsgSucces(data.message || "Event envoye a Sentry.");
        setTimeout(() => setMsgSucces(""), 6000);
      } else {
        setSentryError(data.error || "Echec du test.");
      }
    } catch (e) {
      setSentryError(e?.message || "Erreur reseau.");
    } finally {
      setSentryTesting(false);
    }
  };

  return {
    sentryIssues, sentryConfig, sentryLoading, sentryTesting, sentryError,
    chargerSentry, testerSentry,
  };
}
