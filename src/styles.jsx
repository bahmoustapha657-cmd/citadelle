import React from "react";
import { C } from "./constants";

// ── Styles globaux injectés une seule fois ──
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; padding: 0; }
  body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: ${C.bg}; -webkit-text-size-adjust: 100%; }

  /* ── Couleurs école (surchargées dynamiquement via JS) ── */
  :root {
    --sc1: ${C.blue};
    --sc2: ${C.green};
    --sc1-dk: color-mix(in srgb, var(--sc1) 80%, #000);
    --sc1-lt: color-mix(in srgb, var(--sc1) 12%, #fff);
    --sc2-dk: color-mix(in srgb, var(--sc2) 80%, #000);
    --sc2-lt: color-mix(in srgb, var(--sc2) 12%, #fff);
  }

  /* Hauteur viewport dynamique (iOS Safari compatible) */
  .lc-app-root { height: 100dvh; height: 100vh; } /* dvh = dynamic viewport height */
  @supports (height: 100dvh) { .lc-app-root { height: 100dvh; } }

  /* Scrollbar fine */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #b0c4d8; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #0A1628; }

  /* Transitions boutons */
  button { transition: filter .15s ease, transform .12s ease, box-shadow .15s ease; touch-action: manipulation; }
  button:hover:not(:disabled) { filter: brightness(1.09); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  button:active:not(:disabled) { transform: translateY(0px); box-shadow: none; }

  /* Hover lignes tableau */
  tbody tr { transition: background .1s; }
  tbody tr:hover td { background: #f0f7ff !important; }

  /* Focus inputs */
  input:focus, select:focus, textarea:focus {
    border-color: var(--sc2) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc2) 18%, transparent) !important;
    outline: none;
  }

  /* Spinner animation */
  @keyframes spin { to { transform: rotate(360deg); } }
  .lc-spinner {
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid #d0dce8;
    border-top-color: var(--sc2);
    animation: spin .7s linear infinite;
    margin: 0 auto 12px;
  }

  /* Skeleton shimmer */
  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .lc-skeleton {
    background: linear-gradient(90deg, #e8f0f7 25%, #f4f8fb 50%, #e8f0f7 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
  }

  /* Fade-in modales */
  @keyframes fadeUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
  .lc-modal-box { animation: fadeUp .2s ease; }

  /* ── RESPONSIVE MOBILE ── */
  @media (max-width: 767px) {
    /* Empêche le zoom iOS sur les inputs (iOS zoome si font-size < 16px) */
    input, select, textarea { font-size: 16px !important; }

    /* Modales adaptées mobile : plein écran en bas */
    .lc-modal-overlay { align-items: flex-end !important; padding: 0 !important; }
    .lc-modal-box {
      border-radius: 20px 20px 0 0 !important;
      max-height: 92dvh !important;
      max-height: 92vh !important;
      overflow-y: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
    }
    @supports (max-height: 92dvh) { .lc-modal-box { max-height: 92dvh !important; } }

    /* Tables : scroll horizontal */
    .lc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { font-size: 12px !important; }
    td, th { padding: 8px 10px !important; }

    /* Boutons plus grands pour le touch */
    button { min-height: 36px; }

    /* Header compact */
    .lc-header-actions span { display: none; }
  }

  /* ══════════════════════════════════════════════════════════
     MODE SOMBRE
     Activé par <body class="mode-sombre">

     Technique : filtre invert+hue-rotate appliqué sur <html>
     (pas sur un conteneur enfant) pour que les modales
     position:fixed soient également traitées.

     La sidebar <aside> est déjà sombre → on la ré-inverse pour
     qu'elle reste telle quelle.
     Les images/canvas sont aussi ré-inversés.
  ══════════════════════════════════════════════════════════ */

  body.mode-sombre {
    background: #0f1117;
  }

  /* Filtre global sur <html> */
  html:has(body.mode-sombre) {
    filter: invert(1) hue-rotate(180deg);
  }

  /* Sidebar déjà sombre → double inversion = couleurs d'origine */
  html:has(body.mode-sombre) aside {
    filter: invert(1) hue-rotate(180deg);
  }

  /* Médias : ré-inversion pour garder les couleurs naturelles */
  html:has(body.mode-sombre) img,
  html:has(body.mode-sombre) video,
  html:has(body.mode-sombre) canvas {
    filter: invert(1) hue-rotate(180deg);
  }

  /* Scrollbar (dark) */
  body.mode-sombre ::-webkit-scrollbar-track  { background: #151a27; }
  body.mode-sombre ::-webkit-scrollbar-thumb  { background: #3d4f6b; }
  body.mode-sombre ::-webkit-scrollbar-thumb:hover { background: #5a6e8a; }
`;
const GlobalStyles = () => <style>{GLOBAL_CSS}</style>;

export { GlobalStyles };
