import React from "react";
import { C, fmtN } from "../../../constants";
import { Btn, Input, Modale, Selec } from "../../ui";

export function SalaireModale({ modal, canCreate, canEdit, form, setForm, setModal, moisModale, moisSalaire, calcExecute, calcMontant, calcNet, saveSalaire }) {
  if (!((modal==="add_s"&&canCreate)||(modal==="edit_s"&&canEdit))) return null;
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Modale large titre={modal==="add_s"?"Nouveau salaire":"Modifier le salaire"} fermer={()=>setModal(null)}>
      <div style={{marginBottom:14}}>
        <Selec label="Section" value={form.section||"Secondaire"} onChange={chg("section")}>
          <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
        </Selec>
      </div>
      <Selec label="Mois" value={form.mois||moisModale} onChange={chg("mois")}>
        {moisSalaire.map(m=><option key={m}>{m}</option>)}
      </Selec>
      <div style={{height:12}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}><Input label="Prénoms et Nom" value={form.nom||""} onChange={chg("nom")}/></div>
        {form.section==="Secondaire"?<>
          <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
          <Input label="Niveau" value={form.niveau||""} onChange={chg("niveau")}/>
          <Input label="V.H. Hebdomadaire" type="number" value={form.vhHebdo||""} onChange={e=>{const v=Number(e.target.value);setForm(p=>({...p,vhHebdo:v,vhPrevu:v*4}));}}/>
          <Input label="V.H. Mensuel Prévu" type="number" value={form.vhPrevu||""} onChange={chg("vhPrevu")}/>
          <Input label="5ème Semaine" type="number" value={form.cinqSem||0} onChange={chg("cinqSem")}/>
          <Input label="Non Exécuté" type="number" value={form.nonExecute||0} onChange={chg("nonExecute")}/>
          <Input label="Prime Horaire (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")}/>
          <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>:form.section==="Personnel"?<>
          <Input label="Poste" value={form.poste||""} onChange={chg("poste")} placeholder="Ex : Gardien, Secrétaire…"/>
          <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}>
            <option value="">— Catégorie —</option>
            {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(c=><option key={c}>{c}</option>)}
          </Selec>
          <Input label="Salaire de base (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
          <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>:<>
          <Input label="Classe" value={form.niveau||""} onChange={chg("niveau")}/>
          <Input label="Montant Forfaitaire (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
          <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>}
        <div style={{gridColumn:"1/-1"}}><Input label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
      </div>
      {form.section==="Secondaire"&&<div style={{marginTop:12,padding:"10px 14px",background:"#e0ebf8",borderRadius:8,fontSize:13}}>
        <strong>Aperçu :</strong> Exécuté = {calcExecute(form)} h &nbsp;|&nbsp;
        Montant = {fmtN(calcMontant(form))} GNF &nbsp;|&nbsp;
        Bon = -{fmtN(form.bon||0)} &nbsp;|&nbsp;
        Révision = +{fmtN(form.revision||0)} &nbsp;|&nbsp;
        <strong style={{color:C.greenDk}}>Net = {fmtN(calcNet(form))} GNF</strong>
      </div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>saveSalaire({vhHebdo:Number(form.vhHebdo||0),vhPrevu:Number(form.vhPrevu||0),cinqSem:Number(form.cinqSem||0),nonExecute:Number(form.nonExecute||0),primeHoraire:Number(form.primeHoraire||0),bon:Number(form.bon||0),revision:Number(form.revision||0),montantForfait:Number(form.montantForfait||0),montantBrut:null,primesVariables:false})}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
