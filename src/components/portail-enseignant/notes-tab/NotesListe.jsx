import { C } from "../../../constants";
import { getEvaluationLabel } from "../../../evaluation-forms";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../../ui";

// En-tête (sélection période + actions) et tableau des notes de la période.
export function NotesListe({
  c1, matiere, schoolInfo, utilisateur,
  periodeN, setPeriodeN, periodes, mesClasses,
  notesPeriode, enregistrement,
  ouvrirGrille, ouvrirCreationNote, ouvrirEditionNote, supprimerNote,
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1, flex: 1 }}>Saisie des notes - {matiere || "Matiere"}</h2>
        <select value={periodeN} onChange={(event) => setPeriodeN(event.target.value)} style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff" }}>
          {periodes.map((p) => <option key={p}>{p}</option>)}
        </select>
        {mesClasses.length > 0 && <Btn v="vert" onClick={ouvrirGrille}>📊 Saisie en grille</Btn>}
        <Btn onClick={ouvrirCreationNote}>Nouvelle note</Btn>
      </div>

      {notesPeriode.length === 0 ? (
        <Vide icone="Notes" msg={`Aucune note pour ${periodeN}`} />
      ) : (
        <Card>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Eleve", "Type", "Note /20", "Actions"]} />
            <tbody>
              {notesPeriode.map((note) => (
                <TR key={note._id}>
                  <TD bold>{note.eleveNom}</TD>
                  <TD><Badge color="blue">{getEvaluationLabel(note.type, schoolInfo, { section: utilisateur.section || "secondaire" })}</Badge></TD>
                  <TD center><strong style={{ fontSize: 14, color: Number(note.note) >= 10 ? C.greenDk : "#b91c1c" }}>{note.note}</strong></TD>
                  <TD center>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      <Btn sm v="ghost" onClick={() => ouvrirEditionNote(note)}>Modifier</Btn>
                      <Btn sm v="danger" onClick={() => supprimerNote(note._id)} disabled={enregistrement}>Supprimer</Btn>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}
