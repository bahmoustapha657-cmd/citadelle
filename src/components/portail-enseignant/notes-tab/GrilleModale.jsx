import { C } from "../../../constants";
import { Btn, Modale, Selec, Vide } from "../../ui";

// Modale de saisie en grille : une note par élève de la classe sélectionnée,
// avec préremplissage, compteur et validation (0–20) en direct.
export function GrilleModale({
  matiere, mesClasses, noteForms, periodes,
  gridForm, setGridForm, majGrid, portalData,
  gridProgress, enregistrement, setModalNote, enregistrerGrille,
}) {
  return (
    <Modale xlarge titre={`Saisie en grille — ${matiere || "Matière"}`} fermer={() => setModalNote(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Selec label="Classe" value={gridForm.classe} onChange={(e) => majGrid({ classe: e.target.value })}>
          {mesClasses.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
        </Selec>
        <Selec label="Type d'évaluation" value={gridForm.type} onChange={(e) => majGrid({ type: e.target.value })}>
          {noteForms.map((item) => <option key={item.id} value={item.value}>{item.label}</option>)}
        </Selec>
        <Selec label="Période" value={gridForm.periode} onChange={(e) => majGrid({ periode: e.target.value })}>
          {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
        </Selec>
      </div>

      {(() => {
        const elevesClasse = (portalData.eleves || []).filter((e) => e.classe === gridForm.classe);
        if (elevesClasse.length === 0) return <Vide icone="Élèves" msg="Aucun élève dans cette classe." />;
        const remplies = Object.values(gridForm.notes).filter((v) => v !== "" && v != null).length;
        return (
          <>
            <div style={{ padding: "8px 12px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af", marginBottom: 10 }}>
              <strong>{remplies}</strong> note(s) saisie(s) sur <strong>{elevesClasse.length}</strong> élève(s). Les notes existantes sont préremplies — modifier/effacer met à jour ou laisse en l'état.
            </div>
            <div style={{ maxHeight: "55vh", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table className="lc-sticky-table" data-fix-left="1">
                <thead style={{ background: "#0A1628", color: "#fff" }}>
                  <tr>
                    <th style={{ padding: "8px 10px", fontSize: 11, textAlign: "start", width: 50 }}>#</th>
                    <th style={{ padding: "8px 10px", fontSize: 11, textAlign: "start" }}>Élève</th>
                    <th style={{ padding: "8px 10px", fontSize: 11, textAlign: "center", width: 110 }}>Note /20</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesClasse.map((e, i) => {
                    const val = gridForm.notes[e._id] ?? "";
                    const num = val === "" ? null : Number(val);
                    const invalid = val !== "" && (Number.isNaN(num) || num < 0 || num > 20);
                    return (
                      <tr key={e._id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "6px 10px", fontSize: 11, color: "#94a3b8" }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", fontSize: 13 }}>
                          <strong>{e.nom} {e.prenom}</strong>
                          {e.matricule && <span style={{ marginInlineStart: 6, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{e.matricule}</span>}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.25}
                            value={val}
                            onChange={(ev) => setGridForm((g) => ({ ...g, notes: { ...g.notes, [e._id]: ev.target.value } }))}
                            style={{
                              width: 80,
                              padding: "6px 8px",
                              border: `1.5px solid ${invalid ? "#ef4444" : (val !== "" ? C.green : "#e2e8f0")}`,
                              borderRadius: 6,
                              fontSize: 13,
                              textAlign: "center",
                              background: invalid ? "#fef2f2" : "#fff",
                              outline: "none",
                            }}
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {gridProgress.total > 0 && enregistrement && `Enregistrement ${gridProgress.done}/${gridProgress.total}…`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={() => setModalNote(null)} disabled={enregistrement}>Fermer</Btn>
          <Btn v="vert" onClick={enregistrerGrille} disabled={enregistrement}>
            {enregistrement ? "Enregistrement…" : "💾 Enregistrer la grille"}
          </Btn>
        </div>
      </div>
    </Modale>
  );
}
