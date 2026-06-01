import { C } from "../../../constants";

// Section "Couleurs de l'établissement" : couleur principale/secondaire + aperçu sidebar.
export function CouleursSection({ form, chg, inp, lbl, sec }) {
  return (
    <div style={sec}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🎨 Couleurs de l'établissement</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {[
          { key: "couleur1", label: "Couleur principale (fond sidebar, titres)" },
          { key: "couleur2", label: "Couleur secondaire (accents, boutons)" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="color" value={form[key]} onChange={chg(key)}
                style={{ width: 48, height: 40, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <input style={{ ...inp, flex: 1 }} value={form[key]} onChange={chg(key)} placeholder="#0A1628" />
              <div style={{ width: 40, height: 40, borderRadius: 8, background: form[key], border: "1px solid #e5e7eb", flexShrink: 0 }} />
            </div>
          </div>
        ))}
      </div>
      {/* Aperçu couleurs */}
      <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: form.couleur1, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: form.couleur2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏫</div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Aperçu sidebar</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: form.couleur2 }}>{form.nom || "Nom de l'école"}</p>
        </div>
      </div>
    </div>
  );
}
