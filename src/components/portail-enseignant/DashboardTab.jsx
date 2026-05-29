import { C } from "../../constants";
import { getEvaluationLabel } from "../../evaluation-forms";
import { Badge, Card, Stat, TD, THead, TR } from "../ui";

export function DashboardTab({
  c1, nomEns, matiere, schoolInfo, utilisateur, t,
  mesClasses, eleves, mesNotes, emplois, mesEvenements, formatEmploiHeure,
}) {
  return (
    <>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: c1 }}>{t("teacher.welcome")}, {nomEns.split(" ")[0] || nomEns}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label={t("teacher.myClasses")} value={mesClasses.length} sub={mesClasses.join(", ") || "-"} bg="#f0f7ff" />
        <Stat label="Mes eleves" value={eleves.length} sub="classes attribuees" bg="#f0fdf4" />
        <Stat label="Notes saisies" value={mesNotes.length} sub={matiere || "Toutes"} bg="#fefce8" />
        <Stat label="Creneaux / semaine" value={emplois.length} sub="emploi du temps" bg="#fdf4ff" />
        <Stat label="Evenements" value={mesEvenements.length} sub="historique enseignant" bg="#fff1f2" />
      </div>

      {emplois.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
            <strong style={{ fontSize: 13, color: c1 }}>Mon emploi du temps</strong>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {emplois.map((emploi, index) => (
              <div key={index} style={{ background: `${c1}11`, borderLeft: `3px solid ${c1}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", minWidth: 130 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c1 }}>{emploi.jour} - {formatEmploiHeure(emploi)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginTop: 2 }}>{emploi.classe}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{emploi.matiere || matiere}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {mesNotes.length > 0 && (
        <Card>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
            <strong style={{ fontSize: 13, color: c1 }}>Dernieres notes saisies</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={["Eleve", "Matiere", "Type", "Periode", "Note"]} />
              <tbody>
                {mesNotes.slice(0, 10).map((note) => (
                  <TR key={note._id}>
                    <TD bold>{note.eleveNom}</TD>
                    <TD>{note.matiere}</TD>
                    <TD><Badge color="blue">{getEvaluationLabel(note.type, schoolInfo, { section: utilisateur.section || "secondaire" })}</Badge></TD>
                    <TD>{note.periode}</TD>
                    <TD center><strong style={{ color: Number(note.note) >= 10 ? C.greenDk : "#b91c1c" }}>{note.note}/20</strong></TD>
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
