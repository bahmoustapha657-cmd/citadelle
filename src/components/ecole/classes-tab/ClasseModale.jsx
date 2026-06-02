import { C } from "../../../constants";
import { Btn, Champ, Input, Modale } from "../../ui";

// Modale d'ajout / modification de classe (avec classes prédéfinies cliquables).
export function ClasseModale({ form, setForm, chg, modal, setModal, classes, classesPredefinies, saveClasse }) {
  const dispo = (classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c));
  return (
    <Modale titre={modal==="add_c"?"Nouvelle classe":"Modifier"} fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}>
        <Champ label="Nom de la classe">
          <input value={form.nom||""} onChange={chg("nom")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",marginBottom:8}}
            placeholder="Saisir ou cliquer sur une classe prédéfinie"/>
          <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 5px"}}>Classes prédéfinies — cliquez pour sélectionner :</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {dispo.map(c=>(
              <button key={c} onClick={()=>setForm(p=>({...p,nom:c}))}
                style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",
                  background:form.nom===c?C.green:"#e0ebf8",color:form.nom===c?"#fff":C.blue,border:"none"}}>
                {c}
              </button>
            ))}
            {dispo.length===0&&
              <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Toutes les classes prédéfinies sont déjà créées.</span>}
          </div>
        </Champ>
      </div>
        <Input label="Effectif" type="number" value={form.effectif||""} onChange={chg("effectif")}/>
        <Input label="Enseignant Principal" value={form.enseignant||""} onChange={chg("enseignant")}/>
        <Input label="Salle" value={form.salle||""} onChange={chg("salle")}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={saveClasse}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
