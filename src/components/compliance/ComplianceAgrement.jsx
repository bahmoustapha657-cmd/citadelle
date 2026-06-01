import { formatCountdown, formatDateFR } from "../../legal-utils";

// Bloc principal de l'agrément de fonctionnement : numéro, signataire,
// validité et compte à rebours avant expiration.
export function ComplianceAgrement({ profile, palette, expDate, days }) {
  return (
    <div style={{
      background: palette.bg,
      borderLeft: `4px solid ${palette.border}`,
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: palette.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        Agrément de fonctionnement
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: palette.text, fontFamily: "monospace", marginBottom: 6 }}>
        {profile.arreteOuverture.numero}
      </div>
      <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
        <div>Signé le <strong>{formatDateFR(profile.arreteOuverture.dateSignature)}</strong> par {profile.arreteOuverture.ministre} ({profile.arreteOuverture.ministere})</div>
        <div>Validité : <strong>{profile.arreteOuverture.dureeValiditeAnnees} ans</strong> · Expire le <strong>{formatDateFR(expDate)}</strong></div>
      </div>
      <div style={{
        marginTop: 8,
        padding: "8px 12px",
        background: "#fff",
        border: `1px solid ${palette.border}`,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Temps restant</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: palette.text }}>
          {formatCountdown(profile)}
        </span>
        {Number.isFinite(days) && days > 0 && (
          <span style={{ fontSize: 10, color: "#6b7280" }}>({days} jours)</span>
        )}
      </div>
    </div>
  );
}
