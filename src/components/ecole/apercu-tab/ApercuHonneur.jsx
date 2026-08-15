import { useMemo } from "react";
import { C } from "../../../constants";
import { Badge, Btn, Card } from "../../ui";
import { imprimerTableauHonneur } from "../../../reports";
import { getMention } from "../../../reports/bulletins/bulletin-format";
import { getGeneralAverage } from "../../../note-utils";
import { indexerNotesParEleve, notesDeLEleve } from "../../../note-index";

// Tableau d'honneur : les 5 meilleurs élèves par moyenne générale, avec
// médailles et mention.
export function ApercuHonneur({ eleves, notes, matieresForClasse, schoolInfo = {}, periodeLabel = "", portee = "", annee = "", nbHonneur = 5, maxNote = 20 }) {
  // Index construit une fois plutôt qu'un filter complet par élève
  // (cf. src/note-index.js) : le classement parcourt TOUS les élèves.
  const notesParEleve = useMemo(() => indexerNotesParEleve(notes), [notes]);
  if (eleves.length === 0) return null;
  const classement=eleves.map(e=>{
    const notesPeriode=notesDeLEleve(notesParEleve,e._id);
    const moyenne = getGeneralAverage(notesPeriode, matieresForClasse(e.classe), e.classe);
    return {...e, moyGene:moyenne||0};
  }).filter(e=>e.moyGene>0).sort((a,b)=>b.moyGene-a.moyGene).slice(0,nbHonneur);
  if(!classement.length) return null;
  return (
    <div style={{marginTop:16}}>
      <div style={{background:"linear-gradient(90deg,#d97706,#f59e0b)",color:"#fff",padding:"10px 16px",borderRadius:"10px 10px 0 0",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{ flex: 1 }}>🏆 Tableau d'Honneur — {classement.length} meilleurs élèves</span>
        {/* Affiche destinée au MUR : A4 paysage, noms en grand, podium
            détaché. Le classement affiché est celui qu'on imprime — pas de
            recalcul, donc aucun risque d'écart entre l'écran et l'affiche. */}
        <Btn sm v="ghost" title="Imprimer l'affiche pour le tableau d'honneur de l'école"
          onClick={() => imprimerTableauHonneur(
            classement.map((e) => ({ ...e, moyenne: e.moyGene })),
            schoolInfo, { periodeLabel, portee, annee, maxNote },
          )}>🖨️ Afficher</Btn>
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
            // Mention EN POURCENTAGE du barème : le primaire et le préscolaire
            // sont notés sur 10. Les seuils figés sur 20 affichaient
            // « 8.50/20 — Insuffisant » pour un excellent élève de primaire.
            const mention=getMention(moyV,maxNote);
            const mentionColor=Number(moyV)>=maxNote*0.7?"vert":Number(moyV)>=maxNote*0.5?"blue":"red";
            return <tr key={e._id} style={{borderBottom:"1px solid #fde68a",background:i===0?"#fffbeb":"#fff"}}>
              <td style={{padding:"9px 12px",textAlign:"center",fontSize:20}}>{medals[i]}</td>
              <td style={{padding:"9px 12px",fontWeight:800,color:C.blueDark}}>{e.nom} {e.prenom}</td>
              <td style={{padding:"9px 12px"}}><Badge color="blue">{e.classe}</Badge></td>
              <td style={{padding:"9px 12px",textAlign:"center",fontSize:16,fontWeight:800,color:C.greenDk}}>{moyV}/{maxNote}</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}><Badge color={mentionColor}>{mention}</Badge></td>
            </tr>;
          })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
