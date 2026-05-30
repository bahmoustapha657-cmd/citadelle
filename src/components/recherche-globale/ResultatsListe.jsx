const TYPE_COLOR = { module: "#6366f1", élève: "#0ea5e9", enseignant: "#10b981" };

// Liste des résultats de recherche, avec surbrillance de la sélection.
export function ResultatsListe({ resultats, selIdx, setSelIdx, executer, q }) {
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {resultats.length === 0 && <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>Aucun résultat pour « {q} »</div>}
      {resultats.map((r, i) => (
        <div key={i} onMouseEnter={() => setSelIdx(i)} onClick={() => executer(r)}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer",
            background: i === selIdx ? "#f0f6ff" : "transparent",
            borderLeft: i === selIdx ? "3px solid #0A1628" : "3px solid transparent",
            transition: "background .1s",
          }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
            <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ background: TYPE_COLOR[r.type] || "#94a3b8", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "capitalize" }}>{r.type}</span>
            {r.type !== "module" && <span style={{ fontSize: 12, color: "#94a3b8" }}>›</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
