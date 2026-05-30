// Fiche détaillée d'un enseignant.
export function FicheEnseignant({ data, section, onNaviguer, onFermer }) {
  const sectionLabel = section === "primaire" ? "Primaire" : section === "lycee" ? "Lycée" : "Collège";
  const sectionColor = section === "college" ? "#3b82f6" : section === "lycee" ? "#8b5cf6" : "#10b981";
  const moduleTarget = section === "primaire" ? "primaire" : "secondaire";
  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "20px 24px", background: "linear-gradient(135deg,#064e3b,#065f46)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
          👨‍🏫
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>{data.nom}{data.prenom ? " " + data.prenom : ""}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ background: sectionColor, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{sectionLabel}</span>
            {data.matiere && <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{data.matiere}</span>}
          </div>
        </div>
      </div>
      {/* Corps */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { l: "Matière", v: data.matiere },
            { l: "Contact", v: data.contact },
            { l: "Diplôme", v: data.diplome },
            { l: "Grade", v: data.grade },
            { l: "Statut", v: data.statut },
            { l: "Email", v: data.email },
            { l: "Adresse", v: data.adresse },
            { l: "Date d'embauche", v: data.dateEmbauche },
          ].filter(x => x.v).map(({ l, v }) => (
            <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{v}</div>
            </div>
          ))}
        </div>
        {data.observation && <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#854d0e", fontWeight: 700, marginBottom: 4 }}>OBSERVATION</div>
          <div style={{ fontSize: 12, color: "#713f12" }}>{data.observation}</div>
        </div>}
        <button onClick={() => { onNaviguer(moduleTarget); onFermer(); }}
          style={{ width: "100%", background: "#064e3b", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          📂 Voir dans le module {sectionLabel} →
        </button>
      </div>
    </div>
  );
}
