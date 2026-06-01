import { C } from "../../../constants";
import { JOURS, affNom } from "./edt-utils";

// Vue grille de l'emploi du temps : tableau horaires × jours, cellules cliquables
// pour créer/modifier un créneau, avec détection de conflit enseignant.
export function EdtGrille({ h, emplois, canCreate, canEdit, setForm }) {
  const { TRANCHES, matCouleur, findEns, getCreneau, classeEdtActuelle, setEdtCellule } = h;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: 700, width: "100%", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ background: C.blueDark, color: "#fff", padding: "8px 10px", width: 72, fontSize: 11 }}>Horaire</th>
            {JOURS.map(j => <th key={j} style={{ background: C.blueDark, color: "#fff", padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 700 }}>{j}</th>)}
          </tr>
        </thead>
        <tbody>
          {TRANCHES.slice(0, -1).map((hd, i) => {
            const hf = TRANCHES[i + 1];
            return <tr key={hd}>
              <td style={{ padding: "6px 8px", background: "#f0f4f8", fontWeight: 700, fontSize: 11, color: C.blueDark, textAlign: "center", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                {hd.slice(0, 5)}–{hf.slice(0, 5)}
              </td>
              {JOURS.map(jour => {
                const cr = getCreneau(jour, hd);
                const conflit = cr && emplois.some(x => x._id !== cr._id && x.enseignant && x.enseignant === cr.enseignant && x.jour === jour && x.heureDebut === hd);
                return <td key={jour}
                  onClick={() => {
                    if (!canCreate && !canEdit) return;
                    if (cr) { setForm({ ...cr }); setEdtCellule({ jour, heureDebut: hd, heureFin: hf, existing: cr }); }
                    else { setForm({ classe: classeEdtActuelle, jour, heureDebut: hd, heureFin: hf, matiere: "", enseignant: "", salle: "" }); setEdtCellule({ jour, heureDebut: hd, heureFin: hf, existing: null }); }
                  }}
                  style={{
                    padding: "4px 5px", border: `1px solid ${cr?.type === "revision" ? "#fdba74" : "#e2e8f0"}`,
                    cursor: canCreate || canEdit ? "pointer" : "default",
                    background: cr ? (cr.type === "revision" ? "#fff7ed" : matCouleur[cr.matiere] || "#e0ebf8") : "#fafcff",
                    minWidth: 90, verticalAlign: "top", position: "relative",
                    transition: "filter .15s",
                  }}>
                  {cr ? <>
                    {conflit && <span title="Conflit enseignant" style={{ position: "absolute", top: 2, right: 3, fontSize: 10 }}>⚠️</span>}
                    {cr.type === "revision" && <span style={{ position: "absolute", top: 2, left: 3, background: "#f97316", color: "#fff", fontSize: 8, fontWeight: 900, padding: "1px 4px", borderRadius: 3, lineHeight: 1.4 }}>RÉV</span>}
                    <div style={{ fontWeight: 800, fontSize: 11, color: cr.type === "revision" ? "#9a3412" : "#1e3a5f", lineHeight: 1.3, marginTop: cr.type === "revision" ? 10 : 0 }}>{cr.matiere || "—"}</div>
                    {cr.enseignant && (() => {
                      const e = findEns(cr.enseignant);
                      return <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>
                        <div>{affNom(cr.enseignant)}</div>
                        {e?.telephone && <div style={{ fontSize: 9, color: "#00876a", fontWeight: 600 }}>{e.telephone}</div>}
                      </div>;
                    })()}
                    {cr.salle && <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>📍{cr.salle}</div>}
                  </> : (canCreate && <div style={{ fontSize: 18, color: "#c7d7e9", textAlign: "center", lineHeight: "40px" }}>+</div>)}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>💡 Cliquez sur une cellule pour ajouter ou modifier un créneau</p>
    </div>
  );
}
