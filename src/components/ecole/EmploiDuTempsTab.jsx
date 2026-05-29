import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Btn, Card, THead, TR, TD, Vide, Chargement } from "../ui";
import { JOURS, COULEURS, niveauRank, genTranches, affNom, makeFindEns } from "./edt/edt-utils";
import { imprimerEDT } from "./edt/edt-print";
import { CelluleModale } from "./edt/CelluleModale";
import { EdtGeneralModale } from "./edt/EdtGeneralModale";

export function EmploiDuTempsTab({
  maxNote,
  canCreate,
  canEdit,
  isPrimarySection,
  form,
  setForm,
  chg,
  filtreClasse,
  setFiltreClasse,
  classes,
  matieres,
  ens,
  emplois,
  cEmp,
  ajEmp,
  modEmp,
  supEmp,
}) {
  const { t } = useTranslation();
  const { schoolInfo, toast } = useContext(SchoolContext);

  const [edtVueGrille, setEdtVueGrille] = useState(true);
  const [edtCellule, setEdtCellule] = useState(null);
  const [edtDuree, setEdtDuree] = useState(maxNote === 10 ? 60 : 120);
  const [edtGeneralOuvert, setEdtGeneralOuvert] = useState(false);
  const [edtHeureDebut, setEdtHeureDebut] = useState("08:00");
  const [edtHeureFin, setEdtHeureFin] = useState("14:00");

  const duree = maxNote === 10 ? edtDuree : 120;
  const TRANCHES = genTranches(duree, edtHeureDebut, edtHeureFin);
  const nbTranches = TRANCHES.length - 1;
  const classesTriees = [...classes].sort((a, b) => niveauRank(a.nom) - niveauRank(b.nom));
  const classeEdtActuelle = filtreClasse === "all" && classesTriees.length > 0 ? classesTriees[0].nom : filtreClasse;
  const matCouleur = {};
  matieres.forEach((m, i) => { matCouleur[m.nom] = COULEURS[i % COULEURS.length]; });
  const findEns = makeFindEns(ens);
  const emploisClasse = emplois.filter((e) => e.classe === classeEdtActuelle);
  const getCreneau = (jour, hd) => emploisClasse.find((e) => e.jour === jour && e.heureDebut === hd);

  const copierEDT = () => {
    const cibles = classes.filter((c) => c.nom !== classeEdtActuelle);
    if (!cibles.length) { toast("Aucune autre classe.", "warning"); return; }
    const dest = window.prompt("Copier l'EDT de \"" + classeEdtActuelle + "\" vers quelle classe ?\n" + cibles.map((c) => c.nom).join(", "));
    if (!dest || !classes.find((c) => c.nom === dest)) { toast("Classe introuvable.", "error"); return; }
    const aSupp = emplois.filter((e) => e.classe === dest);
    Promise.all(aSupp.map((e) => supEmp(e._id))).then(() => {
      emploisClasse.forEach((e) => ajEmp({ ...e, classe: dest, _id: undefined }));
      toast("EDT copié vers " + dest, "success");
    });
  };

  return <div>
    {/* ── TOOLBAR ── */}
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,color:C.blueDark,marginRight:4}}>{t("school.timetable.title")}</strong>
      <select value={classeEdtActuelle} onChange={e=>setFiltreClasse(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",fontWeight:700,color:C.blueDark}}>
        {classesTriees.map(c=><option key={c._id} value={c.nom}>{c.nom}</option>)}
      </select>
      <Btn sm v={edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(true)}>📅 Grille</Btn>
      <Btn sm v={!edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(false)}>☰ Liste</Btn>
      {maxNote===10
        ? <select value={edtDuree} onChange={e=>setEdtDuree(Number(e.target.value))}
            title="Durée des rubriques"
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"5px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
            <option value={30}>Rubriques 30 min</option>
            <option value={45}>Rubriques 45 min</option>
            <option value={60}>Rubriques 1 h</option>
          </select>
        : <span style={{fontSize:11,color:"#9ca3af",padding:"4px 8px",background:"#f8fafc",borderRadius:6,border:"1px solid #e2e8f0"}}>⏱ Séances 2h</span>
      }
      <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
        De <input type="time" value={edtHeureDebut} onChange={e=>setEdtHeureDebut(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
      </label>
      <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
        à <input type="time" value={edtHeureFin} onChange={e=>setEdtHeureFin(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
      </label>
      {canCreate&&<Btn sm v="vert" onClick={copierEDT}>📋 Copier vers…</Btn>}
      {classeEdtActuelle!=="all"&&<Btn sm v="ghost" onClick={()=>imprimerEDT({emploisClasse,TRANCHES,classeEdtActuelle,schoolInfo,findEns})}>🖨️ Imprimer</Btn>}
      <Btn sm v="blue" onClick={()=>setEdtGeneralOuvert(true)}>📊 EDT Général</Btn>
    </div>

    {classes.length===0
      ? <Vide icone="📅" msg="Créez d'abord des classes"/>
      : cEmp ? <Chargement/>
      : edtVueGrille ? (
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",minWidth:700,width:"100%",fontSize:12}}>
          <thead>
            <tr>
              <th style={{background:C.blueDark,color:"#fff",padding:"8px 10px",width:72,fontSize:11}}>Horaire</th>
              {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"8px 10px",textAlign:"center",fontSize:11,fontWeight:700}}>{j}</th>)}
            </tr>
          </thead>
          <tbody>
            {TRANCHES.slice(0,-1).map((hd,i)=>{
              const hf=TRANCHES[i+1];
              return <tr key={hd}>
                <td style={{padding:"6px 8px",background:"#f0f4f8",fontWeight:700,fontSize:11,color:C.blueDark,textAlign:"center",borderBottom:"1px solid #e2e8f0",whiteSpace:"nowrap"}}>
                  {hd.slice(0,5)}–{hf.slice(0,5)}
                </td>
                {JOURS.map(jour=>{
                  const cr=getCreneau(jour,hd);
                  const conflit=cr&&emplois.some(x=>x._id!==cr._id&&x.enseignant&&x.enseignant===cr.enseignant&&x.jour===jour&&x.heureDebut===hd);
                  return <td key={jour}
                    onClick={()=>{
                      if(!canCreate&&!canEdit)return;
                      if(cr){setForm({...cr});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:cr});}
                      else{setForm({classe:classeEdtActuelle,jour,heureDebut:hd,heureFin:hf,matiere:"",enseignant:"",salle:""});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:null});}
                    }}
                    style={{
                      padding:"4px 5px",border:`1px solid ${cr?.type==="revision"?"#fdba74":"#e2e8f0"}`,
                      cursor:canCreate||canEdit?"pointer":"default",
                      background:cr?(cr.type==="revision"?"#fff7ed":matCouleur[cr.matiere]||"#e0ebf8"):"#fafcff",
                      minWidth:90,verticalAlign:"top",position:"relative",
                      transition:"filter .15s",
                    }}>
                    {cr ? <>
                      {conflit&&<span title="Conflit enseignant" style={{position:"absolute",top:2,right:3,fontSize:10}}>⚠️</span>}
                      {cr.type==="revision"&&<span style={{position:"absolute",top:2,left:3,background:"#f97316",color:"#fff",fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:3,lineHeight:1.4}}>RÉV</span>}
                      <div style={{fontWeight:800,fontSize:11,color:cr.type==="revision"?"#9a3412":"#1e3a5f",lineHeight:1.3,marginTop:cr.type==="revision"?10:0}}>{cr.matiere||"—"}</div>
                      {cr.enseignant&&(()=>{
                        const e=findEns(cr.enseignant);
                        return <div style={{fontSize:10,color:"#475569",marginTop:1}}>
                          <div>{affNom(cr.enseignant)}</div>
                          {e?.telephone&&<div style={{fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</div>}
                        </div>;
                      })()}
                      {cr.salle&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>📍{cr.salle}</div>}
                    </> : (canCreate&&<div style={{fontSize:18,color:"#c7d7e9",textAlign:"center",lineHeight:"40px"}}>+</div>)}
                  </td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
        <p style={{fontSize:11,color:"#9ca3af",marginTop:8}}>💡 Cliquez sur une cellule pour ajouter ou modifier un créneau</p>
      </div>
    ) : (
      emploisClasse.length===0
        ? <Vide icone="📅" msg="Aucun créneau pour cette classe"/>
        : <Card style={{padding:0,overflow:"hidden"}}>{(()=>{
            const lignes=[...emploisClasse].sort((a,b)=>JOURS.indexOf(a.jour)-JOURS.indexOf(b.jour)||(a.heureDebut||"").localeCompare(b.heureDebut||""));
            const rows=[];let dernierJour=null;
            lignes.forEach(e=>{
              const jourChange=e.jour!==dernierJour;
              dernierJour=e.jour;
              rows.push(<TR key={e._id}>
                {jourChange
                  ? <TD bold style={{background:"#f0f4f8",verticalAlign:"top",whiteSpace:"nowrap",borderRight:"2px solid #e2e8f0"}}>{e.jour}</TD>
                  : <td style={{background:"#f8fafc",borderRight:"2px solid #e2e8f0",borderBottom:"1px solid #f1f5f9"}}></td>}
                <TD style={{whiteSpace:"nowrap"}}>{e.heureDebut} – {e.heureFin}</TD>
                <TD>
                  <span style={{background:e.type==="revision"?"#fff7ed":matCouleur[e.matiere]||"#e0ebf8",
                    border:e.type==="revision"?"1px solid #fdba74":"none",
                    padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,
                    color:e.type==="revision"?"#9a3412":"inherit"}}>
                    {e.matiere||"—"}
                  </span>
                </TD>
                <TD>
                  {e.type==="revision"
                    ? <span style={{background:"#fff7ed",border:"1px solid #fdba74",color:"#9a3412",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>
                        📝 Révision
                      </span>
                    : <span style={{color:"#9ca3af",fontSize:11}}>Cours</span>}
                </TD>
                <TD>{e.enseignant||<span style={{color:"#9ca3af",fontStyle:"italic"}}>—</span>}</TD>
                <TD>{e.salle||"—"}</TD>
                {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                  <Btn sm v="ghost" onClick={()=>{setForm({...e});setEdtCellule({jour:e.jour,heureDebut:e.heureDebut,heureFin:e.heureFin,existing:e});}}>Modifier</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEmp(e._id);}}>Suppr.</Btn>
                </div></TD>}
              </TR>);
            });
            return <table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Jour","Heure","Matière","Type","Enseignant","Salle",canEdit?"":""]}/>
              <tbody>{rows}</tbody>
            </table>;
          })()}
        </Card>
    )}

    <CelluleModale
      edtCellule={edtCellule} setEdtCellule={setEdtCellule} canCreate={canCreate} canEdit={canEdit}
      form={form} setForm={setForm} chg={chg}
      classeEdtActuelle={classeEdtActuelle} matieres={matieres} ens={ens} emplois={emplois} isPrimarySection={isPrimarySection}
      ajEmp={ajEmp} modEmp={modEmp} supEmp={supEmp} toast={toast}
    />

    <EdtGeneralModale
      edtGeneralOuvert={edtGeneralOuvert} setEdtGeneralOuvert={setEdtGeneralOuvert}
      classes={classes} classesTriees={classesTriees} emplois={emplois}
      TRANCHES={TRANCHES} nbTranches={nbTranches}
      matCouleur={matCouleur} findEns={findEns} schoolInfo={schoolInfo}
    />
  </div>;
}
