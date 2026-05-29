import React from "react";
import { fmtN } from "../../../constants";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../../ui";

export function BonsSousOnglet({ bonsMois, moisLabel, canEdit, supBon, setForm, setModal }) {
  return (
    <>
      {bonsMois.length===0
        ?<Vide icone="📋" msg={`Aucun bon enregistré pour ${moisLabel}`}/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Enseignant","Section","Mois","Montant (GNF)","Motif",canEdit?"Actions":""]}/>
          <tbody>{bonsMois.map(b=><TR key={b._id}>
            <TD bold>{b.nom}</TD>
            <TD><Badge color={b.section==="Primaire"?"vert":"blue"}>{b.section}</Badge></TD>
            <TD>{b.mois}</TD>
            <TD center style={{color:"#b91c1c",fontWeight:700}}>{fmtN(b.montant||0)}</TD>
            <TD>{b.motif||"—"}</TD>
            {canEdit&&<TD center>
              <Btn sm v="ghost" onClick={()=>{setForm({...b});setModal("edit_b");}}>✏️</Btn>
              <Btn sm v="red" onClick={()=>confirm("Supprimer ce bon ?")&&supBon(b._id)}>🗑</Btn>
            </TD>}
          </TR>)}
          <tr style={{background:"#fce8e8",fontWeight:800}}>
            <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#9b2020"}}>TOTAL BONS — {moisLabel}</td>
            <td style={{padding:"8px 12px",textAlign:"center",color:"#9b2020",fontSize:14}}>{fmtN(bonsMois.reduce((s,b)=>s+Number(b.montant||0),0))}</td>
            <td colSpan={2}></td>
          </tr>
          </tbody>
        </table></div></Card>
      }
      <div style={{marginTop:12,padding:"12px 16px",background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,fontSize:13,color:"#92400e"}}>
        <strong>Comment ça marche :</strong> Enregistrez ici les bons de chaque enseignant pour ce mois.
        Ensuite, dans <em>États de salaires</em>, cliquez sur <strong>✔ Appliquer les bons</strong> pour reporter automatiquement les montants dans la colonne "Bon" de chaque enseignant.
      </div>
    </>
  );
}
