import { Trans, useTranslation } from "react-i18next";
import { C, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { useImportEnrol } from "./use-import-enrol";
import { ImportEnrolPreview } from "./ImportEnrolPreview";

export function ImportEnrolModale({
  setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
  ajoutParNiveau, ensureClasse, elevesEnrol,
}) {
  const { t } = useTranslation();
  const {
    importEnrolPreview, importEnrolEnCours, classeDefautImport, choisirClasseDefaut,
    ordreNomImport, setOrdreNomImport, fermer, handleFile, telechargerTemplate, lancerImport,
  } = useImportEnrol({
    setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
    ajoutParNiveau, ensureClasse, elevesEnrol, t,
  });

  return (<Modale titre={`📋 ${t("accounting.import.title")}`} fermer={fermer} large>
    <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,fontSize:12,color:"#0369a1"}}>
      <Trans i18nKey="accounting.import.autoDetect" components={{ b: <strong /> }} /><br/>
      <Trans i18nKey="accounting.import.required" components={{ b: <strong /> }} />
    </div>
    <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px dashed ${C.blue}`,background:"#f0f6ff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
        📂 {t("accounting.import.chooseFile")}
        <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>
      </label>
      <Btn v="ghost" onClick={telechargerTemplate}>⬇️ {t("accounting.import.templateExcel")}</Btn>
    </div>

    <div style={{marginBottom:8,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde047",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>📚 {t("accounting.import.classToAssign")}</span>
      <span style={{fontSize:12,color:"#713f12",flex:1}}>{t("accounting.import.classHint")}</span>
      <select value={classeDefautImport} onChange={e=>choisirClasseDefaut(e.target.value)}
        style={{border:"1.5px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",fontWeight:700,color:"#0A1628"}}>
        <option value="">{t("accounting.import.fileClass")}</option>
        {getClassesForSection(niveauEnrol, getSystemeScolaire(schoolInfo)).map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>

    <div style={{marginBottom:12,padding:"10px 14px",background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#5b21b6"}}>🔤 {t("accounting.import.nameOrder")}</span>
      <span style={{fontSize:12,color:"#6d28d9",flex:1}}>{t("accounting.import.nameOrderHint")}</span>
      {[
        {val:"nom_prenom", label:t("accounting.import.lastFirst"), ex:"DIALLO Mamadou"},
        {val:"prenom_nom", label:t("accounting.import.firstLast"), ex:"Mamadou DIALLO"},
        {val:"auto",       label:t("accounting.import.auto"), ex:t("accounting.import.autoExample")},
      ].map(({val,label,ex})=>(
        <label key={val} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,fontWeight:ordreNomImport===val?700:400}}>
          <input type="radio" name="ordreNom" value={val} checked={ordreNomImport===val} onChange={()=>setOrdreNomImport(val)}/>
          <span>{label}</span>
          <span style={{color:"#7c3aed",fontSize:11,fontStyle:"italic"}}>({ex})</span>
        </label>
      ))}
    </div>

    {importEnrolPreview&&<ImportEnrolPreview importEnrolPreview={importEnrolPreview}/>}

    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
      <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
      {importEnrolPreview?.valides.length>0&&<Btn v="vert" disabled={importEnrolEnCours} onClick={lancerImport}>
        {importEnrolEnCours?`⏳ ${t("accounting.import.importing")}`:`⬆️ ${t("accounting.import.importBtn", { count: importEnrolPreview.valides.length })}`}
      </Btn>}
    </div>
  </Modale>);
}
