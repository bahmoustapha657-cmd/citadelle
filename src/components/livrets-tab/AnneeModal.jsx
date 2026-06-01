import { C } from "../../constants";
import { Btn, Input, Modale, Selec, TD, THead, TR } from "../ui";

// Modal de saisie/modification d'une année scolaire dans un livret.
export function AnneeModal({ formAnnee, setFormAnnee, setModal, periodes, maxNote, savingL, sauvegarderAnnee, chgAnnee, chgAbs }) {
  return (
    <Modale large titre={formAnnee._idx != null ? "Modifier l'année" : "Nouvelle année scolaire"} fermer={() => setModal(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Input label="Année scolaire" value={formAnnee.anneeScolaire || ""} onChange={chgAnnee("anneeScolaire")} placeholder="2024-2025" />
        <Input label="Classe" value={formAnnee.classe || ""} onChange={chgAnnee("classe")} />
        <Input label="Enseignant(e) principal(e)" value={formAnnee.enseignantPrincipal || ""} onChange={chgAnnee("enseignantPrincipal")} />
        <Input label="Rang" type="number" value={formAnnee.rang || ""} onChange={chgAnnee("rang")} />
        <Input label="Effectif classe" type="number" value={formAnnee.effectifClasse || ""} onChange={chgAnnee("effectifClasse")} />
        <Selec label="Décision du conseil" value={formAnnee.decision || "Admis"} onChange={chgAnnee("decision")}>
          <option>Admis</option>
          <option>Admis avec félicitations</option>
          <option>Redoublant</option>
          <option>Exclu</option>
        </Selec>
        <div style={{ gridColumn: "1/3" }}>
          <Input label="Absences justifiées" type="number" value={formAnnee.absences?.justifiees || 0} onChange={chgAbs("justifiees")} />
        </div>
        <Input label="Absences non justifiées" type="number" value={formAnnee.absences?.nonJustifiees || 0} onChange={chgAbs("nonJustifiees")} />
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.blueDark, display: "block", marginBottom: 4 }}>Appréciation générale</label>
          <textarea value={formAnnee.appreciation || ""} onChange={chgAnnee("appreciation")} rows={3}
            style={{ width: "100%", border: "1px solid #b0c4d8", borderRadius: 8, padding: "8px 12px", fontSize: 12, resize: "vertical" }} />
        </div>
      </div>
      {(formAnnee.notes || []).length > 0 && <>
        <p style={{ fontWeight: 700, fontSize: 12, color: C.blueDark, margin: "0 0 8px" }}>Notes par matière (pré-remplies depuis les bulletins)</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 14 }}>
            <THead cols={["Matière", "Coef", ...periodes, "Annuelle"]} />
            <tbody>{(formAnnee.notes || []).map((n, i) => (
              <TR key={i}>
                <TD bold>{n.matiere}</TD>
                <TD center><input type="number" value={n.coef || 1}
                  onChange={e => { const ns = [...formAnnee.notes]; ns[i] = { ...ns[i], coef: Number(e.target.value) }; setFormAnnee(p => ({ ...p, notes: ns })); }}
                  style={{ width: 40, textAlign: "center", border: "1px solid #b0c4d8", borderRadius: 4, padding: "2px 4px" }} /></TD>
                {periodes.map(p => (
                  <td key={p} style={{ padding: "2px 6px", textAlign: "center" }}>
                    <input type="number" value={n[p] != null ? n[p] : ""}
                      onChange={e => { const ns = [...formAnnee.notes]; ns[i] = { ...ns[i], [p]: e.target.value === "" ? null : Number(e.target.value) }; setFormAnnee(p => ({ ...p, notes: ns })); }}
                      style={{ width: 50, textAlign: "center", border: "1px solid #b0c4d8", borderRadius: 4, padding: "2px 4px" }} />
                  </td>
                ))}
                <td style={{ padding: "2px 8px", textAlign: "center", fontWeight: 700, color: n.annuelle >= maxNote / 2 ? "#15803d" : "#b91c1c" }}>
                  {n.annuelle != null ? Number(n.annuelle).toFixed(2) : "—"}
                </td>
              </TR>
            ))}</tbody>
          </table>
        </div>
      </>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn v="ghost" onClick={() => setModal(null)}>Annuler</Btn>
        <Btn v="success" onClick={sauvegarderAnnee} disabled={savingL}>{savingL ? "Enregistrement…" : "💾 Enregistrer"}</Btn>
      </div>
    </Modale>
  );
}
