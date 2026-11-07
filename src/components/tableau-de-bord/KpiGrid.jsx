import { fmt, getSectionLabel, isSectionActive } from "../../constants";
import { ESPACE } from "./tdb-styles";

const TEINTES = { green: "#10b981", red: "#ef4444" };

// Tuile claire : pastille d'icône, intitulé discret, chiffre en avant.
// `clair` : affichage lisible (intitulés et explications bien contrastés) ;
// sans lui, l'apparence d'origine (écoles qui la gardent, cf. finances-claires.js).
function KPI({ label, value, sub, icon, color = "white", trend, clair = false }) {
  return (
    <div style={{
      background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 14,
      padding: "16px 18px", boxShadow: "var(--lc-shadow)", display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" style={{
          width: 32, height: 32, borderRadius: 9, background: "var(--lc-surface-alt)", border: "1px solid var(--lc-border-soft)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
        }}>{icon}</span>
        <span style={clair
          ? { fontSize: 13, fontWeight: 700, color: "var(--lc-text)", lineHeight: 1.3 }
          : { fontSize: 11, fontWeight: 700, color: "var(--lc-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: "clamp(22px,2.6vw,28px)", fontWeight: 800, color: TEINTES[color] || "var(--lc-text-brand)", lineHeight: 1.1, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: clair ? "var(--lc-text-muted)" : "var(--lc-text-faint)", lineHeight: 1.4 }}>{sub}</div>}
      {trend !== undefined && <div style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? TEINTES.green : TEINTES.red }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
      </div>}
    </div>
  );
}

export function KpiGrid({
  t, schoolInfo = {}, totalEleves, elevesC, elevesL, elevesP, elevesPre = [],
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

  // Au plus `n` colonnes (lignes complètes), jamais moins de 150 px : 2 colonnes sur téléphone.
  const colonnes = (n) => `repeat(auto-fill,minmax(max(min(100%,150px),calc((100% - ${n - 1} * ${ESPACE - 4}px) / ${n})),1fr))`;
  const grille = { display: "grid", gridTemplateColumns: colonnes(3), gap: ESPACE - 4 };

  if (financesClaires) {
    const f = financesClaires;
    const r = f.recouvrement;
    const k = { clair: true };
    return (
      <div style={{ ...grille, gridTemplateColumns: colonnes(4) }}>
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
      <KPI label={t("dashboard.activeStudents")} value={totalEleves} icon="🎓" sub={detailEleves} />
      <KPI label={t("dashboard.totalTeachers")} value={totalEns} icon="👨‍🏫" sub={detailEns} />
      <KPI label={t("dashboard.paymentRate")} value={`${tauxPay}%`} icon="💳" color="green" sub={t("dashboard.allSections")} />
      <KPI label={t("dashboard.treasury")} value={fmt(solde)} icon="💰" color={solde >= 0 ? "green" : "white"} sub={`${fmt(totalRec)} / ${fmt(totalDep)}`} />
      <KPI label={t("dashboard.salaryTotal")} value={fmt(masseSal)} icon="📋" sub={`${salMois.length} · ${moisActuel}`} />
      <KPI label={t("dashboard.absencesEntered")} value={totalAbs} icon="📝" sub={t("dashboard.allSections")} />
    </div>
  );
}
