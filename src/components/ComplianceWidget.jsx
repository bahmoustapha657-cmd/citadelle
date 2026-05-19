import React, { useContext, useState } from "react";
import { Btn, Card, Modale } from "./ui";
import { SchoolContext } from "../contexts/SchoolContext";
import {
  computeDateExpiration,
  daysUntilExpiration,
  formatCountdown,
  formatDateFR,
  getComplianceStatus,
  legalProfileMock,
  updateLegalProfile,
} from "../legal-utils";

// Widget Conformité affiché sur le tableau de bord directeur.
// La source de vérité est `schoolInfo.legal` (alimenté par le listener
// posé dans App.jsx sur /ecoles/{schoolId}/config/legal). Tant que le
// doc Firestore n'existe pas, on retombe sur `legalProfileMock` pour
// ne pas bloquer le rendu.
//
// Props :
//  - profile?: LegalProfile — override explicite (utile en preview / tests)
//  - canEdit?: boolean — masque le bouton "Modifier" si false
export default function ComplianceWidget({ profile: profileOverride, canEdit = true }) {
  const { schoolId, schoolInfo } = useContext(SchoolContext);
  const source = profileOverride || schoolInfo?.legal || legalProfileMock;
  const [profile, setProfile] = useState(source);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Si la source Firestore change pendant que la modale est fermée,
  // on resynchronise l'état local avec le snapshot.
  React.useEffect(() => {
    if (!modalOpen) setProfile(source);
  }, [source, modalOpen]);

  const status = getComplianceStatus(profile);
  const days = daysUntilExpiration(profile);
  const expDate = computeDateExpiration(profile);

  // Code couleur par statut
  const PALETTE = {
    ok: { bg: "#ecfdf5", border: "#10b981", text: "#065f46", label: "Conforme" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", label: "À renouveler" },
    critical: { bg: "#fef2f2", border: "#f97316", text: "#9a3412", label: "Urgent" },
    expired: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b", label: "Expiré" },
  };
  const palette = PALETTE[status];

  return (
    <Card style={{ marginBottom: 16 }}>
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
          <Btn v="ghost" sm onClick={() => setModalOpen(true)} style={{ width: "100%" }}>
            ✏️ Modifier les informations légales
          </Btn>
        )}
      </div>

      {modalOpen && (
        <LegalEditModal
          profile={profile}
          schoolInfo={schoolInfo}
          saving={saving}
          error={error}
          onClose={() => { if (!saving) { setError(""); setModalOpen(false); } }}
          onSave={async (next) => {
            if (!schoolId) {
              setError("schoolId manquant — impossible de sauvegarder.");
              return;
            }
            setSaving(true);
            setError("");
            try {
              await updateLegalProfile(schoolId, next);
              setProfile(next);
              setModalOpen(false);
            } catch (e) {
              setError(e?.message || "Échec de la sauvegarde.");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </Card>
  );
}

// Renvoie un draft initial = profile, complété par les champs legacy
// (schoolInfo.ministere/agrement/ire/dpe) là où le profil structuré est
// vide. N'écrase JAMAIS une valeur déjà saisie dans /config/legal.
function mergeLegacyFallback(profile, schoolInfo) {
  if (!schoolInfo) return profile;
  const next = structuredClone(profile);
  if (!next.arreteOuverture?.numero && schoolInfo.agrement) {
    next.arreteOuverture = { ...next.arreteOuverture, numero: schoolInfo.agrement };
  }
  if (!next.etablissement?.ministereTutelle && schoolInfo.ministere) {
    next.etablissement = { ...next.etablissement, ministereTutelle: schoolInfo.ministere };
  }
  if (!next.etablissement?.ire && schoolInfo.ire) {
    next.etablissement = { ...next.etablissement, ire: schoolInfo.ire };
  }
  if (!next.etablissement?.dpe && schoolInfo.dpe) {
    next.etablissement = { ...next.etablissement, dpe: schoolInfo.dpe };
  }
  return next;
}

// ── Styles partagés et sous-composants déclarés au module ──
const L_STYLE = { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" };
const I_STYLE = { width: "100%", border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", outline: "none" };

// Ligne label/valeur en lecture seule pour l'affichage du widget.
function ReadRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "3px 0", fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#0A1628", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>
        {value || <span style={{ color: "#cbd5e1", fontWeight: 400 }}>—</span>}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#0A1628", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingBottom: 4, borderBottom: "1.5px solid #e2e8f0" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
    </div>
  );
}

// ── Modale d'édition (réservée directeur/admin) ──────────────────
// Pré-remplissage automatique depuis les champs legacy de `schoolInfo`
// (ministere, agrement, ire, dpe) tant que les champs structurés du
// profil légal sont vides. Permet la migration en douceur : la 1ère
// sauvegarde matérialise les valeurs dans /config/legal.
function LegalEditModal({ profile, schoolInfo, onClose, onSave, saving = false, error = "" }) {
  const [draft, setDraft] = useState(() => mergeLegacyFallback(profile, schoolInfo));
  const set = (path) => (e) => {
    const v = e.target.value;
    setDraft((p) => {
      const next = structuredClone(p);
      const segs = path.split(".");
      let cur = next;
      for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
      cur[segs[segs.length - 1]] = v;
      return next;
    });
  };
  const setNum = (path) => (e) => {
    const v = Number(e.target.value);
    setDraft((p) => {
      const next = structuredClone(p);
      const segs = path.split(".");
      let cur = next;
      for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
      cur[segs[segs.length - 1]] = Number.isFinite(v) ? v : 0;
      return next;
    });
  };

  return (
    <Modale titre="Informations légales de l'établissement" fermer={onClose} large>
      <Section title="Promoteur">
        <div><label style={L_STYLE}>Nom</label><input style={I_STYLE} value={draft.promoteur.nom} onChange={set("promoteur.nom")} /></div>
        <div><label style={L_STYLE}>Année de naissance</label><input style={I_STYLE} type="number" value={draft.promoteur.anneeNaissance} onChange={setNum("promoteur.anneeNaissance")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Lieu de naissance</label><input style={I_STYLE} value={draft.promoteur.lieuNaissance} onChange={set("promoteur.lieuNaissance")} /></div>
      </Section>

      <Section title="Autorisation de création (travaux)">
        <div><label style={L_STYLE}>Numéro</label><input style={I_STYLE} value={draft.autorisationCreation.numero} onChange={set("autorisationCreation.numero")} /></div>
        <div><label style={L_STYLE}>Date de signature</label><input style={I_STYLE} type="date" value={draft.autorisationCreation.dateSignature} onChange={set("autorisationCreation.dateSignature")} /></div>
        <div><label style={L_STYLE}>Ministre signataire</label><input style={I_STYLE} value={draft.autorisationCreation.ministre} onChange={set("autorisationCreation.ministre")} /></div>
        <div><label style={L_STYLE}>Ministère</label><input style={I_STYLE} value={draft.autorisationCreation.ministere} onChange={set("autorisationCreation.ministere")} /></div>
      </Section>

      <Section title="Arrêté d'ouverture (agrément)">
        <div><label style={L_STYLE}>Numéro</label><input style={I_STYLE} value={draft.arreteOuverture.numero} onChange={set("arreteOuverture.numero")} /></div>
        <div><label style={L_STYLE}>Date de signature</label><input style={I_STYLE} type="date" value={draft.arreteOuverture.dateSignature} onChange={set("arreteOuverture.dateSignature")} /></div>
        <div><label style={L_STYLE}>Ministre signataire</label><input style={I_STYLE} value={draft.arreteOuverture.ministre} onChange={set("arreteOuverture.ministre")} /></div>
        <div><label style={L_STYLE}>Ministère</label><input style={I_STYLE} value={draft.arreteOuverture.ministere} onChange={set("arreteOuverture.ministere")} /></div>
        <div><label style={L_STYLE}>Validité (années)</label><input style={I_STYLE} type="number" value={draft.arreteOuverture.dureeValiditeAnnees} onChange={setNum("arreteOuverture.dureeValiditeAnnees")} /></div>
        <div><label style={L_STYLE}>Expiration (calculée)</label><input style={{ ...I_STYLE, background: "#f1f5f9", color: "#475569" }} value={formatDateFR(computeDateExpiration(draft))} readOnly /></div>
      </Section>

      <Section title="Codes statistiques officiels">
        <div><label style={L_STYLE}>Maternelle</label><input style={I_STYLE} value={draft.codesStatistiques.maternelle} onChange={set("codesStatistiques.maternelle")} /></div>
        <div><label style={L_STYLE}>Primaire</label><input style={I_STYLE} value={draft.codesStatistiques.primaire} onChange={set("codesStatistiques.primaire")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Secondaire</label><input style={I_STYLE} value={draft.codesStatistiques.secondaire} onChange={set("codesStatistiques.secondaire")} /></div>
      </Section>

      <Section title="Identité & localisation">
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Dénomination</label><input style={I_STYLE} value={draft.etablissement.denomination} onChange={set("etablissement.denomination")} /></div>
        <div><label style={L_STYLE}>Quartier</label><input style={I_STYLE} value={draft.etablissement.quartier} onChange={set("etablissement.quartier")} /></div>
        <div><label style={L_STYLE}>Commune</label><input style={I_STYLE} value={draft.etablissement.commune} onChange={set("etablissement.commune")} /></div>
        <div><label style={L_STYLE}>Région</label><input style={I_STYLE} value={draft.etablissement.region} onChange={set("etablissement.region")} /></div>
        <div><label style={L_STYLE}>Email</label><input style={I_STYLE} type="email" value={draft.etablissement.email} onChange={set("etablissement.email")} /></div>
      </Section>

      <Section title="Tutelle administrative">
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Ministère de tutelle</label><input style={I_STYLE} value={draft.etablissement.ministereTutelle || ""} onChange={set("etablissement.ministereTutelle")} placeholder="Ex. : Ministère de l'Enseignement Pré-Universitaire et de l'Éducation Civique" /></div>
        <div><label style={L_STYLE}>Inspection Régionale (IRE)</label><input style={I_STYLE} value={draft.etablissement.ire || ""} onChange={set("etablissement.ire")} placeholder="Ex. : IRE de Kindia" /></div>
        <div><label style={L_STYLE}>Direction Préfectorale (DPE)</label><input style={I_STYLE} value={draft.etablissement.dpe || ""} onChange={set("etablissement.dpe")} placeholder="Ex. : DPE de Kindia" /></div>
      </Section>

      {error && (
        <div style={{ marginTop: 14, padding: "10px 12px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, color: "#991b1b", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
        <Btn v="ghost" onClick={onClose} disabled={saving}>Annuler</Btn>
        <Btn v="success" onClick={() => onSave(draft)} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Btn>
      </div>
    </Modale>
  );
}
