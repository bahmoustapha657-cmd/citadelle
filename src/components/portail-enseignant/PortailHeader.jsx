import { useState } from "react";
import { Badge } from "../ui";
import { useMessagerie } from "../messagerie/messagerie-contexte";
import { lienMesFiches } from "../../backend/pedagogue-supabase";

export function PortailHeader({ schoolInfo, annee, nomEns, matiere, c1, c2, deconnecter, t, tab, setTab, uid }) {
  const messagerie = useMessagerie();
  const [ouverture, setOuverture] = useState(false);
  const [erreurFiches, setErreurFiches] = useState("");

  // Même onglet : une fenêtre ouverte depuis ici serait coupée par notre COOP.
  const ouvrirMesFiches = async () => {
    setOuverture(true);
    setErreurFiches("");
    try {
      window.location.assign(await lienMesFiches(uid));
    } catch (e) {
      setErreurFiches(e.message);
    } finally {
      setOuverture(false);
    }
  };

  const tabs = [
    { id: "dashboard", label: t("teacher.tabs.overview") },
    // Tôt dans la rangée : sur téléphone, la fin reste hors de l'écran.
    { id: "fiches", label: <>{t("teacher.tabs.lessonPlans")} <span aria-hidden="true">↗</span></>, externe: true },
    { id: "edt", label: t("teacher.tabs.schedule") },
    { id: "notes", label: t("teacher.tabs.grades") },
    { id: "eleves", label: t("teacher.tabs.students") },
    { id: "absences", label: t("dashboard.absences") },
    { id: "salaire", label: t("accounting.tabs.salaries") },
    ...(messagerie ? [{ id: "messages", label: `💬 ${t("teacher.tabs.messages")}`, badge: messagerie.nonLus }] : []),
  ];

  return (
    <>
      <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        {schoolInfo.logo && <img crossOrigin="anonymous" src={schoolInfo.logo} alt={t("teacher.header.logoAlt")} style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || t("teacher.header.school")}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{t("teacher.header.portal", { year: annee })}</div>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{nomEns}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Badge color="purple">{matiere || t("teacher.header.teacher")}</Badge>
            <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{t("auth.logout")}</button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => (item.externe ? ouvrirMesFiches() : setTab(item.id))}
            disabled={item.externe && ouverture}
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
              opacity: item.externe && ouverture ? 0.6 : 1,
            }}
          >
            {item.label}
            {item.badge > 0 && (
              <span style={{ marginInlineStart: 6, background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 800, padding: "1px 6px" }}>
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {erreurFiches && (
        <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", padding: "10px 24px", fontSize: 13, fontWeight: 600 }}>
          {erreurFiches}
        </div>
      )}
    </>
  );
}
