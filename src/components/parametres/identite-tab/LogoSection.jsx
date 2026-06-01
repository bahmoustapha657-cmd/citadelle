import { C } from "../../../constants";

// Section "Logo" : aperçu, upload fichier ou URL, suppression, et application
// des couleurs détectées automatiquement dans le logo.
export function LogoSection({
  form,
  setForm,
  apercu,
  handleLogoFile,
  resetLogo,
  couleursDetectees,
  setCouleursDetectees,
  appliquerCouleursDetectees,
  inp,
  lbl,
  sec,
}) {
  return (
    <div style={sec}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🖼️ Logo de l'établissement</h3>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Aperçu */}
        <div style={{ width: 100, height: 100, borderRadius: 12, border: "2px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#f9fafb", flexShrink: 0 }}>
          {(apercu || form.logo)
            ? <img src={apercu || form.logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: 32 }}>🏫</span>}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ ...lbl, marginTop: 0 }}>Uploader un fichier (max 500 Ko)</label>
          <input type="file" accept="image/*" onChange={handleLogoFile}
            style={{ ...inp, padding: "6px 8px", cursor: "pointer" }} />
          <label style={lbl}>Ou coller une URL d'image</label>
          <input style={inp} value={form.logo.startsWith("data:") ? "" : (form.logo || "")}
            onChange={e => { setForm(p => ({ ...p, logo: e.target.value })); }}
            placeholder="https://exemple.com/logo.png" />
          {(form.logo || apercu) && (
            <button onClick={resetLogo}
              style={{ marginTop: 8, background: "#fee2e2", border: "none", color: "#991b1b", padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ✕ Supprimer le logo
            </button>
          )}
          {couleursDetectees && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>🎨 Couleurs détectées dans le logo :</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: couleursDetectees.c1, border: "2px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }} />
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Couleur 1<br /><code style={{ fontSize: 10, color: "#6b7280" }}>{couleursDetectees.c1}</code></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: couleursDetectees.c2, border: "2px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }} />
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Couleur 2<br /><code style={{ fontSize: 10, color: "#6b7280" }}>{couleursDetectees.c2}</code></span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={appliquerCouleursDetectees}
                  style={{ background: "linear-gradient(135deg,#065f46,#059669)", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ✔ Appliquer ces couleurs
                </button>
                <button onClick={() => setCouleursDetectees(p => ({ c1: p.c2, c2: p.c1 }))}
                  style={{ background: "#e0ebf8", color: C.blueDark, border: "none", padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ⇄ Inverser
                </button>
                <button onClick={() => setCouleursDetectees(null)}
                  style={{ background: "#e5e7eb", color: "#374151", border: "none", padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Ignorer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
