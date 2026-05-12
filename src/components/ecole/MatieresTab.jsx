import React from "react";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, TD, THead, TR, Vide } from "../ui";

export function MatieresTab({
  matieres,
  cMat,
  ajMat,
  modMat,
  supMat,
  classes,
  matieresPredefinies,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Matières et coefficients ({matieres.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({coefficient:1});setModal("add_mat");}}>+ Ajouter</Btn>}
      </div>
      {canCreate&&matieres.length===0&&matieresPredefinies.length>0&&<div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:16}}>💡</span>
        <span style={{fontSize:13,color:"#166534",flex:1}}>Des matières prédéfinies sont disponibles pour ce niveau.</span>
        <Btn v="success" onClick={()=>matieresPredefinies.forEach(m=>ajMat(m))}>✅ Initialiser les matières</Btn>
      </div>}
      {/* Légende */}
      <div style={{background:"#f0f7ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
        💡 Si une matière n'est assignée à <strong>aucune classe</strong>, elle apparaît dans <strong>toutes les classes</strong>. Sinon, elle n'apparaît que dans les classes sélectionnées.
      </div>
      {cMat?<Chargement/>:matieres.length===0?<Vide icone="📚" msg="Ajoutez les matières pour calculer les bulletins"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Matière","Coefficient","Classes concernées",canEdit?"Actions":""]}/>
          <tbody>{matieres.map(m=><TR key={m._id}>
            <TD bold>{m.nom}</TD>
            <TD><Badge color="blue">Coef. {m.coefficient}</Badge></TD>
            <TD>
              {!m.classes||!m.classes.length
                ? <span style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>Toutes les classes</span>
                : <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {m.classes.map(c=><span key={c} style={{background:"#ede9fe",color:"#6d28d9",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700}}>{c}</span>)}
                  </div>}
            </TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...m,classesEdit:[...(m.classes||[])]});setModal("edit_mat_"+m._id);}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supMat(m._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}

      {/* Modal ajout matière */}
      {modal==="add_mat"&&canCreate&&<Modale titre="Nouvelle matière" fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <Input label="Nom de la matière" value={form.nom||""} onChange={chg("nom")}/>
          <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
            Classes (laisser vide = toutes les classes)
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
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>{ajMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[]});setModal(null);}}>Enregistrer</Btn>
        </div>
      </Modale>}

      {/* Modal modification matière (classes assignées) */}
      {modal&&modal.startsWith("edit_mat_")&&canEdit&&(()=>{
        const matId=modal.replace("edit_mat_","");
        const mat=matieres.find(m=>m._id===matId);
        if(!mat)return null;
        return <Modale titre={`Modifier — ${mat.nom}`} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
              Classes concernées (laisser vide = toutes les classes)
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
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              modMat ? modMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[],_id:matId}) : null;
              setModal(null);
            }}>💾 Enregistrer</Btn>
          </div>
        </Modale>;
      })()}
    </div>
  );
}
