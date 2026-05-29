import { useState } from "react";
import { Btn, Modale } from "../ui";
import { computeDateExpiration, formatDateFR } from "../../legal-utils";

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

const L_STYLE = { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" };
const I_STYLE = { width: "100%", border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", outline: "none" };

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
export function LegalEditModal({ profile, schoolInfo, onClose, onSave, saving = false, error = "" }) {
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
