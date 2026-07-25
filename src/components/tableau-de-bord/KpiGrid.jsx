import { fmt, getSectionLabel } from "../../constants";

function KPI({ c1, c2, label, value, sub, icon, color = "white", trend }) {
  return (
    <div style={{ background: c1, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -12, right: -12, fontSize: 48, opacity: 0.06 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 900, color: color === "green" ? c2 : "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{sub}</div>}
      {trend !== undefined && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: trend >= 0 ? "#4ade80" : "#f87171" }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
      </div>}
    </div>
  );
}

export function KpiGrid({
  t, c1, c2, totalEleves, elevesC, elevesL, elevesP, elevesPre = [],
  totalEns, ensC, ensL, ensP, ensPre = [], tauxPay, solde, totalRec, totalDep,
  masseSal, salMois, moisActuel, totalAbs,
}) {
  // Le détail n'affiche une section que si elle a des effectifs : une école
  // sans maternelle garde exactement la même ligne qu'avant.
  const actifs = (liste) => liste.filter((e) => e.statut === "Actif").length;
  const detailEleves = [
    [actifs(elevesPre), getSectionLabel("prescolaire")],
    [actifs(elevesC), t("dashboard.secondary")],
    [actifs(elevesL), t("dashboard.lycee")],
    [actifs(elevesP), t("dashboard.primary")],
  ].filter(([n], i) => n > 0 || i > 0).map(([n, label]) => `${n} ${label}`).join(" · ");
  const detailEns = [
    [ensPre.length, "M"], [ensC.length, "C"], [ensL.length, "L"], [ensP.length, "P"],
  ].filter(([n], i) => n > 0 || i > 0).map(([n, s]) => `${n}${s}`).join(" · ");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
      <KPI c1={c1} c2={c2} label={t("dashboard.activeStudents")} value={totalEleves} icon="🎓" sub={detailEleves} />
      <KPI c1={c1} c2={c2} label={t("dashboard.totalTeachers")} value={totalEns} icon="👨‍🏫" sub={detailEns} />
      <KPI c1={c1} c2={c2} label={t("dashboard.paymentRate")} value={`${tauxPay}%`} icon="💳" color="green" sub={t("dashboard.allSections")} />
      <KPI c1={c1} c2={c2} label={t("dashboard.treasury")} value={fmt(solde)} icon="💰" color={solde >= 0 ? "green" : "white"} sub={`${fmt(totalRec)} / ${fmt(totalDep)}`} />
      <KPI c1={c1} c2={c2} label={t("dashboard.salaryTotal")} value={fmt(masseSal)} icon="📋" sub={`${salMois.length} · ${moisActuel}`} />
      <KPI c1={c1} c2={c2} label={t("dashboard.absencesEntered")} value={totalAbs} icon="📝" sub={t("dashboard.allSections")} />
    </div>
  );
}
