import React from "react";
import { Btn, Input, Modale, Selec } from "../../ui";
import { agentsPourBon, sectionDuBon } from "./bon-agents";

export function BonModale({ modal, canCreate, canEdit, form, setForm, setModal, moisModale, moisSalaire, ensCollege = [], ensLycee = [], ensPrimaire = [], personnel = [], ajBon, modBon, enreg }) {
  if (!((modal==="add_b"&&canCreate)||(modal==="edit_b"&&canEdit))) return null;
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const listes = { ensCollege, ensLycee, ensPrimaire, personnel };
  const moisBon = form.mois||moisModale;
  // Un bon repris de l'ancienne base n'a pas de section : on retrouve celle de
  // l'agent dans les fiches actuelles, et l'enregistrement la fixe.
  const secBon = form.section||sectionDuBon(form.nom, listes)||"Secondaire";
  // Agents en fiche pour la section — sans attendre que la paie du mois soit
  // générée : un bon est une avance consentie en cours de mois.
  const agents = agentsPourBon(secBon, listes, form.nom);
  const libelle = secBon==="Personnel" ? "Membre du personnel" : "Enseignant";
  return (
    <Modale titre={modal==="add_b"?"Nouveau bon":"Modifier le bon"} fermer={()=>setModal(null)}>
      <Selec label="Mois" value={moisBon} onChange={chg("mois")}>
        {moisSalaire.map(m=><option key={m}>{m}</option>)}
      </Selec>
      <div style={{height:10}}/>
      <Selec label="Section" value={secBon} onChange={e=>{chg("section")(e);setForm(p=>({...p,nom:""}));}}>
        <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
      </Selec>
      <div style={{height:10}}/>
      <Selec label={libelle} value={form.nom||""} onChange={chg("nom")}>
        <option value="">— Sélectionner —</option>
        {agents.map(n=><option key={n} value={n}>{n}</option>)}
      </Selec>
      {agents.length===0&&<div style={{fontSize:11,color:"#b45309",marginTop:4}}>
        {secBon==="Personnel"
          ? "Aucun membre du personnel actif : ajoutez-le d'abord dans l'onglet Personnel admin."
          : `Aucun enseignant en fiche pour la section ${secBon} : ajoutez-le d'abord dans l'onglet Enseignants.`}
      </div>}
      <div style={{height:10}}/>
      <Input label="Montant du bon (GNF)" type="number" value={form.montant||""} onChange={chg("montant")} placeholder="Ex : 50000"/>
      <div style={{height:10}}/>
      <Input label="Motif" value={form.motif||""} onChange={chg("motif")} placeholder="Ex : Retard, Absence injustifiée…"/>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fce8e8",borderRadius:8,fontSize:12,color:"#9b2020"}}>
        Le bon sera déduit du salaire net lors de l'application (États de salaires → ✔ Appliquer les bons), une fois la paie du mois générée.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>enreg(ajBon,modBon,{montant:Number(form.montant||0),section:secBon,mois:moisBon})}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
