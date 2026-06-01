import { C } from "../../constants";
import { ROLES_CIBLABLES } from "./communications-constants";
import { ComposerChamps } from "./message-composer/ComposerChamps";
import { CibleEcoles } from "./message-composer/CibleEcoles";
import { CibleRoles } from "./message-composer/CibleRoles";

export function MessageComposer({
  titre, setTitre, corps, setCorps, niveau, setNiveau,
  modeCible, setModeCible, planChoisi, setPlanChoisi,
  schoolsChoisies, rolesChoisis, envoiEnCours, erreur, succes,
  ecoles, ecolesParPlan, toggleRole, toggleSchool, envoyer, previewCible,
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,32,80,0.08)", padding: "22px 24px" }}>
      <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: C.blueDark }}>
        📢 Composer un message
      </h3>

      {erreur && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991b1b", fontWeight: 600 }}>
          {erreur}
        </div>
      )}
      {succes && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#065f46", fontWeight: 600 }}>
          ✅ {succes}
        </div>
      )}

      <ComposerChamps titre={titre} setTitre={setTitre} corps={corps} setCorps={setCorps} niveau={niveau} setNiveau={setNiveau} />

      <CibleEcoles
        modeCible={modeCible} setModeCible={setModeCible} planChoisi={planChoisi} setPlanChoisi={setPlanChoisi}
        schoolsChoisies={schoolsChoisies} ecoles={ecoles} ecolesParPlan={ecolesParPlan} toggleSchool={toggleSchool}
      />

      <CibleRoles rolesChoisis={rolesChoisis} toggleRole={toggleRole} />

      <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#374151" }}>
        <strong>Aperçu cible :</strong> {previewCible} · Rôles :{" "}
        {rolesChoisis.length === 0 ? "—" : rolesChoisis.map((r) => ROLES_CIBLABLES.find((x) => x.id === r)?.label).join(", ")}
      </div>

      <button
        onClick={envoyer}
        disabled={envoiEnCours}
        style={{
          background: `linear-gradient(90deg,${C.blue},${C.green})`,
          color: "#fff",
          border: "none",
          padding: "11px 22px",
          borderRadius: 9,
          fontSize: 13,
          fontWeight: 800,
          cursor: envoiEnCours ? "not-allowed" : "pointer",
          opacity: envoiEnCours ? 0.7 : 1,
        }}
      >
        {envoiEnCours ? "Envoi en cours…" : "📤 Envoyer le message"}
      </button>
    </div>
  );
}
