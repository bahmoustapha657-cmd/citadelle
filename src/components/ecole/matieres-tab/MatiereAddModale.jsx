import { Btn, Input, Modale } from "../../ui";
import { ClasseChips } from "./ClasseChips";

// Modale de création d'une matière.
export function MatiereAddModale({ form, setForm, chg, classes, ajMat, setModal }) {
  return (
    <Modale titre="Nouvelle matière" fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Input label="Nom de la matière" value={form.nom||""} onChange={chg("nom")}/>
        <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
      </div>
      <ClasseChips classes={classes} form={form} setForm={setForm} label="Classes (laisser vide = toutes les classes)"/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>{ajMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[]});setModal(null);}}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
