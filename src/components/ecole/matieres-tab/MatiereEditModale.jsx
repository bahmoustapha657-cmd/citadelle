import { Btn, Input, Modale } from "../../ui";
import { ClasseChips } from "./ClasseChips";

// Modale de modification d'une matière (résolue depuis l'id encodé dans modal).
export function MatiereEditModale({ modal, matieres, form, setForm, chg, classes, modMat, setModal }) {
  const matId = modal.replace("edit_mat_", "");
  const mat = matieres.find(m=>m._id===matId);
  if (!mat) return null;
  return (
    <Modale titre={`Modifier — ${mat.nom}`} fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
        <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
      </div>
      <ClasseChips classes={classes} form={form} setForm={setForm} label="Classes concernées (laisser vide = toutes les classes)"/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>{
          modMat ? modMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[],_id:matId}) : null;
          setModal(null);
        }}>💾 Enregistrer</Btn>
      </div>
    </Modale>
  );
}
