import React from "react";
import { C } from "../../constants";
import SuperAdminAssistant from "../SuperAdminAssistant";
import CommunicationsAdmin from "../CommunicationsAdmin";

// Onglet "Comms & Assistant" du Panel Super-Admin.
// Sous-onglets : diffusion (CommunicationsAdmin) et assistant IA
// (SuperAdminAssistant). Composant léger qui assemble juste la nav
// secondaire et délègue le contenu aux deux composants externes.
export function OutilsTab({ outilsTab, setOutilsTab, ecoles }) {
  return (
    <div>
      <div style={{display:"inline-flex",gap:4,padding:4,background:"#f0f4f8",borderRadius:10,marginBottom:18}}>
        {[
          {id:"communications",label:"Diffusion aux écoles"},
          {id:"assistant",label:"Assistant IA"},
        ].map(s=>(
          <button key={s.id} onClick={()=>setOutilsTab(s.id)}
            style={{padding:"7px 16px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
              background:outilsTab===s.id?"#fff":"transparent",color:outilsTab===s.id?C.blue:"#6b7280",
              boxShadow:outilsTab===s.id?"0 1px 4px rgba(0,32,80,0.1)":"none"}}>
            {s.label}
          </button>
        ))}
      </div>
      {outilsTab==="communications" && <CommunicationsAdmin ecoles={ecoles} auteur="superadmin" />}
      {outilsTab==="assistant" && <SuperAdminAssistant />}
    </div>
  );
}
