import { useMemo, useState } from "react";
import { C } from "../../../constants";
import { Card } from "../../ui";

// Couleur selon le taux de saisie.
const couleur = (p) => (p >= 90 ? C.greenDk : p >= 50 ? "#b45309" : "#b91c1c");
const fond = (p) => (p >= 90 ? "#e7f6ec" : p >= 50 ? "#fef3c7" : "#fee2e2");

// Aperçu du taux de saisie des notes par classe (et total du cycle), pour la
// période sélectionnée. Un « couple » élève×matière est considéré saisi dès
// qu'il porte au moins une note sur la période. Réservé au personnel (staff).
export function NotesApercu({ eleves, notes, matieresForClasse, periodes, cycleLabel }) {
  const [ouvert, setOuvert] = useState(false);
  const [periode, setPeriode] = useState(periodes[0] || "");

  const { lignes, total } = useMemo(() => {
    const notesP = notes.filter((n) => n.periode === periode);
    const saisis = new Set(notesP.map((n) => `${n.eleveId}|${n.matiere}`));
    const classes = [...new Set(eleves.map((e) => e.classe).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));

    let totFilled = 0, totDenom = 0;
    const lignes = classes.map((cl) => {
      const elevesC = eleves.filter((e) => e.classe === cl);
      const mats = matieresForClasse(cl) || [];
      const denom = elevesC.length * mats.length;
      let filled = 0;
      for (const e of elevesC) for (const m of mats) if (saisis.has(`${e._id}|${m.nom}`)) filled++;
      totFilled += filled; totDenom += denom;
      return { classe: cl, eleves: elevesC.length, matieres: mats.length, filled, denom, taux: denom ? Math.round((filled / denom) * 100) : 0 };
    });
    return { lignes, total: { filled: totFilled, denom: totDenom, taux: totDenom ? Math.round((totFilled / totDenom) * 100) : 0 } };
  }, [eleves, notes, matieresForClasse, periode]);

  const Barre = ({ taux }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${taux}%`, height: "100%", background: couleur(taux) }} />
      </div>
      <span style={{ fontWeight: 800, fontSize: 12, color: couleur(taux), minWidth: 38, textAlign: "right" }}>{taux}%</span>
    </div>
  );

  return (
    <Card style={{ marginBottom: 14, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOuvert((o) => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: C.blueDark, display: "flex", alignItems: "center", gap: 6 }}>
          {ouvert ? "▾" : "▸"} 📊 Aperçu de saisie des notes
        </button>
        <span style={{ ...pill(total.taux), marginLeft: "auto" }}>
          {cycleLabel ? `${cycleLabel} — ` : ""}Total {total.taux}% ({total.filled}/{total.denom})
        </span>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "5px 9px", fontSize: 12, background: "#fff" }}>
          {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {ouvert && (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "#6b7280" }}>
                <th style={th}>Classe</th>
                <th style={th}>Élèves</th>
                <th style={th}>Matières</th>
                <th style={th}>Saisi</th>
                <th style={{ ...th, minWidth: 150 }}>Taux</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: "#9ca3af", textAlign: "center" }}>Aucune classe.</td></tr>}
              {lignes.map((l) => (
                <tr key={l.classe} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ ...td, fontWeight: 700, color: C.blueDark }}>{l.classe}</td>
                  <td style={td}>{l.eleves}</td>
                  <td style={td}>{l.matieres}</td>
                  <td style={td}>{l.filled}/{l.denom}</td>
                  <td style={td}><Barre taux={l.taux} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
            Un couple élève × matière est compté « saisi » dès qu'il porte au moins une note sur la période.
          </div>
        </div>
      )}
    </Card>
  );

  function pill(taux) {
    return { fontSize: 12, fontWeight: 800, color: couleur(taux), background: fond(taux), padding: "4px 10px", borderRadius: 999 };
  }
}

const th = { padding: "6px 10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 };
const td = { padding: "7px 10px" };
