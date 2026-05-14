import React from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Stat, Vide } from "../ui";
import { imprimerListeClasse } from "../../reports";
import { getGeneralAverage } from "../../note-utils";

export function ApercuTab({
  classes,
  eleves,
  ens,
  notes,
  absences,
  avecEns,
  moy,
  maxNote,
  cC,
  cE,
  classesUniq,
  effectifReel,
  matieresForClasse,
  couleur,
  schoolInfo,
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
        <Stat label={t("school.classes.title")} value={classes.length}/>
        <Stat label={t("school.students.active")} value={eleves.filter(e=>e.statut==="Actif").length} sub={`/ ${eleves.length}`}/>
        {avecEns&&<Stat label={t("school.teachers.title")} value={ens.length}/>}
        <Stat label={t("school.bulletins.average")} value={`${moy}/${maxNote}`} bg="#eaf4e0"/>
        <Stat label={t("dashboard.absences")} value={absences.length} bg="#fef3e0"/>
      </div>
      {(cC||cE)?<Chargement/>:classes.length===0&&eleves.length===0?<Vide icone={avecEns?"🏫":"🎒"} msg="Module vide"/>
        :<Card><div style={{padding:"16px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p style={{margin:0,fontWeight:800,fontSize:14,color:C.blueDark}}>{t("school.overview.studentsByClass")}</p>
            <div style={{display:"flex",gap:8}}>
              {classesUniq.map(cl=>(
                <Btn sm key={cl} v="ghost" onClick={()=>imprimerListeClasse(cl,eleves,schoolInfo)}>🖨️ {cl}</Btn>
              ))}
            </div>
          </div>
          {classes.map(c=>(
            <div key={c._id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:C.blueDark,width:76}}>{c.nom}</span>
              <div style={{flex:1,background:"#e0ebf8",borderRadius:5,height:8}}>
                <div style={{background:couleur,borderRadius:5,height:8,width:`${Math.min(effectifReel(c.nom)/50*100,100).toFixed(0)}%`}}/>
              </div>
              <span style={{fontSize:11,color:"#6b7280",width:26,textAlign:"right",fontWeight:600}}>{effectifReel(c.nom)}</span>
            </div>
          ))}
        </div></Card>}

        {/* ── GRAPHIQUE EFFECTIFS + MOYENNES ── */}
        {classes.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <Card><div style={{padding:"14px 16px"}}>
            <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Effectifs par classe</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={classes.map(c=>({classe:c.nom,Effectif:effectifReel(c.nom)}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                <XAxis dataKey="classe" tick={{fontSize:10}}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip/>
                <Bar dataKey="Effectif" fill={couleur} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div></Card>

          <Card><div style={{padding:"14px 16px"}}>
            <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Moyenne générale par classe</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={classes.map(c=>{
                const elevesClasse=eleves.filter(e=>e.classe===c.nom);
                if(!elevesClasse.length) return {classe:c.nom,Moyenne:0};
                const moyClasse=elevesClasse.map(e=>{
                  const notesE=notes.filter(n=>n.eleveId===e._id);
                  return getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
                }).filter(m=>m!==null);
                const moyV=moyClasse.length?(moyClasse.reduce((s,m)=>s+m,0)/moyClasse.length).toFixed(2):0;
                return {classe:c.nom,Moyenne:Number(moyV)};
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                <XAxis dataKey="classe" tick={{fontSize:10}}/>
                <YAxis domain={[0,maxNote]} tick={{fontSize:10}}/>
                <Tooltip formatter={v=>`${v}/${maxNote}`}/>
                <Bar dataKey="Moyenne" fill="#f59e0b" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div></Card>
        </div>}

        {/* ── TABLEAU D'HONNEUR ── */}
        {eleves.length>0&&(()=>{
          const classement=eleves.map(e=>{
            const notesPeriode=notes.filter(n=>n.eleveId===e._id);
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
                <table style={{width:"100%",borderCollapse:"collapse"}}>
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
                </table>
              </Card>
            </div>
          );
        })()}
      </div>
  );
}
