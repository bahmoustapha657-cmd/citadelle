import React from "react";
import { Btn, Input, Modale, Selec } from "../../ui";

export function BonModale({ modal, canCreate, canEdit, form, setForm, setModal, moisModale, moisSalaire, salaires, ensCollege = [], ensLycee = [], ensPrimaire = [], personnel = [], ajBon, modBon, enreg }) {
  if (!((modal==="add_b"&&canCreate)||(modal==="edit_b"&&canEdit))) return null;
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const moisBon = form.mois||moisModale;
  const secBon = form.section||"Secondaire";
  // Liste des enseignants/personnel ACTUELLEMENT en fiche pour cette
  // section. Sert à filtrer les options du sélecteur : si un prof a
  // été renommé ou supprimé, son ancien nom reste dans les `salaires`
  // déjà saisis — sans cette intersection, il continuerait à apparaître.
  const normNom = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const ensActuelsSet = (() => {
    const list = secBon === "Secondaire"
      ? [...ensCollege, ...ensLycee]
      : secBon === "Primaire"
        ? ensPrimaire
        : /* Personnel */ personnel;
    const out = new Set();
    for (const e of (list || [])) {
      const full = `${e.prenom || ""} ${e.nom || ""}`.trim();
      if (full) out.add(normNom(full));
    }
    return out;
  })();
  // Noms uniques des salaires du mois (dedup par normalisation) +
  // intersection avec les fiches actuelles. Si la base contient des
  // fiches doublons legacy, on n'affiche le prof qu'une fois.
  const noms = new Map(); // nomNormalisé → libellé d'affichage
  for (const s of salaires) {
    if (s.mois !== moisBon || s.section !== secBon) continue;
    const display = (s.nom || "").trim();
    if (!display) continue;
    const norm = normNom(display);
    if (!ensActuelsSet.has(norm)) continue; // prof supprimé/renommé
    if (!noms.has(norm)) noms.set(norm, display);
  }
  const ensDisponibles = [...noms.values()].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
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
      <Selec label="Enseignant" value={form.nom||""} onChange={chg("nom")}>
        <option value="">— Sélectionner un enseignant —</option>
        {ensDisponibles.map(n=><option key={n} value={n}>{n}</option>)}
        {ensDisponibles.length===0&&<option disabled>Aucun enseignant pour ce mois/section</option>}
      </Selec>
      {ensDisponibles.length===0&&<div style={{fontSize:11,color:"#b45309",marginTop:4}}>
        Générez d'abord les salaires pour ce mois avant d'ajouter des bons.
      </div>}
      <div style={{height:10}}/>
      <Input label="Montant du bon (GNF)" type="number" value={form.montant||""} onChange={chg("montant")} placeholder="Ex : 50000"/>
      <div style={{height:10}}/>
      <Input label="Motif" value={form.motif||""} onChange={chg("motif")} placeholder="Ex : Retard, Absence injustifiée…"/>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fce8e8",borderRadius:8,fontSize:12,color:"#9b2020"}}>
        Le bon sera déduit du salaire net de l'enseignant lors de l'application.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>enreg(ajBon,modBon,{montant:Number(form.montant||0)})}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
