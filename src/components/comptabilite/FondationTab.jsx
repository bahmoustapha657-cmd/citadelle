import React from "react";
import { C, fmt } from "../../constants";
import { Btn, Card, Chargement, Input, Modale, TD, THead, TR, Vide } from "../ui";

export function FondationTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  versements,
  cV,
  ajV,
  modV,
  supV,
  enreg,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Versements à la Fondation ({versements.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_v");}}>+ Nouveau versement</Btn>}
      </div>
      {cV?<Chargement/>:versements.length===0?<Vide icone="🏛️" msg="Aucun versement"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Libellé","Description","Montant","Date",canEdit?"Actions":""]}/>
          <tbody>{versements.map(v=><TR key={v._id}>
            <TD bold>{v.libelle}</TD><TD>{v.description}</TD>
            <TD><span style={{color:C.blue,fontWeight:700}}>{fmt(v.montant)}</span></TD><TD>{v.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...v});setModal("edit_v");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supV(v._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_v"&&canCreate||(modal==="edit_v"&&canEdit))&&<Modale titre={modal==="add_v"?"Nouveau versement":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
          <div style={{gridColumn:"1/-1"}}><Input label="Description" value={form.description||""} onChange={chg("description")}/></div>
          <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn v="vert" onClick={()=>enreg(ajV,modV,{montant:Number(form.montant)})}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
