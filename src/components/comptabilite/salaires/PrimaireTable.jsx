import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { C, fmtN, getAnnee, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Btn, TD, THead, TR } from "../../ui";

export function PrimaireTable({ salairesPrim, filtrePrimNom, setFiltrePrimNom, filtrePrimClasse, setFiltrePrimClasse, canEdit, modS, supS, setForm, setModal, moisLabel, annee }) {
  const { t } = useTranslation();
  const { schoolInfo } = useContext(SchoolContext);
  const salairesPrimFiltres = salairesPrim
    .filter(s=>!filtrePrimNom||(s.nom||"").toLowerCase().includes(filtrePrimNom.toLowerCase()))
    .filter(s=>filtrePrimClasse==="all"||(s.niveau||"")===filtrePrimClasse);
  return (
    <>
      <div style={{background:C.green,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{flex:1}}>{t("accounting.section").toUpperCase()} {t("dashboard.primary").toUpperCase()} — {moisLabel} {annee||getAnnee()}</span>
        <input
          placeholder="🔍 Recherche par nom..."
          value={filtrePrimNom} onChange={e=>setFiltrePrimNom(e.target.value)}
          style={{border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#0A1628",width:160,outline:"none"}}/>
        <select value={filtrePrimClasse} onChange={e=>setFiltrePrimClasse(e.target.value)}
          style={{border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,color:"#0A1628",background:"#fff"}}>
          <option value="all">Toutes les classes</option>
          {getClassesForSection("primaire", getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="lc-sticky-wrap" style={{marginBottom:8}}>
        <table className="lc-sticky-table" data-fix-left="2" style={{"--col2-left":"50px"}}>
          <THead cols={["N°","Prénoms et Nom","Classe","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
          <tbody>
            {salairesPrimFiltres.length===0?
              <tr><td colSpan={canEdit?8:7} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>{salairesPrim.length===0?"Aucun enseignant primaire pour ce mois":"Aucun résultat pour ce filtre"}</td></tr>
              :salairesPrimFiltres.map((s,i)=>(
                <TR key={s._id}>
                  <TD center>{i+1}</TD>
                  <TD bold>{s.nom}</TD>
                  <TD>{s.niveau}</TD>
                  <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                  <TD center style={{background:"#fffbeb"}}>
                    {canEdit
                      ?<input type="number" value={s.revision||0} onChange={e=>modS({...s,revision:Number(e.target.value)})}
                        style={{width:80,border:"1px solid #fbbf24",borderRadius:5,padding:"3px 5px",fontSize:11,textAlign:"right"}}/>
                      :<span style={{fontSize:12}}>{fmtN(s.revision||0)}</span>}
                  </TD>
                  <TD center style={{fontWeight:800,color:C.greenDk,background:"#eaf4e0"}}>{fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</TD>
                  <TD>{s.observation}</TD>
                  {canEdit&&<TD><div style={{display:"flex",gap:4}}>
                    <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                    <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supS(s._id);}}>×</Btn>
                  </div></TD>}
                </TR>
            ))}
            <tr style={{background:"#e0ebf8",fontWeight:800}}>
              <td colSpan={5} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark}}>
                TOTAL NET PRIMAIRE {filtrePrimClasse!=="all"||filtrePrimNom?`(filtre : ${salairesPrimFiltres.length}/${salairesPrim.length})` : ""}
              </td>
              <td style={{padding:"8px 12px",textAlign:"center",color:C.greenDk,fontSize:14}}>
                {fmtN(salairesPrimFiltres.reduce((s,e)=>s+Number(e.montantForfait||0)-Number(e.bon||0)+Number(e.revision||0),0))}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
