import React, { useState, useContext } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { SchoolContext } from "../contexts/SchoolContext";
import { C } from "../constants";
import { Stat } from "./ui";

function AffichageSettings({sec, lbl, inp, setMsgSucces, setErreur}) {
  const {schoolId, schoolInfo, setSchoolInfo} = useContext(SchoolContext);
  const [triEleves, setTriEleves] = useState(schoolInfo.triEleves || "prenom_nom");
  const [saving, setSaving] = useState(false);

  const sauvegarder = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db,"ecoles",schoolId), { triEleves });
      setSchoolInfo(p=>({...p, triEleves}));
      setMsgSucces("Paramètres d'affichage enregistrés !");
      setTimeout(()=>setMsgSucces(""),3000);
    } catch(e) {
      setErreur("Erreur : "+e.message);
    } finally {
      setSaving(false);
    }
  };

  const options = [
    {v:"prenom_nom",    label:"Prénom puis Nom",           ex:"Aminata Bah, Ibrahima Diallo"},
    {v:"nom_prenom",    label:"Nom puis Prénom",            ex:"Bah Aminata, Diallo Ibrahima"},
    {v:"classe_prenom", label:"Classe puis Prénom puis Nom",ex:"6ème A → Aminata Bah, Ibrahima Diallo…"},
    {v:"classe_nom",    label:"Classe puis Nom puis Prénom",ex:"6ème A → Bah Aminata, Diallo Ibrahima…"},
  ];

  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.blueDark}}>📋 Ordre d'affichage des élèves</h3>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#6b7280"}}>Définit l'ordre dans lequel les élèves apparaissent dans toutes les listes (enrôlement, mensualités, bulletins…)</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {options.map(o=>(
          <label key={o.v} onClick={()=>setTriEleves(o.v)}
            style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 14px",borderRadius:10,border:`2px solid ${triEleves===o.v?C.blue:"#e5e7eb"}`,background:triEleves===o.v?"#f0f6ff":"#fff",cursor:"pointer",transition:"all .15s"}}>
            <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${triEleves===o.v?C.blue:"#d1d5db"}`,background:triEleves===o.v?C.blue:"#fff",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {triEleves===o.v&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.blueDark}}>{o.label}</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Ex : {o.ex}</div>
            </div>
          </label>
        ))}
      </div>
      <button onClick={sauvegarder} disabled={saving}
        style={{background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",border:"none",padding:"11px 24px",borderRadius:9,fontSize:13,fontWeight:800,cursor:"pointer",opacity:saving?0.7:1}}>
        {saving?"Enregistrement…":"💾 Enregistrer"}
      </button>
    </div>
  );
}


export { AffichageSettings };
