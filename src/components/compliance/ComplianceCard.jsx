import { Btn } from "../ui";
import { formatCountdown, formatDateFR } from "../../legal-utils";
import { ReadRow } from "./ReadRow";

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

      {/* Bloc agrément principal */}
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

      {/* Autorisation de création */}
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          Autorisation de création
        </div>
        <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#0A1628" }}>
          {profile.autorisationCreation.numero}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {formatDateFR(profile.autorisationCreation.dateSignature)} — {profile.autorisationCreation.ministre} ({profile.autorisationCreation.ministere})
        </div>
      </div>

      {/* Codes statistiques */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Codes statistiques officiels
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            ["Maternelle", profile.codesStatistiques.maternelle],
            ["Primaire", profile.codesStatistiques.primaire],
            ["Secondaire", profile.codesStatistiques.secondaire],
          ].map(([label, code]) => (
            <div key={label} style={{ background: "#f1f5f9", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 800, color: "#0A1628" }}>{code || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tutelle administrative (ex-champs legacy ministere/ire/dpe) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Tutelle administrative
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
          <ReadRow label="Ministère de tutelle" value={profile.etablissement.ministereTutelle} />
          <ReadRow label="Inspection Régionale (IRE)" value={profile.etablissement.ire} />
          <ReadRow label="Direction Préfectorale (DPE)" value={profile.etablissement.dpe} />
        </div>
      </div>

      {/* Identité de l'établissement */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Identité de l'établissement
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
          <ReadRow label="Dénomination" value={profile.etablissement.denomination} />
          <ReadRow label="Quartier" value={profile.etablissement.quartier} />
          <ReadRow label="Commune" value={profile.etablissement.commune} />
          <ReadRow label="Région" value={profile.etablissement.region} />
          <ReadRow label="Email" value={profile.etablissement.email} />
        </div>
      </div>

      {/* Promoteur */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Promoteur
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
          <ReadRow label="Nom" value={profile.promoteur.nom} />
          <ReadRow label="Naissance" value={[profile.promoteur.anneeNaissance, profile.promoteur.lieuNaissance].filter(Boolean).join(" — ")} />
        </div>
      </div>

      {canEdit && (
        <Btn v="ghost" sm onClick={onEdit} style={{ width: "100%" }}>
          ✏️ Modifier les informations légales
        </Btn>
      )}
    </div>
  );
}
