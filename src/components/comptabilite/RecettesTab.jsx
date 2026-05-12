import React from "react";
import { C, fmt } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function RecettesTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  recettes,
  cR,
  ajR,
  modR,
  supR,
  enreg,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Recettes ({recettes.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({periode:"T1"});setModal("add_r");}}>+ Nouvelle recette</Btn>}
      </div>
      {cR?<Chargement/>:recettes.length===0?<Vide icone="💰" msg="Aucune recette"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Libellé","Catégorie","Période","Montant","Date",canEdit?"Actions":""]}/>
          <tbody>{recettes.map(r=><TR key={r._id}>
            <TD bold>{r.libelle}</TD><TD><Badge color="vert">{r.categorie}</Badge></TD>
            <TD>{r.periode}</TD><TD bold>{fmt(r.montant)}</TD><TD>{r.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...r});setModal("edit_r");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supR(r._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_r"&&canCreate||(modal==="edit_r"&&canEdit))&&<Modale titre={modal==="add_r"?"Nouvelle recette":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}><option>Scolarité</option><option>Inscription</option><option>Examens</option><option>Activités</option><option>Don</option></Selec>
          <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}><option>T1</option><option>T2</option><option>T3</option></Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn v="success" onClick={()=>enreg(ajR,modR,{montant:Number(form.montant)})}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
