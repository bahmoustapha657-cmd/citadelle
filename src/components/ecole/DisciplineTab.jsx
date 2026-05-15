import React from "react";
import { useTranslation } from "react-i18next";
import { C, today } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, Textarea, THead, TR, Vide } from "../ui";
import { exportExcel } from "../../reports";

export function DisciplineTab({
  absences,
  cAbs,
  ajAbs,
  supAbs,
  eleves,
  avecEns,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  envoyerPush,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.discipline.title")} & {t("dashboard.absences")} ({absences.length})</strong>
        <Btn sm v="ghost" onClick={()=>exportExcel(
          `${t("reports.excel.files.discipline")}_${avecEns?"College":"Primaire"}`,
          [t("reports.excel.headers.student"),t("reports.excel.headers.class"),t("reports.excel.headers.type"),t("reports.excel.headers.date"),t("reports.excel.headers.motive"),t("reports.excel.headers.justified")],
          absences.map(a=>[a.eleveNom,a.classe,a.type,a.date,a.motif||"",a.justifie])
        )}>📥 {t("common.export")} Excel</Btn>
        {canCreate&&<Btn onClick={()=>{setForm({type:"Absence",justifie:"Non"});setModal("add_abs");}}>+ Enregistrer</Btn>}
      </div>
      {(()=>{
        const elevesAlerte=eleves.map(e=>({
          ...e,
          nbAbs:absences.filter(a=>a.eleveNom===`${e.nom} ${e.prenom}`&&a.type==="Absence"&&a.justifie==="Non").length
        })).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs);
        return elevesAlerte.length>0?(
          <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>⚠️</span>
              <strong style={{fontSize:13,color:"#92400e"}}>Alertes absences — {elevesAlerte.length} élève(s) avec 3 absences non justifiées ou plus</strong>
              <Btn sm v="ghost" style={{marginInlineStart:"auto"}} onClick={()=>exportExcel(
                t("reports.excel.files.attendanceAlerts"),
                [t("reports.excel.headers.lastName"),t("reports.excel.headers.firstName"),t("reports.excel.headers.class"),t("reports.excel.headers.countUnjustified"),t("reports.excel.headers.guardian"),t("reports.excel.headers.contact")],
                elevesAlerte.map(e=>[e.nom,e.prenom,e.classe,e.nbAbs,e.tuteur||"",e.contactTuteur||""])
              )}>📥 {t("common.export")}</Btn>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {elevesAlerte.map(e=>(
                <div key={e._id} style={{background:"#fff",border:"1px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                  <span style={{fontWeight:800,color:"#92400e"}}>{e.nom} {e.prenom}</span>
                  <span style={{color:"#6b7280"}}> · {e.classe} · </span>
                  <Badge color="amber">{e.nbAbs} absences</Badge>
                </div>
              ))}
            </div>
          </div>
        ):null;
      })()}
      {cAbs?<Chargement/>:absences.length===0?<Vide icone="📋" msg="Aucun événement de discipline enregistré"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Élève","Classe","Type","Date","Motif","Justifié",canEdit?"Action":""]}/>
          <tbody>{absences.map(a=><TR key={a._id}>
            <TD bold>{a.eleveNom}</TD><TD>{a.classe}</TD>
            <TD><Badge color={a.type==="Absence"?"red":a.type==="Retard"?"amber":"orange"}>{a.type}</Badge></TD>
            <TD>{a.date}</TD><TD>{a.motif||"—"}</TD>
            <TD><Badge color={a.justifie==="Oui"?"vert":"red"}>{a.justifie}</Badge></TD>
            {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supAbs(a._id);}}>Suppr.</Btn></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {modal==="add_abs"&&canCreate&&<Modale titre="Enregistrer un événement disciplinaire" fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <Selec label="Élève" value={form.eleveNom||""} onChange={e=>{
              const el=eleves.find(ev=>`${ev.nom} ${ev.prenom}`===e.target.value);
              setForm(p=>({...p,eleveNom:e.target.value,classe:el?.classe||""}));
            }}>
              <option value="">— Sélectionner —</option>
              {eleves.map(e=><option key={e._id}>{e.nom} {e.prenom}</option>)}
            </Selec>
          </div>
          <Selec label="Type" value={form.type||"Absence"} onChange={chg("type")}>
            <option>Absence</option><option>Retard</option><option>Sanction</option><option>Avertissement</option><option>Renvoi temporaire</option>
          </Selec>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label="Justifié ?" value={form.justifie||"Non"} onChange={chg("justifie")}>
            <option>Non</option><option>Oui</option>
          </Selec>
          <div style={{gridColumn:"1/-1"}}><Textarea label="Motif / Description" value={form.motif||""} onChange={chg("motif")}/></div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn v="orange" onClick={async()=>{
            const abs={...form,date:form.date||today()};
            await ajAbs(abs);
            setModal(null);
            envoyerPush(
              ["parent"],
              `⚠️ ${abs.type||"Absence"} signalée`,
              `${abs.eleveNom||"Votre enfant"} — ${abs.type||"Absence"} du ${abs.date}${abs.motif?` : ${abs.motif}`:""}`,
              "/absences"
            );
          }}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
