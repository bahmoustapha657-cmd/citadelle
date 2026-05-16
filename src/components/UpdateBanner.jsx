import { useEffect, useState } from "react";

// Délai avant tentative d'auto-reload (laisse au user le temps de voir le toast)
const AUTO_RELOAD_DELAY_MS = 1500;

// Heuristique "saisie en cours" : on ne veut pas auto-reload si l'utilisateur
// est en train de remplir un formulaire (modale ouverte ou input focusé).
function userIsTyping() {
  if (typeof document === "undefined") return false;
  if (document.querySelector(".lc-modal-overlay")) return true;
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (a.isContentEditable) return true;
  return false;
}

// Demande au SW waiting de prendre la main. Le reload est déclenché par
// `controllerchange` dans sw-register.js — pas besoin de reload ici.
function activateWaitingWorker(registration) {
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
}

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [autoToast, setAutoToast] = useState(false);

  useEffect(() => {
    const onUpdate = (e) => {
      const reg = e?.detail?.registration || null;
      setRegistration(reg);

      // Décide auto-reload vs bannière en fonction du contexte de saisie
      if (!userIsTyping()) {
        setAutoToast(true);
        setTimeout(() => {
          if (userIsTyping()) {
            // L'utilisateur a commencé à saisir entre-temps → fallback bannière
            setAutoToast(false);
            setAvailable(true);
          } else {
            activateWaitingWorker(reg);
          }
        }, AUTO_RELOAD_DELAY_MS);
      } else {
        setAvailable(true);
      }
    };
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  if (autoToast) {
    return (
      <div
        role="status"
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 9999,
          background: "#0A1628",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          maxWidth: 420,
          margin: "0 auto",
          fontSize: 13,
        }}
      >
        <span style={{ fontSize: 16 }}>🔄</span>
        <span>Mise à jour disponible — rechargement en cours…</span>
      </div>
    );
  }

  if (!available) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        background: "#0A1628",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 14 }}>
        Une nouvelle version d'EduGest est disponible.
      </span>
      <button
        type="button"
        onClick={() => activateWaitingWorker(registration)}
        style={{
          background: "#3b82f6",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          padding: "8px 14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Recharger
      </button>
    </div>
  );
}
