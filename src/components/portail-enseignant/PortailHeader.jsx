import { Badge } from "../ui";

export function PortailHeader({ schoolInfo, annee, nomEns, matiere, c1, c2, deconnecter, t, tab, setTab }) {
  const tabs = [
    { id: "dashboard", label: t("teacher.tabs.overview") },
    { id: "edt", label: t("teacher.tabs.schedule") },
    { id: "notes", label: t("teacher.tabs.grades") },
    { id: "eleves", label: t("teacher.tabs.students") },
    { id: "absences", label: t("dashboard.absences") },
    { id: "salaire", label: t("accounting.tabs.salaries") },
  ];

  return (
    <>
      <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        {schoolInfo.logo && <img src={schoolInfo.logo} alt="logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || "Ecole"}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Portail enseignant - {annee}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{nomEns}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Badge color="purple">{matiere || "Enseignant"}</Badge>
            <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{t("auth.logout")}</button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              padding: "13px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: tab === item.id ? c1 : "#64748b",
              borderBottom: tab === item.id ? `3px solid ${c1}` : "3px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
