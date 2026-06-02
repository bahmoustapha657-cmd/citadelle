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
export function activateWaitingWorker(registration) {
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
}

// État + écoute de l'événement de mise à jour du service worker.
export function useUpdateBanner() {
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

  return { available, registration, autoToast };
}
