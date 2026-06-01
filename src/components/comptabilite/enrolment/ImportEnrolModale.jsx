import { useTranslation } from "react-i18next";
import { C, getClassesForSection } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { useImportEnrol } from "./use-import-enrol";
import { ImportEnrolPreview } from "./ImportEnrolPreview";

export function ImportEnrolModale({
  setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
  ajoutParNiveau, ensureClasse, elevesEnrol,
}) {
  const { t } = useTranslation();
  const {
    importEnrolPreview, importEnrolEnCours, classeDefautImport, setClasseDefautImport,
    ordreNomImport, setOrdreNomImport, fermer, handleFile, telechargerTemplate, lancerImport,
  } = useImportEnrol({
    setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
    ajoutParNiveau, ensureClasse, elevesEnrol, t,
  });

  return (<Modale titre="📋 Importer des élèves depuis Excel" fermer={fermer} large>
    <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,fontSize:12,color:"#0369a1"}}>
      <strong>📌 Détection automatique des colonnes</strong> — Peu importe l'ordre ou le nom exact des colonnes dans votre fichier, le système les reconnaît automatiquement.<br/>
      Seuls <strong>Nom</strong>, <strong>Prénom</strong> et <strong>Classe</strong> sont obligatoires. Tous les autres champs sont optionnels.
    </div>
    <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px dashed ${C.blue}`,background:"#f0f6ff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
        📂 Choisir un fichier Excel / CSV
        <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>
      </label>
      <Btn v="ghost" onClick={telechargerTemplate}>⬇️ {t("common.template")} Excel</Btn>
    </div>

    <div style={{marginBottom:8,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde047",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>📚 Classe à affecter</span>
      <span style={{fontSize:12,color:"#713f12",flex:1}}>Si votre fichier n'a pas de colonne Classe, sélectionnez-en une ici.</span>
      <select value={classeDefautImport} onChange={e=>setClasseDefautImport(e.target.value)}
        style={{border:"1.5px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",fontWeight:700,color:"#0A1628"}}>
        <option value="">— Classe du fichier —</option>
        {getClassesForSection(niveauEnrol).map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>

    <div style={{marginBottom:12,padding:"10px 14px",background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#5b21b6"}}>🔤 Ordre du nom complet</span>
      <span style={{fontSize:12,color:"#6d28d9",flex:1}}>Quand le nom et le prénom sont dans une seule colonne, dans quel ordre ?</span>
      {[
        {val:"nom_prenom", label:"NOM Prénom",  ex:"DIALLO Mamadou"},
        {val:"prenom_nom", label:"Prénom NOM",  ex:"Mamadou DIALLO"},
        {val:"auto",       label:"Auto-detect", ex:"Majuscules = NOM"},
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
      <Btn v="ghost" onClick={fermer}>Annuler</Btn>
      {importEnrolPreview?.valides.length>0&&<Btn v="vert" disabled={importEnrolEnCours} onClick={lancerImport}>
        {importEnrolEnCours?`⏳ Import en cours…`:`⬆️ Importer ${importEnrolPreview.valides.length} élève(s)`}
      </Btn>}
    </div>
  </Modale>);
}
