import { Btn } from "../ui";
import { ComplianceAgrement } from "./ComplianceAgrement";
import { ComplianceDetails } from "./ComplianceDetails";

// Code couleur par statut de conformité.
const PALETTE = {
  ok: { bg: "#ecfdf5", border: "#10b981", text: "#065f46", label: "Conforme" },
  warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", label: "À renouveler" },
  critical: { bg: "#fef2f2", border: "#f97316", text: "#9a3412", label: "Urgent" },
  expired: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b", label: "Expiré" },
};

// Corps en lecture seule du widget Conformité : agrément, autorisation, codes
// statistiques, tutelle, identité et promoteur, avec le bouton de modification.
export function ComplianceCard({ profile, status, days, expDate, canEdit, onEdit }) {
  const palette = PALETTE[status];
  return (
    <div style={{ padding: "16px 18px" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: "#0A1628" }}>
          Conformité légale
        </p>
        <span style={{
          background: palette.bg,
          color: palette.text,
          border: `1px solid ${palette.border}`,
          padding: "3px 10px",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}>
          {palette.label}
        </span>
      </div>

      <ComplianceAgrement profile={profile} palette={palette} expDate={expDate} days={days} />
      <ComplianceDetails profile={profile} />

      {canEdit && (
        <Btn v="ghost" sm onClick={onEdit} style={{ width: "100%" }}>
          ✏️ Modifier les informations légales
        </Btn>
      )}
    </div>
  );
}
