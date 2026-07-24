import { useMemo } from "react";
import { C } from "../../../constants";
import { Badge, Card } from "../../ui";
import { getGeneralAverage } from "../../../note-utils";
import { indexerNotesParEleve, notesDeLEleve } from "../../../note-index";

// Tableau d'honneur : les 5 meilleurs élèves par moyenne générale, avec
// médailles et mention.
export function ApercuHonneur({ eleves, notes, matieresForClasse }) {
  // Index construit une fois plutôt qu'un filter complet par élève
  // (cf. src/note-index.js) : le classement parcourt TOUS les élèves.
  const notesParEleve = useMemo(() => indexerNotesParEleve(notes), [notes]);
  if (eleves.length === 0) return null;
  const classement=eleves.map(e=>{
    const notesPeriode=notesDeLEleve(notesParEleve,e._id);
    const moyenne = getGeneralAverage(notesPeriode, matieresForClasse(e.classe), e.classe);
    return {...e, moyGene:moyenne||0};
  }).filter(e=>e.moyGene>0).sort((a,b)=>b.moyGene-a.moyGene).slice(0,5);
  if(!classement.length) return null;
  return (
    <div style={{marginTop:16}}>
      <div style={{background:"linear-gradient(90deg,#d97706,#f59e0b)",color:"#fff",padding:"10px 16px",borderRadius:"10px 10px 0 0",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
        🏆 Tableau d'Honneur — 5 meilleurs élèves
      </div>
      <Card style={{borderRadius:"0 0 10px 10px"}}>
        <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <thead><tr style={{background:"#fef3e0"}}>
            <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Rang</th>
            <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Élève</th>
            <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Classe</th>
            <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Moyenne</th>
            <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Mention</th>
          </tr></thead>
          <tbody>{classement.map((e,i)=>{
            const medals=["🥇","🥈","🥉","4️⃣","5️⃣"];
            const moyV=e.moyGene.toFixed(2);
            const mention=Number(moyV)>=16?"Très Bien":Number(moyV)>=14?"Bien":Number(moyV)>=12?"Assez Bien":Number(moyV)>=10?"Passable":"Insuffisant";
            const mentionColor=Number(moyV)>=14?"vert":Number(moyV)>=10?"blue":"red";
            return <tr key={e._id} style={{borderBottom:"1px solid #fde68a",background:i===0?"#fffbeb":"#fff"}}>
              <td style={{padding:"9px 12px",textAlign:"center",fontSize:20}}>{medals[i]}</td>
              <td style={{padding:"9px 12px",fontWeight:800,color:C.blueDark}}>{e.nom} {e.prenom}</td>
              <td style={{padding:"9px 12px"}}><Badge color="blue">{e.classe}</Badge></td>
              <td style={{padding:"9px 12px",textAlign:"center",fontSize:16,fontWeight:800,color:C.greenDk}}>{moyV}/20</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}><Badge color={mentionColor}>{mention}</Badge></td>
            </tr>;
          })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
