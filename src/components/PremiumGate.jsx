import { useState } from "react";
import { usePlan } from "../contexts/PlanContext";
import UpgradeModal from "./UpgradeModal";

/**
 * PremiumGate — bloque l'accès aux fonctionnalités Pro
 *
 * Usage bloc (overlay flou) :
 *   <PremiumGate feature="export_excel">
 *     <MonComposant />
 *   </PremiumGate>
 *
 * Usage inline (cadenas sur un bouton) :
 *   <PremiumGate feature="ia_commentaires" inline>
 *     <button>✨ IA</button>
 *   </PremiumGate>
 */
export default function PremiumGate({ feature, children, inline = false }) {
  const { canAccess, isPro } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Plan Pro ou fonctionnalité gratuite → accès direct
  if (canAccess(feature)) return children;

  if (inline) {
    return (
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <span style={{ opacity: 0.45, pointerEvents: "none", userSelect: "none" }}>
          {children}
        </span>
        <button
          onClick={() => setShowUpgrade(true)}
          title="Fonctionnalité Pro — Cliquez pour upgrader"
          style={{
            position: "absolute", inset: 0, background: "transparent",
            border: "none", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "flex-end", paddingRight: 4,
          }}
        >
          <span style={{
            background: "#0A1628", color: "#fff", fontSize: 9, fontWeight: 800,
            padding: "2px 6px", borderRadius: 10, letterSpacing: "0.03em",
          }}>
            🔒 PRO
          </span>
        </button>
        {showUpgrade && <UpgradeModal onFermer={() => setShowUpgrade(false)} />}
      </span>
    );
  }

  // Mode bloc — overlay flou
  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,20,60,0.72)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, borderRadius: 12,
      }}>
        <span style={{ fontSize: 36 }}>🔒</span>
        <p style={{ color: "#fff", fontWeight: 800, margin: 0, fontSize: 15 }}>
          Fonctionnalité Pro
        </p>
        <p style={{ color: "rgba(255,255,255,0.65)", margin: 0, fontSize: 12, textAlign: "center", maxWidth: 260 }}>
          Passez en Plan Pro pour débloquer cette fonctionnalité
        </p>
        <button
          onClick={() => setShowUpgrade(true)}
          style={{
            background: "linear-gradient(90deg,#0A1628,#00C48C)",
            color: "#fff", border: "none", padding: "10px 26px",
            borderRadius: 9, fontWeight: 800, cursor: "pointer", fontSize: 14,
          }}
        >
          ⭐ Passer en Pro — 500 000 GNF/an
        </button>
      </div>
      {showUpgrade && <UpgradeModal onFermer={() => setShowUpgrade(false)} />}
    </div>
  );
}
