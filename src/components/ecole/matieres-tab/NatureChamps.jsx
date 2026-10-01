import { C } from "../../../constants";
import { NATURES_MATIERE, matieresEnseignees, natureMatiere } from "../../../matiere-nature";
import { Selec } from "../../ui";

// Nature (enseignée et évaluée / enseignée seulement / évaluée seulement) et
// discipline de rattachement d'une matière — partagés par les modales
// d'ajout et de modification. `matiereId` exclut la matière elle-même des
// rattachements possibles ; `avertirNotes` signale qu'une matière évaluée
// passe en « enseignée seulement » (ses notes sortent des bulletins).
export function NatureChamps({ form, setForm, matieres = [], matiereId = null, avertirNotes = false }) {
  const nature = natureMatiere(form);
  const disciplines = matieresEnseignees(matieres).filter((m) => m._id !== matiereId && m.nom !== form.nom);
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
        Nature
      </label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8,marginBottom:12}}>
        {NATURES_MATIERE.map((n) => {
          const actif = nature === n.v;
          return (
            <button key={n.v} type="button" onClick={() => setForm((p) => ({ ...p, nature: n.v }))}
              style={{textAlign:"start",padding:"9px 11px",borderRadius:8,cursor:"pointer",
                border:`2px solid ${actif ? "#8b5cf6" : "#e5e7eb"}`,background:actif ? "#ede9fe" : "#f9fafb"}}>
              <div style={{fontWeight:700,fontSize:12.5,color:actif ? "#6d28d9" : "#374151"}}>{n.icone} {n.label}</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:3,lineHeight:1.35}}>{n.aide}</div>
            </button>
          );
        })}
      </div>
      <Selec label="Rattachée à (facultatif)" value={form.rattachement || ""}
        onChange={(e) => setForm((p) => ({ ...p, rattachement: e.target.value }))}>
        <option value="">— Aucune discipline —</option>
        {disciplines.map((m) => <option key={m._id || m.nom} value={m.nom}>{m.nom}</option>)}
        {form.rattachement && !disciplines.some((m) => m.nom === form.rattachement)
          && <option value={form.rattachement}>{form.rattachement}</option>}
      </Selec>
      <p style={{margin:"6px 0 0",fontSize:11,color:"#6b7280"}}>
        Discipline enseignée dont relève cette matière (ex. Dictée et Questions → Français). Au collège et au lycée, le professeur de cette discipline pourra la noter depuis son portail.
      </p>
      {nature === "rubrique" && avertirNotes && (
        <p style={{margin:"10px 0 0",padding:"8px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:11.5,color:"#92400e"}}>
          ⚠️ Les notes déjà saisies dans cette matière ne compteront plus dans les moyennes ni sur les bulletins, y compris ceux des périodes et années passées.
        </p>
      )}
    </div>
  );
}
