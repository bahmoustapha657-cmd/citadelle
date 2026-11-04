import { useTranslation } from "react-i18next";
import { C, JOURS_SEMAINE } from "../../constants";
import { normaliserCreneau, jourCourant, creneauxDuJour, horaire } from "../../edt-portail";
import { getEvaluationLabel } from "../../evaluation-forms";
import { Badge, Card, Stat, TD, THead, TR } from "../ui";

export function DashboardTab({
  c1, nomEns, matiere, schoolInfo, utilisateur, t,
  mesClasses, eleves, mesNotes, maxNote = 20, emplois, mesEvenements, onVoirEdt,
}) {
  return (
    <>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: c1 }}>{t("teacher.welcome")}, {nomEns.split(" ")[0] || nomEns}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label={t("teacher.myClasses")} value={mesClasses.length} sub={mesClasses.join(", ") || "-"} bg="#f0f7ff" />
        <Stat label={t("teacher.dash.myStudents")} value={eleves.length} sub={t("teacher.dash.assignedClasses")} bg="#f0fdf4" />
        <Stat label={t("teacher.dash.gradesEntered")} value={mesNotes.length} sub={matiere || t("teacher.dash.all")} bg="#fefce8" />
        <Stat label={t("teacher.dash.slotsPerWeek")} value={emplois.length} sub={t("teacher.dash.timetable")} bg="#fdf4ff" />
        <Stat label={t("teacher.dash.events")} value={mesEvenements.length} sub={t("teacher.dash.teacherHistory")} bg="#fff1f2" />
      </div>

      {emplois.length > 0 && (
        <CoursDuJour emplois={emplois} matiere={matiere} c1={c1} onVoirEdt={onVoirEdt} />
      )}

      {mesNotes.length > 0 && (
        <Card>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
            <strong style={{ fontSize: 13, color: c1 }}>{t("teacher.dash.lastGrades")}</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={[t("teacher.cols.student"), t("teacher.cols.subject"), t("teacher.cols.type"), t("teacher.cols.period"), t("teacher.cols.grade")]} />
              <tbody>
                {mesNotes.slice(0, 10).map((note) => (
                  <TR key={note._id}>
                    <TD bold>{note.eleveNom || "-"}</TD>
                    <TD>{note.matiere}</TD>
                    <TD><Badge color="blue">{getEvaluationLabel(note.type, schoolInfo, { section: utilisateur.section || "secondaire" })}</Badge></TD>
                    <TD>{note.periode}</TD>
                    <TD center><strong style={{ color: Number(note.note) >= maxNote / 2 ? C.greenDk : "#b91c1c" }}>{note.note}/{maxNote}</strong></TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </div>
        </Card>
      )}
    </>
  );
}

// Cours du jour (aujourd'hui, ou le prochain jour où l'enseignant a cours),
// dans l'ordre de la journée ; la semaine complète est dans l'onglet EDT.
function CoursDuJour({ emplois, matiere, c1, onVoirEdt }) {
  const { t } = useTranslation();
  const liste = emplois.map(normaliserCreneau).filter((c) => c.type !== "recreation");
  const aujourdhui = jourCourant();
  const debut = Math.max(0, JOURS_SEMAINE.indexOf(aujourdhui));
  const ordre = [...JOURS_SEMAINE.slice(debut), ...JOURS_SEMAINE.slice(0, debut)];
  const jour = ordre.find((j) => liste.some((c) => c.jour === j));
  if (!jour) return null;
  const cours = creneauxDuJour(liste, jour);
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13, color: c1, flex: 1 }}>
          {jour === aujourdhui ? t("teacher.dash.todayLessons") : t("teacher.dash.nextLessons", { day: t(`weekdays.${jour}`, jour) })}
        </strong>
        <button type="button" onClick={onVoirEdt} style={{ border: "none", background: "none", color: c1, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          {t("teacher.dash.wholeWeek")}
        </button>
      </div>
      <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
        {cours.map((c, k) => (
          <div key={c._id || k} style={{ background: `${c1}0d`, borderInlineStart: `4px solid ${c1}`, borderRadius: 10, borderStartStartRadius: 0, borderEndStartRadius: 0, padding: "9px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: c1 }}>{horaire(c)}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>{c.classe || "—"}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{c.matiere || matiere}{c.salle ? ` · ${t("teacher.dash.room", { room: c.salle })}` : ""}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
