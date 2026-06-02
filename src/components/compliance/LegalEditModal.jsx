import { Btn, Modale } from "../ui";
import { useLegalDraft } from "./legal-edit-modal/use-legal-draft";
import { LegalEditFields } from "./legal-edit-modal/LegalEditFields";

// ── Modale d'édition (réservée directeur/admin) ──────────────────
// Pré-remplissage automatique depuis les champs legacy de `schoolInfo`
// (ministere, agrement, ire, dpe) tant que les champs structurés du
// profil légal sont vides. Permet la migration en douceur : la 1ère
// sauvegarde matérialise les valeurs dans /config/legal.
export function LegalEditModal({ profile, schoolInfo, onClose, onSave, saving = false, error = "" }) {
  const { draft, set, setNum } = useLegalDraft(profile, schoolInfo);

  return (
    <Modale titre="Informations légales de l'établissement" fermer={onClose} large>
      <LegalEditFields draft={draft} set={set} setNum={setNum} />

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
