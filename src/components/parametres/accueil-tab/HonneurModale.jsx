import { Btn, Input, Modale, Selec } from "../../ui";

// Modale d'ajout / édition d'une distinction du tableau d'honneur.
export function HonneurModale({ modalH, setModalH, formHonneur, setFormHonneur, ajHonneur, modHonneur, toast, inp, lbl }) {
  return (
    <Modale titre={modalH==="add"?"Ajouter une distinction":"Modifier"} fermer={()=>setModalH(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Prénom" value={formHonneur.prenom||""} onChange={e=>setFormHonneur(p=>({...p,prenom:e.target.value}))}/>
        <Input label="Nom" value={formHonneur.nom||""} onChange={e=>setFormHonneur(p=>({...p,nom:e.target.value}))}/>
        <Input label="Classe" value={formHonneur.classe||""} onChange={e=>setFormHonneur(p=>({...p,classe:e.target.value}))} placeholder="Ex : 9ème A"/>
        <Input label="Période" value={formHonneur.periode||""} onChange={e=>setFormHonneur(p=>({...p,periode:e.target.value}))} placeholder="Ex : T1 2025-2026"/>
      </div>
      <div style={{marginTop:12}}>
        <Selec label="Distinction" value={formHonneur.distinction||"Major de promotion"} onChange={e=>setFormHonneur(p=>({...p,distinction:e.target.value}))}>
          <option>Major de promotion</option>
          <option>Premier de classe</option>
          <option>Deuxième de classe</option>
          <option>Troisième de classe</option>
          <option>Excellence académique</option>
          <option>Mention Très Bien</option>
          <option>Mention Bien</option>
          <option>Prix du mérite</option>
          <option>Meilleur(e) en Mathématiques</option>
          <option>Meilleur(e) en Français</option>
          <option>Meilleur(e) en Sciences</option>
        </Selec>
      </div>
      <div style={{marginTop:12}}>
        <label style={{...lbl,marginTop:0}}>Observation (optionnel)</label>
        <input style={inp} value={formHonneur.observation||""} onChange={e=>setFormHonneur(p=>({...p,observation:e.target.value}))} placeholder="Ex : Moyenne 19.5/20"/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModalH(null)}>Annuler</Btn>
        <Btn onClick={()=>{
          if(!formHonneur.nom?.trim()||!formHonneur.prenom?.trim()){toast("Nom et prénom requis.","warning");return;}
          if(modalH==="add") ajHonneur(formHonneur); else modHonneur(formHonneur);
          setModalH(null);
        }}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
