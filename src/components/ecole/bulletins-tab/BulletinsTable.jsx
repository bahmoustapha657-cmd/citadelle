import { useMemo } from "react";
import { C } from "../../../constants";
import { Badge, Btn, Card, TD, TR, Vide } from "../../ui";
import { imprimerBulletin } from "../../../reports";
import { getGeneralAverage, getSubjectAverage } from "../../../note-utils";
import { indexerNotesParEleve, notesDeLEleve } from "../../../note-index";

// Table des bulletins : moyenne générale, mention, accès à l'appréciation et
// impression individuelle (bloquée si frais impayés).
export function BulletinsTable({
  t, elevesB, notes, notesStats, matieresForClasse, periodeB, periodes, schoolInfo, moisAnnee,
  maxNote, avecEns, eleves, canCreate, canEdit, getAppreciation, setForm, setModal,
}) {
  // notesStats = notes réelles en mode période ; notes annuelles synthétiques
  // en mode « fin d'année » (pour l'affichage des moyennes et le contexte IA).
  // `notes` reste les notes réelles (impression, qui gère l'annuel elle-même).
  const notesAff = notesStats || notes;
  // Index eleveId → notes de la période : construit une seule fois par jeu de
  // données au lieu d'un filter complet par élève (cf. src/note-index.js).
  const notesParEleve = useMemo(
    () => indexerNotesParEleve(notesAff, periodeB),
    [notesAff, periodeB],
  );
  if (elevesB.length===0) return <Vide icone="📊" msg={t("school.bulletins.noStudent")}/>;
  return (
    <Card><div style={{maxHeight:"calc(100vh - 320px)",minHeight:280,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0}}>
        {(()=>{
          const cols = [t("school.bulletins.matricule"),t("school.bulletins.student"),t("school.bulletins.class"),t("school.bulletins.average"),t("school.bulletins.mention"),t("school.bulletins.appreciation"),t("school.bulletins.bulletin")];
          const thBase = {textAlign:"start",padding:"10px 13px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap",borderBottom:"2px solid var(--sc2)",background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))",position:"sticky",top:0};
          return (
            <thead>
              <tr>
                <th style={{...thBase,left:0,zIndex:4}}>{cols[0]}</th>
                <th style={{...thBase,left:95,zIndex:4}}>{cols[1]}</th>
                {cols.slice(2).map((c,i)=>(<th key={i} style={{...thBase,zIndex:3}}>{c}</th>))}
              </tr>
            </thead>
          );
        })()}
      <tbody>{elevesB.map((e,rowIdx)=>{
        const notesE=notesDeLEleve(notesParEleve,e._id);
        const moyenneGenerale = getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
        const moyGene=moyenneGenerale!=null?moyenneGenerale.toFixed(2):"—";
        const mention=moyGene==="—"?"—":Number(moyGene)>=16?"Très Bien":Number(moyGene)>=14?"Bien":Number(moyGene)>=12?"Assez Bien":Number(moyGene)>=10?"Passable":"Insuffisant";
        const eleveImpayeBloq = !!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0;
        const apprec=getAppreciation(e._id,periodeB);
        const apprecTexte=apprec?.texte||"";
        // Background sticky alterné pour préserver le zébrage
        const stickyBg = rowIdx%2===0 ? "var(--lc-surface)" : "var(--lc-surface-alt, #f8fafc)";
        return <TR key={e._id}>
          <TD style={{position:"sticky",left:0,zIndex:1,background:stickyBg}}><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
          <TD bold style={{position:"sticky",left:95,zIndex:1,background:stickyBg,boxShadow:"inset -1px 0 0 var(--lc-border-soft)"}}>{e.nom} {e.prenom}</TD>
          <TD><Badge color="blue">{e.classe}</Badge></TD>
          <TD><span style={{fontWeight:800,fontSize:14,color:moyGene!=="—"&&Number(moyGene)>=10?C.greenDk:"#b91c1c"}}>{moyGene}/20</span></TD>
          <TD><Badge color={mention==="Très Bien"||mention==="Bien"?"vert":mention==="Assez Bien"||mention==="Passable"?"blue":"red"}>{mention}</Badge></TD>
          <TD>
            {(canCreate||canEdit)
              ? <Btn sm v={apprecTexte?"vert":"ghost"} title={apprecTexte||t("school.bulletins.addAppreciation")} onClick={()=>{
                  const matieresE=matieresForClasse(e.classe);
                  const notesMatieres=matieresE.map(m=>({matiere:m.nom,moyenne:getSubjectAverage(notesE.filter(n=>n.matiere===m.nom),e.classe)})).filter(x=>x.moyenne!=null);
                  setForm({eleveId:e._id,nomComplet:`${e.nom} ${e.prenom}`,classe:e.classe,moyenne:moyGene,mention,notesMatieres,texte:apprecTexte});
                  setModal("apprec");
                }}>
                  {apprecTexte?t("school.bulletins.editAppreciation"):t("school.bulletins.addAppreciation")}
                </Btn>
              : (apprecTexte
                  ? <span title={apprecTexte} style={{fontSize:11,color:"#374151",fontStyle:"italic",display:"inline-block",maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{apprecTexte}</span>
                  : <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>—</span>)
            }
          </TD>
          <TD>{eleveImpayeBloq
            ? <span title="Frais impayés — impression bloquée" style={{fontSize:18}}>🔒</span>
            : <Btn sm v="amber" onClick={()=>imprimerBulletin(e,notes,matieresForClasse(e.classe),periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,{allEleves:eleves,allNotes:notes,appreciation:apprecTexte,periodes})}>{t("school.bulletins.printBulletin")}</Btn>
          }</TD>
        </TR>;
      })}</tbody>
      </table>
    </div></Card>
  );
}
