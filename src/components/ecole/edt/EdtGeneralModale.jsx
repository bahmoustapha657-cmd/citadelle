import React from "react";
import { Btn, Modale } from "../../ui";
import { C } from "../../../constants";
import { JOURS, SOUS_LABELS, affNom, nbSousLignes, totalLignesClasse } from "./edt-utils";
import { voirEdtGeneral } from "./edt-print";

export function EdtGeneralModale({
  edtGeneralOuvert, setEdtGeneralOuvert,
  classes, classesTriees, emplois, TRANCHES, nbTranches,
  matCouleur, findEns, schoolInfo,
}) {
  if (!edtGeneralOuvert) return null;
  return (
    <Modale titre="📊 Emploi du Temps Général" fermer={() => setEdtGeneralOuvert(false)}>
      <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:12,color:"#64748b"}}>{classes.length} classe(s) · {emplois.length} créneaux</span>
        <Btn onClick={()=>voirEdtGeneral({ emplois, classesTriees, TRANCHES, nbTranches, schoolInfo, findEns })}>🖨️ Imprimer / PDF</Btn>
      </div>
      <div style={{overflowX:"auto",maxHeight:"70dvh",overflowY:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:11,width:"100%",minWidth:700}}>
          <thead>
            <tr style={{position:"sticky",top:0,zIndex:3}}>
              <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:65,position:"sticky",top:0}}>Classes</th>
              <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:58,position:"sticky",top:0}}>Horaires</th>
              <th style={{background:C.blueDark,color:"#fff",padding:"6px 4px",fontSize:9,position:"sticky",top:0}}></th>
              {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,textAlign:"center",minWidth:85,position:"sticky",top:0}}>{j}</th>)}
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const rows=[];
              classesTriees.forEach(cl=>{
                const total=totalLignesClasse(nbTranches);
                let first=true;
                for(let ti=0;ti<nbTranches;ti++){
                  const hd=TRANCHES[ti],hf=TRANCHES[ti+1];
                  const ns=nbSousLignes(ti);
                  for(let si=0;si<ns;si++){
                    const isLastSub=si===ns-1;
                    const isLastSlot=ti===nbTranches-1;
                    const bBot=isLastSub?(isLastSlot?"3px solid "+C.blueDark:"2px solid #b0c4d8"):"1px solid #f0f4f8";
                    const cells=[];
                    if(first&&si===0){
                      cells.push(<td key="cls" rowSpan={total} style={{background:C.blueDark,color:C.vert,fontWeight:800,fontSize:12,textAlign:"center",padding:"6px 5px",border:"2px solid "+C.blueDark,verticalAlign:"middle"}}>{cl.nom}</td>);
                      first=false;
                    }
                    if(si===0)cells.push(<td key="hr" rowSpan={ns} style={{background:"#f0f4f8",fontWeight:800,fontSize:10,color:C.blueDark,textAlign:"center",padding:"4px 5px",border:"1px solid #e2e8f0",whiteSpace:"nowrap",verticalAlign:"middle"}}>{hd.slice(0,5)}<br/>{hf.slice(0,5)}</td>);
                    cells.push(<td key="lbl" style={{background:"#f8fafc",color:"#94a3b8",fontSize:9,padding:"2px 5px",textAlign:"right",border:"1px solid #e8edf2",borderBottom:bBot,whiteSpace:"nowrap",fontStyle:"italic"}}>{SOUS_LABELS[si]||""}</td>);
                    JOURS.forEach(jour=>{
                      const cr=emplois.find(e=>e.classe===cl.nom&&e.jour===jour&&e.heureDebut===hd);
                      const bg=cr?(matCouleur[cr.matiere]||"#e0ebf8"):"#fff";
                      let val=null;
                      if(cr){
                        if(si===0)val=<strong style={{fontSize:11}}>{cr.matiere}</strong>;
                        else if(si===1){const e=findEns(cr.enseignant);val=<span style={{fontSize:10,color:"#475569"}}>{affNom(cr.enseignant||"")}{e?.telephone&&<span style={{display:"block",fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</span>}</span>;}
                        else if(si===2)val=<span style={{fontSize:9,color:"#94a3b8"}}>{cr.salle||""}</span>;
                      }
                      cells.push(<td key={jour} style={{background:bg,border:"1px solid #e2e8f0",borderBottom:bBot,padding:"2px 5px",textAlign:"center",verticalAlign:"middle",minWidth:85}}>{val}</td>);
                    });
                    rows.push(<tr key={cl._id+"-"+ti+"-"+si}>{cells}</tr>);
                  }
                }
              });
              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </Modale>
  );
}
