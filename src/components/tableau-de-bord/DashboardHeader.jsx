import { getAnnee } from "../../constants";
import { genererRapportAnnuel, genererRapportMensuel } from "../../reports";
import { Btn } from "../ui";

const champMois = {
  border: "1px solid var(--lc-border)", borderRadius: 8, padding: "6px 10px", fontSize: 12,
  background: "var(--lc-surface)", color: "var(--lc-text)", fontWeight: 600, cursor: "pointer",
};

export function DashboardHeader({
  t, schoolInfo, annee, moisAnnee, moisRapport, setMoisRapport,
  elevesC, elevesL, elevesP, elevesPre = [], absences, absL, absP, absPre = [],
  notesC, notesL, notesP, notesPre = [], recettes, depenses, salaires, ensC, ensL, ensP, ensPre = [],
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingBottom: 4 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--lc-text-muted)" }}>
          {schoolInfo.nom || "EduGest"} · {t("dashboard.yearLabel")} {annee || getAnnee()}
        </p>
        <h1 style={{ margin: "2px 0 0", fontSize: "clamp(20px,2.4vw,24px)", fontWeight: 800, color: "var(--lc-text-brand)", letterSpacing: "-0.01em" }}>
          {t("dashboard.title")}
        </h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select value={moisRapport} onChange={(e) => setMoisRapport(e.target.value)} style={champMois} aria-label={t("dashboard.monthlyReport")}>
          {moisAnnee.map((m) => <option key={m}>{m}</option>)}
        </select>
        <Btn v="ghost" sm onClick={() => genererRapportMensuel(
          moisRapport,
          [...elevesC, ...elevesL, ...elevesP, ...elevesPre],
          [...absences, ...absL, ...absP, ...absPre],
          annee || getAnnee(),
          schoolInfo,
          moisAnnee,
        )}>📄 {t("dashboard.monthlyReport")}</Btn>
        <Btn v="primary" sm onClick={() => genererRapportAnnuel({
          annee: annee || getAnnee(),
          moisAnnee,
          eleves: [...elevesC, ...elevesL, ...elevesP, ...elevesPre],
          absences: [...absences, ...absL, ...absP, ...absPre],
          notes: [...notesC, ...notesL, ...notesP, ...notesPre],
          recettes, depenses, salaires,
          ensC, ensL, ensP, ensPre,
        }, schoolInfo)}>📊 {t("dashboard.annualReport")}</Btn>
      </div>
    </div>
  );
}
