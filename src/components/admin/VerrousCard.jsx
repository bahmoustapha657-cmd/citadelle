import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { C } from "../../constants";
import { db } from "../../firebaseDb";
import { isSupabase } from "../../backend";
import { majVerrou } from "../../backend/data-supabase";
import { Card } from "../ui";

export function VerrousCard({ verrous = {}, schoolId }) {
  const [savingVerrou, setSavingVerrou] = useState(null);
  // État local optimiste : sur Supabase (pas d'écoute temps réel du doc
  // école) l'interrupteur resterait figé jusqu'au rechargement sinon.
  const [locaux, setLocaux] = useState({});
  const etatVerrou = (cle) => (cle in locaux ? locaux[cle] : !!verrous[cle]);

  const toggleVerrou = async (cle) => {
    setSavingVerrou(cle);
    try {
      const nvVal = !etatVerrou(cle);
      // Supabase : les verrous vivent dans ecoles.extra.verrous — l'appel
      // Firestore direct levait « Missing or insufficient permissions ».
      if (isSupabase) await majVerrou(schoolId, cle, nvVal);
      else await updateDoc(doc(db,"ecoles",schoolId), { [`verrous.${cle}`]: nvVal });
      setLocaux((p) => ({ ...p, [cle]: nvVal }));
    } finally { setSavingVerrou(null); }
  };

  return (
    <Card style={{marginTop:20,padding:"20px 24px"}}>
      <p style={{margin:"0 0 6px",fontWeight:800,fontSize:14,color:C.blueDark}}>🔒 Autorisation de modification</p>
      <p style={{margin:"0 0 18px",fontSize:12,color:"#6b7280"}}>Réservé à la Direction Générale. Chaque rôle peut toujours <strong>créer</strong> des enregistrements ; une fois sauvegardés, ils sont verrouillés. Activez le verrou pour permettre les corrections par le rôle concerné.</p>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[
          {cle:"comptable", label:"Comptable",   desc:"Finances, salaires, mensualites", icon:"💰", color:"#0e7490"},
          {cle:"primaire",  label:"Primaire",     desc:"Classes, élèves, bulletins, notes", icon:"🌱", color:C.greenDk},
          {cle:"secondaire",label:"Secondaire",   desc:"College, lycee, enseignants, EDT", icon:"🏫", color:C.blue},
        ].map(({cle,label,desc,icon,color})=>{
          const actif = etatVerrou(cle);
          const enCours = savingVerrou === cle;
          return (
            <div key={cle} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",
              borderRadius:10,border:`2px solid ${actif?color:"#e5e7eb"}`,
              background:actif?`${color}0d`:"#f9fafb",transition:"all 0.2s"}}>
              <span style={{fontSize:22}}>{icon}</span>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:C.blueDark}}>{label}</p>
                <p style={{margin:0,fontSize:11,color:"#6b7280"}}>{desc}</p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,fontWeight:700,color:actif?color:"#9ca3af"}}>
                  {actif?"OK Modification activee":"🔒 Lecture seule"}
                </span>
                <button onClick={()=>!enCours&&toggleVerrou(cle)} disabled={enCours}
                  style={{
                    position:"relative",width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",
                    background:actif?color:"#d1d5db",transition:"background 0.2s",padding:0,
                  }}>
                  <span style={{
                    position:"absolute",top:3,left:actif?26:3,width:22,height:22,
                    borderRadius:"50%",background:"#fff",transition:"left 0.2s",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.25)",display:"block",
                  }}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{margin:"14px 0 0",fontSize:11,color:"#9ca3af"}}>
        💡 Les modifications sont effectives immédiatement pour tous les utilisateurs connectés.
      </p>
    </Card>
  );
}
