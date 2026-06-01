import { C } from "../../constants";
import { imprimerLivret } from "../../reports";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";

// Vue liste des livrets : filtre par classe et tableau des élèves.
export function LivretsListe({ h }) {
  const { livrets, elevesFiltr, classesUniq, filtreClasse, savingL, schoolInfo } = h;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, flex: 1, color: C.blueDark }}>📋 Livrets scolaires ({livrets.length})</strong>
        <select value={filtreClasse} onChange={e => h.setFiltreClasse(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff" }}>
          <option value="all">Toutes les classes</option>
          {classesUniq.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {elevesFiltr.length === 0
        ? <Vide icone="📋" msg="Aucun élève dans cette sélection" />
        : <Card>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="2">
              <THead cols={["Matricule", "Nom & Prénom", "Classe", "Livret", "Années saisies", "Action"]} />
              <tbody>{elevesFiltr.map(e => {
                const lv = livrets.find(l => l.eleveId === e._id);
                return <TR key={e._id}>
                  <TD><span style={{ fontSize: 11, fontFamily: "monospace", background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: C.blue, fontWeight: 700 }}>{e.matricule || "—"}</span></TD>
                  <TD bold>{e.nom} {e.prenom}</TD>
                  <TD><Badge color="blue">{e.classe}</Badge></TD>
                  <TD>{lv
                    ? <span style={{ fontFamily: "monospace", fontSize: 11, color: C.blue }}>{lv.numeroLivret}</span>
                    : <span style={{ fontSize: 11, color: "#9ca3af" }}>Non créé</span>}
                  </TD>
                  <TD center>{lv ? <Badge color={(lv.annees || []).length > 0 ? "vert" : "gray"}>{(lv.annees || []).length} an(s)</Badge> : "—"}</TD>
                  <TD>
                    <Btn sm v={lv ? "ghost" : "blue"} onClick={() => h.ouvrirLivret(e)} disabled={savingL}>
                      {lv ? "📂 Ouvrir" : "📋 Créer"}
                    </Btn>
                    {lv && <Btn sm v="amber" style={{ marginLeft: 4 }} onClick={() => imprimerLivret({ ...lv, photo: e.photo || lv.photo }, schoolInfo)}>🖨️</Btn>}
                  </TD>
                </TR>;
              })}</tbody>
            </table></div>
          </Card>
      }
    </div>
  );
}
