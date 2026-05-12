import React from "react";
import { C, fmt } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function DepensesTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  depenses,
  cD,
  ajD,
  modD,
  supD,
  enreg,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Dépenses ({depenses.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({periode:"T1"});setModal("add_d");}}>+ Nouvelle dépense</Btn>}
      </div>
      {cD?<Chargement/>:depenses.length===0?<Vide icone="💸" msg="Aucune dépense"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Libellé","Catégorie","Période","Montant","Date",canEdit?"Actions":""]}/>
          <tbody>{depenses.map(d=><TR key={d._id}>
            <TD bold>{d.libelle}</TD><TD><Badge color="red">{d.categorie}</Badge></TD>
            <TD>{d.periode}</TD><TD bold>{fmt(d.montant)}</TD><TD>{d.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d2");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supD(d._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_d"&&canCreate||(modal==="edit_d2"&&canEdit))&&<Modale titre={modal==="add_d"?"Nouvelle dépense":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}><option>Salaires</option><option>Matériel</option><option>Infrastructure</option><option>Charges</option><option>Divers</option></Selec>
          <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}><option>T1</option><option>T2</option><option>T3</option></Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn v="danger" onClick={()=>enreg(ajD,modD,{montant:Number(form.montant)})}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
