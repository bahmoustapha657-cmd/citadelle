import React, { useState } from "react";
import { C, CLASSES_COLLEGE, CLASSES_LYCEE } from "../constants";
import { Stat } from "./ui";


// ══════════════════════════════════════════════════════════════
//  MODULE SECONDAIRE (Collège + Lycée)
// ══════════════════════════════════════════════════════════════
function Secondaire({Ecole, userRole, annee, readOnly=false, verrouOuvert=false}) {
  const [sousModule, setSousModule] = useState("college");
  return (
    <div>
      {/* Barre de navigation Collège / Lycée */}
      <div style={{display:"flex",gap:0,background:C.blueDark,padding:"0 26px",borderBottom:`3px solid ${C.green}`}}>
        {[{id:"college",label:"🏫 Bureau Collège"},{id:"lycee",label:"🎓 Lycée"}].map(m=>(
          <button key={m.id} onClick={()=>setSousModule(m.id)} style={{
            padding:"12px 22px",border:"none",cursor:"pointer",fontWeight:800,fontSize:13,
            background:sousModule===m.id?C.green:"transparent",
            color:sousModule===m.id?"#fff":"rgba(255,255,255,0.6)",
            borderBottom:sousModule===m.id?`3px solid ${C.green}`:"3px solid transparent",
            marginBottom:-3,transition:"all 0.15s"
          }}>{m.label}</button>
        ))}
      </div>
      {sousModule==="college"&&<Ecole
        titre="Bureau du Collège" couleur={C.blue}
        cleClasses="classesCollege" cleEns="ensCollege"
        cleNotes="notesCollege" cleEleves="elevesCollege"
        avecEns={true} userRole={userRole} annee={annee}
        classesPredefinies={CLASSES_COLLEGE} maxNote={20} readOnly={readOnly} verrouOuvert={verrouOuvert}/>}
      {sousModule==="lycee"&&<Ecole
        titre="Lycée" couleur="#00C48C"
        cleClasses="classesLycee" cleEns="ensLycee"
        cleNotes="notesLycee" cleEleves="elevesLycee"
        avecEns={true} userRole={userRole} annee={annee}
        classesPredefinies={CLASSES_LYCEE} maxNote={20} readOnly={readOnly} verrouOuvert={verrouOuvert}/>}
    </div>
  );
}


export { Secondaire };
