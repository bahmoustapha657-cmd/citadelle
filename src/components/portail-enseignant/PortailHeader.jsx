import { Badge } from "../ui";

// En-tête du portail : école, enseignant, matière, déconnexion. Les onglets
// sont dans le menu latéral (PortailMenu) ; sur téléphone, ☰ l'ouvre.
export function PortailHeader({ schoolInfo, annee, nomEns, matiere, c1, c2, deconnecter, t, estMobile, setMenuOuvert }) {
  return (
    <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: estMobile ? "12px" : "14px 24px", display: "flex", alignItems: "center", gap: estMobile ? 10 : 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)", flexShrink: 0 }}>
      {estMobile && (
        <button onClick={() => setMenuOuvert((v) => !v)} aria-label={t("teacher.header.menu")} title={t("teacher.header.menu")}
          style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: "#fff", fontSize: 22 }}>
          ☰
        </button>
      )}
      {schoolInfo.logo && <img crossOrigin="anonymous" src={schoolInfo.logo} alt={t("teacher.header.logoAlt")} style={{ width: 38, height: 38, flexShrink: 0, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
      <div style={{ flex: 1, minWidth: 0, textAlign: "start" }}>
        <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || t("teacher.header.school")}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{t("teacher.header.portal", { year: annee })}</div>
      </div>
      <div style={{ textAlign: "end", minWidth: 0, maxWidth: estMobile ? "45%" : undefined }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{nomEns}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <Badge color="purple">{matiere || t("teacher.header.teacher")}</Badge>
          <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{t("auth.logout")}</button>
        </div>
      </div>
    </div>
  );
}
