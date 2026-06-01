import { Btn, Card, THead, TR, TD, Vide } from "../../ui";
import { JOURS } from "./edt-utils";

// Vue liste de l'emploi du temps : créneaux de la classe groupés par jour,
// avec actions modifier/supprimer si l'utilisateur a les droits d'édition.
export function EdtListe({ h, canEdit, setForm, supEmp }) {
  const { emploisClasse, matCouleur, setEdtCellule } = h;
  if (emploisClasse.length === 0) return <Vide icone="📅" msg="Aucun créneau pour cette classe" />;

  const lignes = [...emploisClasse].sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour) || (a.heureDebut || "").localeCompare(b.heureDebut || ""));
  const rows = [];
  let dernierJour = null;
  lignes.forEach(e => {
    const jourChange = e.jour !== dernierJour;
    dernierJour = e.jour;
    rows.push(<TR key={e._id}>
      {jourChange
        ? <TD bold style={{ background: "#f0f4f8", verticalAlign: "top", whiteSpace: "nowrap", borderRight: "2px solid #e2e8f0" }}>{e.jour}</TD>
        : <td style={{ background: "#f8fafc", borderRight: "2px solid #e2e8f0", borderBottom: "1px solid #f1f5f9" }}></td>}
      <TD style={{ whiteSpace: "nowrap" }}>{e.heureDebut} – {e.heureFin}</TD>
      <TD>
        <span style={{ background: e.type === "revision" ? "#fff7ed" : matCouleur[e.matiere] || "#e0ebf8",
          border: e.type === "revision" ? "1px solid #fdba74" : "none",
          padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          color: e.type === "revision" ? "#9a3412" : "inherit" }}>
          {e.matiere || "—"}
        </span>
      </TD>
      <TD>
        {e.type === "revision"
          ? <span style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
              📝 Révision
            </span>
          : <span style={{ color: "#9ca3af", fontSize: 11 }}>Cours</span>}
      </TD>
      <TD>{e.enseignant || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>—</span>}</TD>
      <TD>{e.salle || "—"}</TD>
      {canEdit && <TD><div style={{ display: "flex", gap: 6 }}>
        <Btn sm v="ghost" onClick={() => { setForm({ ...e }); setEdtCellule({ jour: e.jour, heureDebut: e.heureDebut, heureFin: e.heureFin, existing: e }); }}>Modifier</Btn>
        <Btn sm v="danger" onClick={() => { if (confirm("Supprimer ?")) supEmp(e._id); }}>Suppr.</Btn>
      </div></TD>}
    </TR>);
  });
  return <Card style={{ padding: 0, overflow: "hidden" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <THead cols={["Jour", "Heure", "Matière", "Type", "Enseignant", "Salle", canEdit ? "" : ""]} />
      <tbody>{rows}</tbody>
    </table>
  </Card>;
}
