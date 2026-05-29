import { C, PLANS } from "../../constants";
import { NIVEAUX, ROLES_CIBLABLES } from "./communications-constants";

const inp = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const lab = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: C.blueDark,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lab}>Titre</label>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre court et clair" style={inp} maxLength={120} />
        </div>
        <div>
          <label style={lab}>Niveau</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inp}>
            {NIVEAUX.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lab}>Message</label>
        <textarea
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder="Texte professionnel, sans mise en forme. Les retours à la ligne sont conservés."
          rows={5}
          maxLength={2000}
          style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
          {corps.length}/2000 caractères
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lab}>Cibler les écoles</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            { id: "toutes", label: "Toutes" },
            { id: "plan", label: "Par plan" },
            { id: "selection", label: "Sélection" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeCible(m.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: `2px solid ${modeCible === m.id ? C.blue : "#e5e7eb"}`,
                background: modeCible === m.id ? "#e0f2fe" : "#fff",
                color: modeCible === m.id ? C.blue : "#6b7280",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {modeCible === "plan" && (
          <select value={planChoisi} onChange={(e) => setPlanChoisi(e.target.value)} style={inp}>
            {Object.entries(PLANS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label} — {ecolesParPlan[key] || 0} école(s)
              </option>
            ))}
          </select>
        )}

        {modeCible === "selection" && (
          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
            {ecoles.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>Aucune école.</div>
            ) : (
              ecoles.map((e) => (
                <label key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={schoolsChoisies.includes(e._id)}
                    onChange={() => toggleSchool(e._id)}
                  />
                  <span style={{ flex: 1 }}>{e.nom}</span>
                  <code style={{ fontSize: 11, color: "#9ca3af" }}>{e._id}</code>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lab}>Cibler les rôles (parent toujours exclu)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ROLES_CIBLABLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRole(r.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `2px solid ${rolesChoisis.includes(r.id) ? C.green : "#e5e7eb"}`,
                background: rolesChoisis.includes(r.id) ? "#d1fae5" : "#fff",
                color: rolesChoisis.includes(r.id) ? "#065f46" : "#6b7280",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {rolesChoisis.includes(r.id) ? "✓ " : ""}
              {r.label}
            </button>
          ))}
        </div>
      </div>

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
