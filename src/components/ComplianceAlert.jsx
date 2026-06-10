import React, { useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import {
  computeDateExpiration,
  daysUntilExpiration,
  formatCountdown,
  formatDateFR,
  getComplianceStatus,
  isLegalProfileEmpty,
  legalProfileVide,
} from "../legal-utils";

// Mini-alerte de conformité affichée sur le TableauDeBord.
// Version compacte (1 ligne) du widget complet, qui vit désormais
// dans Paramètres → onglet "Officiel". On garde sur le dashboard
// uniquement le signal d'alerte (statut + compte à rebours) pour ne
// pas surcharger l'écran d'accueil.
//
// Props :
//  - onOpenSettings?: () => void — handler optionnel pour rediriger
//    vers Paramètres → Officiel quand l'utilisateur clique sur l'alerte.
//    Si absent, l'alerte reste affichée sans action.
export default function ComplianceAlert({ onOpenSettings }) {
  const { schoolInfo } = useContext(SchoolContext);
  const profile = schoolInfo?.legal || legalProfileVide;

  // Profil jamais renseigné → invitation neutre à compléter le dossier
  // officiel, plutôt qu'une fausse alerte « Urgent » (ou pire, l'agrément
  // d'une autre école comme avant le fallback vide).
  const manquant = isLegalProfileEmpty(profile);
  const status = getComplianceStatus(profile);
  const days = daysUntilExpiration(profile);
  const expDate = computeDateExpiration(profile);

  const PALETTE = {
    ok: { bg: "#ecfdf5", border: "#10b981", text: "#065f46", icon: "✓", label: "Conforme" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", icon: "⚠", label: "À renouveler" },
    critical: { bg: "#fef2f2", border: "#f97316", text: "#9a3412", icon: "⚠", label: "Urgent" },
    expired: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b", icon: "✕", label: "Expiré" },
    manquant: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", icon: "ℹ", label: "À renseigner" },
  };
  const palette = manquant ? PALETTE.manquant : PALETTE[status];
  const clickable = typeof onOpenSettings === "function";

  return (
    <button
      type="button"
      onClick={clickable ? onOpenSettings : undefined}
      disabled={!clickable}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 14px",
        marginBottom: 16,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${palette.border}`,
        borderRadius: 10,
        cursor: clickable ? "pointer" : "default",
        transition: "transform .12s, box-shadow .12s",
      }}
      onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <span style={{ fontSize: 18, color: palette.text, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>
        {palette.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: palette.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Agrément · {palette.label}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>
            {manquant
              ? "Renseignez votre agrément et vos codes statistiques"
              : status === "expired" ? formatCountdown(profile) : `Expire dans ${formatCountdown(profile)}`}
          </span>
          {!manquant && Number.isFinite(days) && days > 0 && (
            <span style={{ fontSize: 10, color: "#64748b" }}>
              (échéance {formatDateFR(expDate)})
            </span>
          )}
        </div>
      </div>
      {clickable && (
        <span style={{ fontSize: 11, color: palette.text, fontWeight: 700, opacity: 0.75, whiteSpace: "nowrap" }}>
          Paramètres ›
        </span>
      )}
    </button>
  );
}
