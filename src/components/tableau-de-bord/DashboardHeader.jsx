import { getAnnee } from "../../constants";
import { genererRapportAnnuel, genererRapportMensuel } from "../../reports";
import { Btn } from "../ui";

export function DashboardHeader({
  t, c1, schoolInfo, annee, moisAnnee, moisRapport, setMoisRapport,
  elevesC, elevesL, elevesP, absences, absL, absP,
  notesC, notesL, notesP, recettes, depenses, salaires, ensC, ensL, ensP,
}) {
  return (
    <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: c1 }}>
          {t("dashboard.title")} — {schoolInfo.nom || "EduGest"}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{t("dashboard.yearLabel")} {annee || getAnnee()} · {t("dashboard.consolidatedView")}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select value={moisRapport} onChange={(e) => setMoisRapport(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 8, padding: "6px 10px", fontSize: 12, background: "#fff", color: c1, fontWeight: 600 }}>
          {moisAnnee.map((m) => <option key={m}>{m}</option>)}
        </select>
        <Btn v="primary" sm onClick={() => genererRapportMensuel(
          moisRapport,
          [...elevesC, ...elevesL, ...elevesP],
          [...absences, ...absL, ...absP],
          annee || getAnnee(),
          schoolInfo,
          moisAnnee,
        )}>📄 {t("dashboard.monthlyReport")}</Btn>
        <Btn v="success" sm onClick={() => genererRapportAnnuel({
          annee: annee || getAnnee(),
          moisAnnee,
          eleves: [...elevesC, ...elevesL, ...elevesP],
          absences: [...absences, ...absL, ...absP],
          notes: [...notesC, ...notesL, ...notesP],
          recettes, depenses, salaires,
          ensC, ensL, ensP,
        }, schoolInfo)}>📊 {t("dashboard.annualReport")}</Btn>
      </div>
    </div>
  );
}
