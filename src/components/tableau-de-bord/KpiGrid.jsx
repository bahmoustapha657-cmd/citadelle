import { fmt, getSectionLabel, isSectionActive } from "../../constants";

// `clair` : affichage lisible (intitulés et explications bien contrastés) ;
// sans lui, l'apparence d'origine (écoles qui la gardent, cf. finances-claires.js).
function KPI({ c1, c2, label, value, sub, icon, color = "white", trend, clair = false }) {
  return (
    <div style={{ background: c1, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -12, right: -12, fontSize: 48, opacity: 0.06 }}>{icon}</div>
      <div style={clair
        ? { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.92)", marginBottom: 6 }
        : { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 900, color: color === "green" ? c2 : color === "red" ? "#fca5a5" : "#fff", lineHeight: 1, fontVariantNumeric: clair ? "tabular-nums" : undefined }}>{value}</div>
      {sub && <div style={clair
        ? { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 6, lineHeight: 1.4 }
        : { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{sub}</div>}
      {trend !== undefined && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: trend >= 0 ? "#4ade80" : "#f87171" }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
      </div>}
    </div>
  );
}

export function KpiGrid({
  t, c1, c2, schoolInfo = {}, totalEleves, elevesC, elevesL, elevesP, elevesPre = [],
  totalEns, ensC, ensL, ensP, ensPre = [], tauxPay, solde, totalRec, totalDep,
  masseSal, salMois, moisActuel, totalAbs, financesClaires = null, anneeCourante = "",
}) {
  // Le détail ne cite que les sections ouvertes dans l'école (Paramètres →
  // Identité) : une école sans lycée n'affiche pas « 0 Lycée ». La maternelle
  // n'y figure en plus que si elle a des effectifs, comme avant.
  const actifs = (liste) => liste.filter((e) => e.statut === "Actif").length;
  const aAfficher = ([n, , section]) => isSectionActive(schoolInfo, section)
    && (n > 0 || section !== "prescolaire");
  const detailEleves = [
    [actifs(elevesPre), getSectionLabel("prescolaire"), "prescolaire"],
    [actifs(elevesC), t("dashboard.secondary"), "college"],
    [actifs(elevesL), t("dashboard.lycee"), "lycee"],
    [actifs(elevesP), t("dashboard.primary"), "primaire"],
  ].filter(aAfficher).map(([n, label]) => `${n} ${label}`).join(" · ");
  const detailEns = [
    [ensPre.length, "M", "prescolaire"], [ensC.length, "C", "college"],
    [ensL.length, "L", "lycee"], [ensP.length, "P", "primaire"],
  ].filter(aAfficher).map(([n, s]) => `${n}${s}`).join(" · ");

  const grille = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 };

  if (financesClaires) {
    const f = financesClaires;
    const r = f.recouvrement;
    const k = { c1, c2, clair: true };
    return (
      <div style={{ ...grille, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))" }}>
        <KPI {...k} label={t("dashboard.activeStudents")} value={totalEleves} icon="🎓" sub={detailEleves} />
        <KPI {...k} label={t("dashboard.totalTeachers")} value={totalEns} icon="👨‍🏫" sub={detailEns} />
        <KPI {...k} label={t("dashboard.realBalance", { annee: anneeCourante })} icon="💰"
          value={`${f.solde < 0 ? "− " : ""}${fmt(Math.abs(f.solde))}`} color={f.solde >= 0 ? "green" : "red"}
          sub={t("dashboard.realBalanceSub", { entre: fmt(f.totalEntrees), sorti: fmt(f.totalSorties) })} />
        <KPI {...k} label={t("dashboard.toCollect")} value={fmt(r.reste)} icon="⏳" color={r.reste > 0 ? "red" : "green"}
          sub={t("dashboard.toCollectSub", { taux: r.taux.toFixed(0) })} />
        <KPI {...k} label={t("dashboard.monthsPaid")} value={`${tauxPay}%`} icon="💳" color="green"
          sub={t("dashboard.monthsPaidSub")} />
        <KPI {...k} label={t("dashboard.salariesOf", { mois: moisActuel })} value={fmt(masseSal)} icon="📋"
          sub={t("dashboard.salariesSub", { n: salMois.length })} />
        <KPI {...k} label={t("dashboard.absencesEntered")} value={totalAbs} icon="📝" sub={t("dashboard.allSections")} />
      </div>
    );
  }

  return (
    <div style={grille}>
      <KPI c1={c1} c2={c2} label={t("dashboard.activeStudents")} value={totalEleves} icon="🎓" sub={detailEleves} />
      <KPI c1={c1} c2={c2} label={t("dashboard.totalTeachers")} value={totalEns} icon="👨‍🏫" sub={detailEns} />
      <KPI c1={c1} c2={c2} label={t("dashboard.paymentRate")} value={`${tauxPay}%`} icon="💳" color="green" sub={t("dashboard.allSections")} />
      <KPI c1={c1} c2={c2} label={t("dashboard.treasury")} value={fmt(solde)} icon="💰" color={solde >= 0 ? "green" : "white"} sub={`${fmt(totalRec)} / ${fmt(totalDep)}`} />
      <KPI c1={c1} c2={c2} label={t("dashboard.salaryTotal")} value={fmt(masseSal)} icon="📋" sub={`${salMois.length} · ${moisActuel}`} />
      <KPI c1={c1} c2={c2} label={t("dashboard.absencesEntered")} value={totalAbs} icon="📝" sub={t("dashboard.allSections")} />
    </div>
  );
}
