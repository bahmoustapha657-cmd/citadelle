import { formatDateFR } from "../../legal-utils";
import { ReadRow } from "./ReadRow";

// Sections détaillées en lecture seule : autorisation de création, codes
// statistiques, tutelle administrative, identité de l'établissement et promoteur.
export function ComplianceDetails({ profile }) {
  return (
    <>
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
    </>
  );
}
