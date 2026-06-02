import { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, today } from "../constants";
import { Btn } from "./ui";
import { TYPES_EV, getEvParMois, getProchains } from "./calendrier/calendrier-data";
import { CalendrierProchains } from "./calendrier/CalendrierProchains";
import { CalendrierGrille } from "./calendrier/CalendrierGrille";
import { CalendrierModale } from "./calendrier/CalendrierModale";

// ══════════════════════════════════════════════════════════════
//  CALENDRIER SCOLAIRE
// ══════════════════════════════════════════════════════════════
function Calendrier({annee}) {
  const { t } = useTranslation();
  const {toast,schoolInfo}=useContext(SchoolContext);
  const {items:evenements,ajouter:ajEv,supprimer:supEv}=useFirestore("evenements");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const evParMois=getEvParMois(evenements);
  const prochains=getProchains(evenements);

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div style={{flex:1}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>{t("nav.calendar")}</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:700}}>{annee}</p>
        </div>
        <Btn onClick={()=>{setForm({type:"evenement",date:today()});setModal("add_ev");}}>+ {t("common.add")}</Btn>
      </div>

      {/* Légende */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        {TYPES_EV.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:t.color,flexShrink:0}}/>
            <span style={{color:"#6b7280"}}>{t.label}</span>
          </div>
        ))}
      </div>

      <CalendrierProchains prochains={prochains}/>

      <CalendrierGrille evenements={evenements} evParMois={evParMois} supEv={supEv}/>

      {modal==="add_ev"&&<CalendrierModale form={form} chg={chg} ajEv={ajEv} setModal={setModal} toast={toast}/>}
    </div>
  );
}

export { Calendrier };
