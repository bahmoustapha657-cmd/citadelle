import React from "react";
import { C } from "../../constants";
import { Badge, Btn, Card, Champ, Chargement, Input, Modale, TD, THead, TR, Vide } from "../ui";
import { imprimerListeClasse } from "../../reports";

export function ClassesTab({
  classes,
  eleves,
  ens,
  cC,
  ajC,
  modC,
  supC,
  schoolInfo,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  classesPredefinies,
  effectifReel,
  saveClasse,
  toast,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Classes ({classes.length})</strong>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {canCreate&&<Btn v="ghost" onClick={async()=>{
            const classesEleves=[...new Set(eleves.map(e=>e.classe).filter(Boolean))];
            const titulairesParClasse={};
            ens.forEach(e=>{
              if(e.classeTitle){
                titulairesParClasse[e.classeTitle]=`${e.prenom||""} ${e.nom||""}`.trim();
              }
            });
            const classesEns=Object.keys(titulairesParClasse);
            const toutesClasses=[...new Set([...classesEleves,...classesEns])];
            let nbCrees=0, nbMaj=0;
            for(const nom of toutesClasses){
              const existante=classes.find(c=>c.nom===nom);
              const titulaire=titulairesParClasse[nom]||"";
              if(!existante){
                await ajC({nom, effectif:0, ...(titulaire?{enseignant:titulaire}:{})});
                nbCrees++;
              } else if(titulaire && !existante.enseignant){
                await modC({...existante, enseignant:titulaire});
                nbMaj++;
              }
            }
            toast(`Synchronisation : ${nbCrees} classe(s) créée(s), ${nbMaj} mise(s) à jour.`, "success");
          }}>🔄 Synchroniser depuis élèves & enseignants</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_c");}}>+ Nouvelle classe</Btn>}
        </div>
      </div>
      {cC?<Chargement/>:classes.length===0?<Vide icone="🏫" msg="Aucune classe"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Classe","Effectif","Enseignant Principal","Salle","Imprimer liste",canEdit?"Actions":""]}/>
          <tbody>{classes.map(c=><TR key={c._id}>
            <TD bold>{c.nom}</TD><TD><Badge color="blue">{effectifReel(c.nom)} élèves</Badge></TD>
            <TD>{c.enseignant}</TD><TD>{c.salle}</TD>
            <TD><Btn sm v="ghost" onClick={()=>imprimerListeClasse(c.nom,eleves,schoolInfo)}>🖨️ Imprimer</Btn></TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...c});setModal("edit_c");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supC(c._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_c"&&canCreate||(modal==="edit_c"&&canEdit))&&<Modale titre={modal==="add_c"?"Nouvelle classe":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}>
          <Champ label="Nom de la classe">
            <input value={form.nom||""} onChange={chg("nom")}
              style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",marginBottom:8}}
              placeholder="Saisir ou cliquer sur une classe prédéfinie"/>
            <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 5px"}}>Classes prédéfinies — cliquez pour sélectionner :</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).map(c=>(
                <button key={c} onClick={()=>setForm(p=>({...p,nom:c}))}
                  style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",
                    background:form.nom===c?C.green:"#e0ebf8",color:form.nom===c?"#fff":C.blue,border:"none"}}>
                  {c}
                </button>
              ))}
              {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).length===0&&
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
      </Modale>}
    </div>
  );
}
