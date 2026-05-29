import { Badge, Stat, TR, TD } from "../../ui";
import { discipline } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo onglet Discipline : KPIs + derniers incidents.
export function DisciplineView() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Stat label="Absences justifiées" value="48" sub="ce mois-ci" />
        <Stat label="Absences non justifiées" value="12" sub="signalées aux parents" />
        <Stat label="Retards" value="27" sub="moyenne / élève : 0,03" />
        <Stat label="Sanctions" value="4" sub="conseil de discipline" />
      </div>
      <TableCard
        title="Derniers incidents enregistrés"
        subtitle="Les enseignants signalent depuis leur portail, la direction consolide."
        header={["Date", "Élève", "Classe", "Type", "Motif", "Statut"]}
        rows={discipline.map((item, i) => (
          <TR key={i}>
            <TD>{item.date}</TD>
            <TD bold>{item.eleve}</TD>
            <TD>{item.classe}</TD>
            <TD>
              <Badge color={item.type === "Absence" ? "red" : item.type === "Retard" ? "amber" : "purple"}>{item.type}</Badge>
            </TD>
            <TD>{item.motif}</TD>
            <TD>
              <Badge color={item.statut === "Justifiée" ? "green" : item.statut === "Avertissement" ? "amber" : "red"}>{item.statut}</Badge>
            </TD>
          </TR>
        ))}
      />
    </div>
  );
}
