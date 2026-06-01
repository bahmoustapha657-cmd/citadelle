import { C } from "../../../constants";
import { Vide } from "../../ui";
import { couleurNote } from "./notes-helpers";

// Tableau de saisie : élèves en lignes, matières en colonnes, moyenne par
// élève et cellules éditables (ou en lecture seule selon canCreate).
export function NotesGrilleTable({
  elevesGrille, matieresCols, maxNote, canCreate,
  valeurCellule, grilleChanges, setGrilleChanges,
}) {
  if (elevesGrille.length === 0) return <Vide icone="📝" msg="Aucun élève" />;
  if (matieresCols.length === 0) return <Vide icone="📚" msg="Aucune matière définie" />;
  return (
    <div style={{ overflow: "auto", maxHeight: "calc(100vh - 360px)", minHeight: 280, border: "1px solid var(--lc-border)", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 150, background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))", position: "sticky", top: 0, left: 0, zIndex: 4 }}>Élève</th>
            {matieresCols.map(m => (
              <th key={m} style={{ padding: "8px 10px", textAlign: "center", color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", borderLeft: "1px solid rgba(255,255,255,0.1)", background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))", position: "sticky", top: 0, zIndex: 3 }}>
                {m}<div style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>/{maxNote}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elevesGrille.map((e, ri) => {
            const moy = matieresCols.reduce((s, m) => {
              const v = Number(valeurCellule(e, m));
              return s + (isNaN(v) ? 0 : v);
            }, 0) / matieresCols.filter(m => valeurCellule(e, m) !== "").length || 0;
            const rowBg = ri % 2 === 0 ? "#fff" : "#f8fafc";
            return (
              <tr key={e._id} style={{ background: rowBg, borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.blueDark, whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: rowBg, boxShadow: "inset -1px 0 0 var(--lc-border-soft)" }}>
                  {e.nom} {e.prenom}
                  <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>{e.classe}</span>
                  {!isNaN(moy) && moy > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 900, ...couleurNote(moy, maxNote) }}>{moy.toFixed(1)}</span>}
                </td>
                {matieresCols.map(m => {
                  const key = `${e._id}|${m}`;
                  const val = valeurCellule(e, m);
                  const modif = key in grilleChanges;
                  return (
                    <td key={m} style={{ padding: "4px 6px", textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                      {canCreate
                        ? <input
                          type="number" min="0" max={maxNote} step="0.25"
                          value={val}
                          onChange={ev => setGrilleChanges(p => ({ ...p, [key]: ev.target.value }))}
                          style={{
                            width: 54, textAlign: "center", border: `1.5px solid ${modif ? "#f59e0b" : "#e2e8f0"}`,
                            borderRadius: 6, padding: "3px 4px", fontSize: 12, fontWeight: 700,
                            outline: "none", ...couleurNote(val, maxNote),
                            background: modif ? "#fffbeb" : couleurNote(val, maxNote).background || "#fff",
                          }}
                        />
                        : <span style={{ ...couleurNote(val, maxNote), padding: "2px 6px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{val || "—"}</span>
                      }
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
