import { C } from "../../../constants";

// Sélecteur de classes en "chips" (vide = toutes les classes).
export function ClasseChips({ classes, form, setForm, label }) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
        {label}
      </label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {classes.map(c=>{
          const sel=(form.classesEdit||[]).includes(c.nom);
          return <button key={c._id} type="button"
            onClick={()=>setForm(p=>({...p,classesEdit:sel?(p.classesEdit||[]).filter(x=>x!==c.nom):[...(p.classesEdit||[]),c.nom]}))}
            style={{padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#8b5cf6":"#e5e7eb"}`,
              background:sel?"#ede9fe":"#f9fafb",color:sel?"#6d28d9":"#6b7280",
              fontWeight:sel?700:400,fontSize:12,cursor:"pointer"}}>
            {c.nom}
          </button>;
        })}
      </div>
      {!(form.classesEdit||[]).length&&<p style={{margin:"8px 0 0",fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Aucune sélection → s'applique à toutes les classes</p>}
    </div>
  );
}
