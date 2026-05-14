import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { getActiveExamForms, getEvaluationLabel, resolveCanonicalExamType } from "../evaluation-forms";
import { Badge, Btn, Card, Input, Modale, Selec, Stat, TD, THead, TR, Textarea, Vide } from "./ui";

function GestionExamens() {
  const { t } = useTranslation();
  const {schoolInfo, toast} = useContext(SchoolContext);
  const {items:examens, ajouter:ajEx, modifier:modEx, supprimer:supEx} = useFirestore("examens");
  const {items:elevesC} = useFirestore("elevesCollege");
  const {items:elevesP} = useFirestore("elevesPrimaire");
  const c1 = schoolInfo.couleur1||C.blue;
  const c2 = schoolInfo.couleur2||C.green;
  const examForms = getActiveExamForms(schoolInfo);
  const defaultExamType = examForms[0]?.value || "Composition";
  const [modal,setModal] = useState(null);
  const [form,setForm]   = useState({});
  const [filtre,setFiltre] = useState("all");
  const chg = k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const tousEleves = [...elevesC,...elevesP];
  const classes = [...new Set(tousEleves.map(e=>e.classe||""))].filter(Boolean).sort();

  const examensFiltres = filtre==="all" ? examens : examens.filter(e=>e.classe===filtre||e.classe==="Toutes");
  const examensTries  = [...examensFiltres].sort((a,b)=>a.date>b.date?1:-1);

  const genererConvocations = (exam) => {
    const elevesCible = tousEleves.filter(e=>exam.classe==="Toutes"||e.classe===exam.classe);
    if(!elevesCible.length){alert("Aucun élève pour cette classe.");return;}
    const c1p = schoolInfo.couleur1||"#0A1628";
    const c2p = schoolInfo.couleur2||"#00C48C";
    const logo = schoolInfo.logo||"";
    const nomEcole = schoolInfo.nom||"École";
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="utf-8"/>
    <title>Convocations — ${exam.titre}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
      @page{size:A5 portrait;margin:0}
      @media print{html,body{margin:0}}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:'Inter',Arial,sans-serif;background:#fff;margin:0;padding:5mm}
      .convoc{width:138mm;min-height:95mm;border:2px solid ${c1p};border-radius:6mm;padding:7mm;page-break-after:always;page-break-inside:avoid;display:flex;flex-direction:column;gap:4mm}
      .convoc:last-child{page-break-after:auto}
      .header{display:flex;align-items:center;gap:5mm;border-bottom:2px solid ${c2p};padding-bottom:4mm}
      .logo{width:14mm;height:14mm;object-fit:contain}
      .logo-ph{width:14mm;height:14mm;background:${c1p};border-radius:2mm;display:flex;align-items:center;justify-content:center;color:${c2p};font-size:8pt;font-weight:900}
      .ecole-name{font-size:11pt;font-weight:900;color:${c1p}}
      .ecole-sub{font-size:7pt;color:#64748b}
      .titre{text-align:center;font-size:9pt;font-weight:900;color:${c1p};text-transform:uppercase;letter-spacing:.08em;background:${c2p}22;padding:2mm 4mm;border-radius:2mm;border-left:3mm solid ${c2p}}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
      .info-item{background:#f8fafc;padding:2mm 3mm;border-radius:2mm}
      .info-label{font-size:6pt;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}
      .info-val{font-size:9pt;font-weight:800;color:${c1p}}
      .footer{margin-top:auto;display:flex;justify-content:space-between;padding-top:3mm;border-top:1px solid #e2e8f0;font-size:7pt;color:#94a3b8}
      .signature{text-align:center}
      .sig-label{font-size:7pt;color:#64748b;margin-bottom:4mm}
      .sig-line{width:30mm;height:.3mm;background:#94a3b8;margin:0 auto}
    </style></head><body>
    ${elevesCible.map(e=>`
    <div class="convoc">
      <div class="header">
        ${logo?`<img src="${logo}" class="logo"/>`:`<div class="logo-ph">${nomEcole.slice(0,2).toUpperCase()}</div>`}
        <div>
          <div class="ecole-name">${nomEcole}</div>
          <div class="ecole-sub">CONVOCATION D'EXAMEN</div>
        </div>
      </div>
      <div class="titre">${exam.titre}</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Élève</div><div class="info-val">${e.nom} ${e.prenom}</div></div>
        <div class="info-item"><div class="info-label">Matricule</div><div class="info-val">${e.matricule||"—"}</div></div>
        <div class="info-item"><div class="info-label">Classe</div><div class="info-val">${e.classe||"—"}</div></div>
        <div class="info-item"><div class="info-label">Date</div><div class="info-val">${exam.date||"—"}</div></div>
        ${exam.heure?`<div class="info-item"><div class="info-label">Heure</div><div class="info-val">${exam.heure}</div></div>`:""}
        ${exam.salle?`<div class="info-item"><div class="info-label">Salle</div><div class="info-val">${exam.salle}</div></div>`:""}
        ${exam.matiere?`<div class="info-item"><div class="info-label">Matière</div><div class="info-val">${exam.matiere}</div></div>`:""}
        ${exam.duree?`<div class="info-item"><div class="info-label">Durée</div><div class="info-val">${exam.duree}</div></div>`:""}
      </div>
      ${exam.consignes?`<div style="font-size:8pt;color:#475569;padding:2mm 3mm;background:#f8fafc;border-radius:2mm;"><strong>Consignes :</strong> ${exam.consignes}</div>`:""}
      <div class="footer">
        <span>Pièce à présenter le jour de l'examen</span>
        <div class="signature"><div class="sig-label">Signature Direction</div><div class="sig-line"></div></div>
      </div>
    </div>`).join("")}
    <script>window.onload=()=>{setTimeout(()=>window.print(),400);}</script>
    </body></html>`);
    w.document.close();
  };
  const today = new Date().toISOString().slice(0,10);
  const aVenir = examensTries.filter(e=>!e.date||e.date>=today);
  const passes  = examensTries.filter(e=>e.date&&e.date<today);

  return (
    <div style={{padding:"22px 26px",maxWidth:1100}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:900,color:c1}}>📝 {t("nav.exams")}</h2>
          <p style={{margin:"4px 0 0",fontSize:13,color:"#6b7280"}}>{examens.length} examen(s) planifié(s)</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={filtre} onChange={e=>setFiltre(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:8,padding:"6px 10px",fontSize:12}}>
            <option value="all">{t("common.all")}</option>
            <option value="Toutes">Toutes (globaux)</option>
            {classes.map(c=><option key={c}>{c}</option>)}
          </select>
          <Btn onClick={()=>{setForm({type:defaultExamType,classe:"Toutes"});setModal("add");}}>+ Planifier</Btn>
        </div>
      </div>

      {/* Examens à venir */}
      {aVenir.length>0&&<>
        <h3 style={{fontSize:13,fontWeight:800,color:c1,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>À venir ({aVenir.length})</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12,marginBottom:20}}>
          {aVenir.map(ex=>(
            <Card key={ex._id} style={{border:`1px solid ${c1}22`}}>
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:900,fontSize:14,color:c1}}>{ex.titre}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{getEvaluationLabel(ex.type, schoolInfo, { kind:"exam" })} · {ex.classe||"Toutes classes"}</div>
                  </div>
                  <div style={{background:`${c2}22`,color:c1,fontWeight:800,fontSize:12,padding:"4px 10px",borderRadius:8,whiteSpace:"nowrap"}}>{ex.date||"—"}</div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {ex.heure&&<span style={{fontSize:11,background:"#f1f5f9",padding:"2px 8px",borderRadius:6,color:"#475569"}}>🕐 {ex.heure}</span>}
                  {ex.salle&&<span style={{fontSize:11,background:"#f1f5f9",padding:"2px 8px",borderRadius:6,color:"#475569"}}>📍 {ex.salle}</span>}
                  {ex.matiere&&<span style={{fontSize:11,background:"#f1f5f9",padding:"2px 8px",borderRadius:6,color:"#475569"}}>📚 {ex.matiere}</span>}
                  {ex.duree&&<span style={{fontSize:11,background:"#f1f5f9",padding:"2px 8px",borderRadius:6,color:"#475569"}}>⏱ {ex.duree}</span>}
                </div>
                {ex.consignes&&<p style={{fontSize:11,color:"#64748b",margin:"0 0 10px",padding:"6px 10px",background:"#f8fafc",borderRadius:6,lineHeight:1.5}}>{ex.consignes}</p>}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Btn sm v="vert" onClick={()=>genererConvocations(ex)}>🖨️ Convocations</Btn>
                  <Btn sm v="ghost" onClick={()=>{setForm({...ex});setModal("edit");}}>✏️</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEx(ex._id);}}>🗑️</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>}

      {/* Examens passés */}
      {passes.length>0&&<>
        <h3 style={{fontSize:13,fontWeight:800,color:"#94a3b8",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Passés ({passes.length})</h3>
        <Card style={{opacity:0.75}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Titre","Type","Classe","Date","Salle","Actions"]}/>
            <tbody>{passes.map(ex=><TR key={ex._id}>
              <TD bold>{ex.titre}</TD>
              <TD><Badge color="gray">{getEvaluationLabel(ex.type, schoolInfo, { kind:"exam" })}</Badge></TD>
              <TD>{ex.classe||"Toutes"}</TD>
              <TD>{ex.date}</TD>
              <TD>{ex.salle||"—"}</TD>
              <TD>
                <Btn sm v="ghost" onClick={()=>genererConvocations(ex)}>🖨️</Btn>
                <Btn sm v="danger" style={{marginLeft:4}} onClick={()=>{if(confirm("Supprimer ?"))supEx(ex._id);}}>🗑️</Btn>
              </TD>
            </TR>)}</tbody>
          </table>
        </Card>
      </>}

      {examens.length===0&&<Vide icone="📝" msg="Aucun examen planifié"/>}

      {/* Modal add/edit */}
      {(modal==="add"||modal==="edit")&&<Modale titre={modal==="add"?"Planifier un examen":"Modifier l'examen"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Titre de l'examen" value={form.titre||""} onChange={chg("titre")} placeholder="Ex : Composition du 1er trimestre"/></div>
          <Selec label="Type" value={form.type||defaultExamType} onChange={chg("type")}>
            {examForms.map(item=><option key={item.id} value={item.value}>{item.label}</option>)}
          </Selec>
          <Selec label="Classe" value={form.classe||"Toutes"} onChange={chg("classe")}>
            <option>Toutes</option>
            {classes.map(c=><option key={c}>{c}</option>)}
          </Selec>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          <Input label="Heure de début" value={form.heure||""} onChange={chg("heure")} placeholder="08:00"/>
          <Input label="Salle / Lieu" value={form.salle||""} onChange={chg("salle")} placeholder="Salle A"/>
          <Input label="Matière (optionnel)" value={form.matiere||""} onChange={chg("matiere")}/>
          <Input label="Durée" value={form.duree||""} onChange={chg("duree")} placeholder="2h"/>
          <div style={{gridColumn:"1/-1"}}><Textarea label="Consignes (optionnel)" value={form.consignes||""} onChange={chg("consignes")}/></div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>{
            if(!form.titre){toast("Titre requis","warning");return;}
            const row = { ...form, type: resolveCanonicalExamType(form.type || defaultExamType, schoolInfo) };
            modal==="add"?ajEx(row):modEx(row);
            setModal(null);
            toast(modal==="add"?"Examen planifié":"Examen mis à jour","success");
          }}>{modal==="add"?"Planifier":"Enregistrer"}</Btn>
        </div>
      </Modale>}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RECHERCHE GLOBALE (Ctrl+K / ⌘K)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export { GestionExamens };


