import { useTranslation } from "react-i18next";
import { C } from "../../../constants";
import { Btn } from "../../ui";
import { getFifthWeekDays } from "../../../salary-utils";

// Barre de navigation interne des états de salaires : sous-onglets, sélecteur
// de mois, prime par défaut, actions de génération/impression et bandeau 5ᵉ semaine.
export function SalairesToolbar({
  sousTabSal, setSousTabSal, moisSel, setMoisSel, moisSalaire, bonsMois,
  canCreate, primeDefaut, setPrimeDefaut,
  autoGenererSalaires, appliquerBons, imprimerSalaires, setForm, setModal, moisModale,
}) {
  const { t } = useTranslation();
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"etats",label:t("accounting.salaryHeader")},{id:"bons",label:`${t("accounting.salaryBonus")}s (${bonsMois.length})`}].map(tab=>(
        <button key={tab.id} onClick={()=>setSousTabSal(tab.id)} style={{
          padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
          background:sousTabSal===tab.id?C.blueDark:"#e0ebf8",
          color:sousTabSal===tab.id?"#fff":C.blueDark,
        }}>{tab.label}</button>
      ))}
      <div style={{flex:1}}/>
      <select value={moisSel} onChange={e=>setMoisSel(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",color:C.blueDark,fontWeight:700}}>
        <option value="__TOUS__">Tous les mois (prévision)</option>
        {moisSalaire.map(m=><option key={m} value={m}>{m}</option>)}
      </select>
      {sousTabSal==="etats"&&<>
        {canCreate&&<label title="Appliquée uniquement aux enseignants sans prime définie sur leur fiche" style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.blueDark,background:"#f0f7ff",border:"1px solid #b0c4d8",borderRadius:7,padding:"4px 10px",cursor:"help"}}>
          Prime/h par défaut
          <input type="number" min="0" value={primeDefaut||""} placeholder="0"
            onChange={e=>setPrimeDefaut(Number(e.target.value))}
            style={{width:80,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:C.blueDark,outline:"none"}}/>
          GNF
        </label>}
        {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires()}>⚡ {t("accounting.generateSalaries")}</Btn>}
        {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires({resync:true})} title="Recalcule V/H et prime horaire des lignes existantes à partir de la fiche enseignant et de l'EDT actuels (bons et révisions préservés)">🔄 {t("common.refresh")}</Btn>}
        {canCreate&&bonsMois.length>0&&<Btn v="amber" onClick={appliquerBons}>✔ {t("accounting.applyBonus")}</Btn>}
        {canCreate&&<Btn onClick={()=>{setForm({section:"Secondaire",mois:moisModale,nonExecute:0,cinqSem:0,bon:0,revision:0});setModal("add_s");}}>+ {t("common.add")}</Btn>}
        <Btn v="vert" onClick={imprimerSalaires}>🖨️ {t("accounting.printSalaries")}</Btn>
      </>}
      {(()=>{const j5=getFifthWeekDays(moisSel);return j5.length>0&&(
        <div style={{width:"100%",marginTop:6,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:8,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:15}}>📅</span>
          <strong style={{color:"#92400e"}}>{moisSel} — 5ème semaine :</strong>
          {j5.map(j=><span key={j} style={{background:"#f59e0b",color:"#fff",fontWeight:700,padding:"2px 9px",borderRadius:10,fontSize:11}}>{j}</span>)}
          <span style={{color:"#92400e",fontSize:11}}>→ Les enseignants qui ont cours ces jours ont des heures supplémentaires. Cliquez sur ⚡ Auto-générer pour les calculer automatiquement.</span>
        </div>
      );})()}
      {sousTabSal==="bons"&&canCreate&&<Btn onClick={()=>{setForm({mois:moisModale,section:"Secondaire"});setModal("add_b");}}>+ Nouveau bon</Btn>}
    </div>
  );
}
