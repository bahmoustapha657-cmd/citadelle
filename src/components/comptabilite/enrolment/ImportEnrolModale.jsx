import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, initMens, genererMatricule, getClassesForSection } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { telechargerExcel } from "../../../reports";
import { findEnrollmentDuplicate } from "../../../enrollment-utils";
import { parseEnrolmentFile, buildEnrolmentTemplate } from "../enrolment-import";

export function ImportEnrolModale({
  setModal, niveauEnrol, schoolInfo, toast, tousElevesScolarite,
  ajoutParNiveau, ensureClasse, elevesEnrol,
}) {
  const { t } = useTranslation();
  const [importEnrolPreview, setImportEnrolPreview] = useState(null);
  const [importEnrolEnCours, setImportEnrolEnCours] = useState(false);
  const [classeDefautImport, setClasseDefautImport] = useState("");
  const [ordreNomImport, setOrdreNomImport] = useState("auto");

  return (<Modale titre="📋 Importer des élèves depuis Excel" fermer={()=>{setModal(null);setImportEnrolPreview(null);}} large>
    <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,fontSize:12,color:"#0369a1"}}>
      <strong>📌 Détection automatique des colonnes</strong> — Peu importe l'ordre ou le nom exact des colonnes dans votre fichier, le système les reconnaît automatiquement.<br/>
      Seuls <strong>Nom</strong>, <strong>Prénom</strong> et <strong>Classe</strong> sont obligatoires. Tous les autres champs sont optionnels.
    </div>
    <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px dashed ${C.blue}`,background:"#f0f6ff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
        📂 Choisir un fichier Excel / CSV
        <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={async e=>{
          const file=e.target.files[0]; if(!file) return;
          const ab=await file.arrayBuffer();
          const { error, preview } = await parseEnrolmentFile(ab, { classeDefautImport, ordreNomImport, tousElevesScolarite });
          if(error){ toast(error,"warning"); e.target.value=""; return; }
          setImportEnrolPreview(preview);
          e.target.value="";
        }}/>
      </label>
      <Btn v="ghost" onClick={async()=>{
        const wb = await buildEnrolmentTemplate(t);
        await telechargerExcel(wb,t("reports.excel.template.filename"));
      }}>⬇️ {t("common.template")} Excel</Btn>
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

    {importEnrolPreview&&<>
      <div style={{marginBottom:12,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
        <div style={{background:"#f8fafc",padding:"8px 14px",fontSize:11,fontWeight:800,color:"#475569",borderBottom:"1px solid #e2e8f0"}}>
          🗺️ Colonnes détectées dans votre fichier
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 14px"}}>
          {importEnrolPreview.mapping.map(({champ,colonne})=>(
            <span key={champ} style={{
              padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
              background:colonne?"#dcfce7":"#fef9c3",
              color:colonne?"#15803d":"#92400e",
              border:`1px solid ${colonne?"#86efac":"#fde68a"}`
            }}>
              {champ} {colonne?`→ "${colonne}"` :"— non trouvé"}
            </span>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:14,marginBottom:10,fontSize:12,flexWrap:"wrap"}}>
        <span style={{color:"#059669",fontWeight:700}}>✅ {importEnrolPreview.valides.length} prêts à importer</span>
        {importEnrolPreview.nbAvert>0&&<span style={{color:"#d97706",fontWeight:700}}>⚠️ {importEnrolPreview.nbAvert} avec avertissement</span>}
        <span style={{color:"#dc2626",fontWeight:700}}>❌ {importEnrolPreview.lignes.length-importEnrolPreview.valides.length} bloqués (champs obligatoires manquants)</span>
      </div>
      <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8,marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
            {["L.","Nom","Prénom","Classe","Sexe","Date naiss.","Tuteur","Statut"].map(h=>(
              <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{importEnrolPreview.lignes.map((l,i)=>(
            <tr key={i} style={{background:l.erreurs.length?"#fef2f2":l.avertissements?.length?"#fffbeb":"#f0fdf4",borderBottom:"1px solid #f1f5f9"}}>
              <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10}}>{l.ligne}</td>
              <td style={{padding:"4px 8px",fontWeight:600}}>{l.nom||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.prenom||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.classe||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.sexe}</td>
              <td style={{padding:"4px 8px"}}>{l.dateNaissance||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.tuteur||"—"}</td>
              <td style={{padding:"4px 8px"}}>
                {l.erreurs.length
                  ?<span style={{color:"#dc2626",fontSize:10}}>❌ {l.erreurs.join(", ")}</span>
                  :l.avertissements?.length
                    ?<span style={{color:"#d97706",fontSize:10}}>⚠️ {l.avertissements.join(", ")}</span>
                    :<span style={{color:"#059669",fontSize:10}}>✅</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>}

    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
      <Btn v="ghost" onClick={()=>{setModal(null);setImportEnrolPreview(null);}}>Annuler</Btn>
      {importEnrolPreview?.valides.length>0&&<Btn v="vert" disabled={importEnrolEnCours} onClick={async()=>{
        setImportEnrolEnCours(true);
        let count=0;
        const existants=tousElevesScolarite;
        const matsGeneres=[];
        const classesImportCreees=new Set();
        const ajFn=ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
        const lotImporte=[];
        for(const l of importEnrolPreview.valides){
          const doublon = findEnrollmentDuplicate(l, [...existants, ...lotImporte]);
          if(doublon) continue;
          const mat=genererMatricule([...elevesEnrol,...matsGeneres],niveauEnrol,schoolInfo);
          const eleveAImporter={
            nom:l.nom,prenom:l.prenom,classe:l.classe,sexe:l.sexe,
            dateNaissance:l.dateNaissance,lieuNaissance:l.lieuNaissance,ien:l.ien,
            tuteur:l.tuteur,contactTuteur:l.contactTuteur,
            filiation:l.filiation,domicile:l.domicile,
            typeInscription:l.typeInscription,
            matricule:mat,statut:"Actif",mens:initMens(),
          };
          matsGeneres.push({matricule:mat});
          await ajFn(eleveAImporter);
          lotImporte.push(eleveAImporter);
          await ensureClasse(l.classe, niveauEnrol, classesImportCreees);
          count++;
        }
        setImportEnrolEnCours(false);
        setModal(null);
        setImportEnrolPreview(null);
        toast(`${count} élève(s) importé(s) avec succès`,"success");
      }}>
        {importEnrolEnCours?`⏳ Import en cours…`:`⬆️ Importer ${importEnrolPreview.valides.length} élève(s)`}
      </Btn>}
    </div>
  </Modale>);
}
