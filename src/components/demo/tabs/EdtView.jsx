import { Badge, TR, TD } from "../../ui";
import { edt } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo onglet Emploi du temps : extrait de la semaine.
export function EdtView() {
  return (
    <TableCard
      title="Emploi du temps — extrait de la semaine"
      subtitle="Vue partagée direction / enseignant / parent. La saisie se fait en glisser-déposer côté direction."
      header={["Jour", "Créneau", "Classe", "Matière", "Enseignant"]}
      rows={edt.map((item, i) => (
        <TR key={i}>
          <TD bold>{item.jour}</TD>
          <TD><Badge color="blue">{item.creneau}</Badge></TD>
          <TD>{item.classe}</TD>
          <TD>{item.matiere}</TD>
          <TD>{item.prof}</TD>
        </TR>
      ))}
    />
  );
}
