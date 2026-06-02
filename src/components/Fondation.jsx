import { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, peutModifier } from "../constants";
import { LectureSeule, Tabs } from "./ui";
import { FondationApercu } from "./fondation/FondationApercu";
import { FondationMembres } from "./fondation/FondationMembres";
import { FondationDocs } from "./fondation/FondationDocs";

// ══════════════════════════════════════════════════════════════
//  MODULE FONDATION — orchestrateur (état Firestore + onglets)
// ══════════════════════════════════════════════════════════════
function Fondation({ readOnly, userRole }) {
  const canEdit = peutModifier(userRole);
  const { schoolInfo } = useContext(SchoolContext);
  const { items:membres, chargement:cM, ajouter:ajM, modifier:modM, supprimer:supM } = useFirestore("membres");
  const { items:docs, chargement:cD, ajouter:ajD, modifier:modD, supprimer:supD } = useFirestore("documents");
  const [tab, setTab] = useState("apercu");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const sauvegarder = (aj, mod) => { if (modal.startsWith("add")) aj(form); else mod(form); setModal(null); };

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Fondation</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Gouvernance & administration générale</p>
        </div>
      </div>
      {readOnly && <LectureSeule/>}
      <Tabs items={[{id:"apercu",label:"Aperçu"},{id:"membres",label:`Membres (${membres.length})`},{id:"docs",label:`Documents (${docs.length})`}]} actif={tab} onChange={setTab}/>

      {tab==="apercu"&&<FondationApercu membres={membres} docs={docs} schoolInfo={schoolInfo} cM={cM}/>}

      {tab==="membres"&&<FondationMembres
        membres={membres} cM={cM} readOnly={readOnly} canEdit={canEdit} supM={supM} ajM={ajM} modM={modM}
        form={form} setForm={setForm} chg={chg} modal={modal} setModal={setModal} sauvegarder={sauvegarder}
      />}

      {tab==="docs"&&<FondationDocs
        docs={docs} cD={cD} readOnly={readOnly} canEdit={canEdit} supD={supD} ajD={ajD} modD={modD}
        form={form} setForm={setForm} chg={chg} modal={modal} setModal={setModal} sauvegarder={sauvegarder}
      />}
    </div>
  );
}

export { Fondation };
