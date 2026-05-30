// Fiche détaillée d'un élève (identité, famille, mensualités).
export function FicheEleve({ data, section, moisAnnee, onNaviguer, onFermer }) {
  const mens = data.mens || {};
  const mois = moisAnnee || [];
  const nbPayes = mois.filter(m => mens[m] === "Payé").length;
  const nbTotal = mois.length;
  const sectionLabel = section === "college" ? "Collège" : section === "lycee" ? "Lycée" : "Primaire";
  const sectionColor = section === "college" ? "#3b82f6" : section === "lycee" ? "#8b5cf6" : "#10b981";
  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "20px 24px", background: "linear-gradient(135deg,#0A1628,#1e3a5f)" }}>
        <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {data.photo
            ? <img src={data.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 28 }}>👤</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>{data.nom} {data.prenom}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ background: sectionColor, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{sectionLabel}</span>
            <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{data.classe || "—"}</span>
            <span style={{ background: data.statut === "Actif" ? "#10b981" : "#ef4444", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{data.statut || "Actif"}</span>
          </div>
        </div>
      </div>
      {/* Corps */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Identité */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { l: "Matricule", v: data.matricule, mono: true },
            { l: "IEN", v: data.ien, mono: true },
            { l: "Sexe", v: data.sexe === "M" ? "Masculin" : data.sexe === "F" ? "Féminin" : data.sexe || "—" },
            { l: "Date de naissance", v: data.dateNaissance || "—" },
            { l: "Lieu de naissance", v: data.lieuNaissance || "—" },
            { l: "Type d'inscription", v: data.typeInscription || "—" },
          ].map(({ l, v, mono }) => (
            <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: mono ? "monospace" : "inherit" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
        {/* Famille */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0369a1", marginBottom: 8, textTransform: "uppercase" }}>👨‍👩‍👧 Famille & contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "Tuteur", v: data.tuteur },
              { l: "Contact", v: data.contactTuteur },
              { l: "Filiation", v: data.filiation },
              { l: "Domicile", v: data.domicile },
            ].map(({ l, v }) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Mensualités */}
        {nbTotal > 0 && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", textTransform: "uppercase" }}>💰 Mensualités</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: nbPayes === nbTotal ? "#15803d" : "#dc2626" }}>{nbPayes}/{nbTotal} payés</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {mois.map(m => {
              const paye = mens[m] === "Payé";
              return <span key={m} title={m} style={{
                padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: paye ? "#dcfce7" : "#fee2e2", color: paye ? "#15803d" : "#dc2626",
                border: `1px solid ${paye ? "#86efac" : "#fca5a5"}`
              }}>{m.slice(0, 3)} {paye ? "✓" : "✗"}</span>;
            })}
          </div>
        </div>}
        {/* Bouton naviguer */}
        <button onClick={() => { onNaviguer(section === "primaire" ? "primaire" : "secondaire"); onFermer(); }}
          style={{ width: "100%", background: "#0A1628", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          📂 Voir dans le module {sectionLabel} →
        </button>
      </div>
    </div>
  );
}
