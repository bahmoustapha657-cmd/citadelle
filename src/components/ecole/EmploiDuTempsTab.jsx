import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Btn, Card, Modale, Input, Selec, THead, TR, TD, Vide, Chargement } from "../ui";
import { enteteDoc } from "../../reports";
import { getEligibleTeachersForTimetable } from "../../teacher-utils";

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

  const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const genTranches = (step) => {
    const [sh, sm] = (edtHeureDebut || "08:00").split(":").map(Number);
    const [eh, em] = (edtHeureFin || "14:00").split(":").map(Number);
    const t = [];
    let h = sh, m = sm;
    while (h * 60 + m <= eh * 60 + em) {
      t.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
      m += step;
      h += Math.floor(m / 60);
      m = m % 60;
    }
    return t;
  };
  const duree = maxNote === 10 ? edtDuree : 120;
  const TRANCHES = genTranches(duree);
  const COULEURS = ["#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#f3e8ff", "#ffedd5", "#e0f2fe", "#d1fae5", "#fce7f3", "#ecfdf5"];
  const NIVEAUX_ORDER = [
    "maternelle", "ps", "ms", "gs", "petite section", "moyenne section", "grande section",
    "cp", "cp1", "cp2",
    "ce", "ce1", "ce2",
    "cm", "cm1", "cm2",
    "6ème", "6e", "6", "6eme",
    "5ème", "5e", "5", "5eme",
    "4ème", "4e", "4", "4eme",
    "3ème", "3e", "3", "3eme",
    "7ème", "7e", "7", "7eme",
    "8ème", "8e", "8", "8eme",
    "9ème", "9e", "9", "9eme",
    "10ème", "10e", "10", "10eme",
    "11ème", "11e", "11", "11eme",
    "seconde", "2nde", "2nd",
    "12ème", "12e", "12", "12eme",
    "première", "premiere", "1ère", "1ere",
    "13ème", "13e", "13", "13eme",
    "terminale", "tle", "term",
  ];
  const niveauRank = (nom) => {
    const n = (nom || "").toLowerCase().trim();
    const idx = NIVEAUX_ORDER.findIndex((o) => n === o || n.startsWith(o + " ") || n.startsWith(o + "-") || n.startsWith(o + "_"));
    if (idx >= 0) return idx * 10;
    const m = n.match(/^(\d+)/);
    if (m) return 500 + parseInt(m[1]);
    return 999;
  };
  const classesTriees = [...classes].sort((a, b) => niveauRank(a.nom) - niveauRank(b.nom));
  const classeEdtActuelle = filtreClasse === "all" && classesTriees.length > 0 ? classesTriees[0].nom : filtreClasse;
  const matCouleur = {};
  matieres.forEach((m, i) => { matCouleur[m.nom] = COULEURS[i % COULEURS.length]; });
  const findEns = (nomStr) => ens.find((e) => {
    if (!nomStr) return false;
    const full = `${e.prenom || ""} ${e.nom || ""}`.trim();
    return nomStr === full || nomStr.startsWith(full + " (");
  });
  const affNom = (nomStr) => nomStr ? nomStr.replace(/\s*\([^)]*\)$/, "") : "";
  const emploisClasse = emplois.filter((e) => e.classe === classeEdtActuelle);
  const getCreneau = (jour, hd) => emploisClasse.find((e) => e.jour === jour && e.heureDebut === hd);

  const imprimerEDT = () => {
    const couleursBg = ["#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#f3e8ff", "#ffedd5", "#e0f2fe", "#d1fae5", "#fce7f3", "#ecfdf5"];
    const allMat = [...new Set(emploisClasse.map((e) => e.matiere).filter(Boolean))];
    const mc = {}; allMat.forEach((m, i) => { mc[m] = couleursBg[i % couleursBg.length]; });
    const getCr = (jour, hd) => emploisClasse.find((e) => e.jour === jour && e.heureDebut === hd);
    const ths = JOURS.map((j) => "<th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;text-align:center;min-width:80px'>" + j + "</th>").join("");
    const rows = TRANCHES.slice(0, -1).map((_, i) => {
      const hd = TRANCHES[i], hf = TRANCHES[i + 1];
      const tds = JOURS.map((jour) => {
        const cr = getCr(jour, hd);
        if (!cr) return "<td style='background:#fafcff;border:1px solid #e2e8f0;padding:6px'></td>";
        const isRev = cr.type === "revision";
        const bg = isRev ? "#fff7ed" : (mc[cr.matiere] || "#e0ebf8");
        const borderColor = isRev ? "#fdba74" : "#e2e8f0";
        const ensObj = findEns(cr.enseignant);
        return "<td style='background:" + bg + ";border:1px solid " + borderColor + ";padding:6px;vertical-align:top'>"
          + (isRev ? "<span style='background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-block;margin-bottom:2px'>RÉV</span><br>" : "")
          + "<b style='font-size:11px;color:" + (isRev ? "#9a3412" : "#1e3a5f") + ";display:block'>" + cr.matiere + "</b>"
          + (cr.enseignant ? "<span style='font-size:10px;color:#475569'>" + affNom(cr.enseignant) + "</span>" : "")
          + (ensObj?.telephone ? "<br><span style='font-size:9px;color:#00876a;font-weight:600'>" + ensObj.telephone + "</span>" : "")
          + (cr.salle ? "<br><span style='font-size:9px;color:#94a3b8'>📍" + cr.salle + "</span>" : "")
          + "</td>";
      }).join("");
      return "<tr><td style='background:#f0f4f8;font-weight:700;font-size:11px;color:#0A1628;padding:7px 10px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap'>" + hd.slice(0, 5) + "–" + hf.slice(0, 5) + "</td>" + tds + "</tr>";
    }).join("");
    const w = window.open("", "_blank");
    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT " + classeEdtActuelle + "</title>"
      + "<style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}}body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;margin:0}h2{color:#0A1628;text-align:center;margin-bottom:12px}"
      + "table{width:100%;border-collapse:collapse}</style></head><body>"
      + enteteDoc(schoolInfo, schoolInfo.logo)
      + "<h2>Emploi du temps — " + classeEdtActuelle + "</h2>"
      + "<table><thead><tr><th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;width:80px'>Horaire</th>" + ths + "</tr></thead>"
      + "<tbody>" + rows + "</tbody></table>"
      + "<scri" + "pt>window.onload=()=>window.print();</scri" + "pt></body></html>");
    w.document.close();
  };

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

  const SOUS_LABELS = ["Matière", "Enseignant", "Salle"];
  const nbTranches = TRANCHES.length - 1;
  const nbSousLignes = (ti) => ti === 9 ? 4 : 3;
  const totalLignesClasse = () => { let t = 0; for (let i = 0; i < nbTranches; i++) t += nbSousLignes(i); return t; };

  const getEdtGeneralHTML = () => {
    const couleursBg = ["#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#f3e8ff", "#ffedd5", "#e0f2fe", "#d1fae5", "#fce7f3", "#ecfdf5"];
    const allMat = [...new Set(emplois.map((e) => e.matiere).filter(Boolean))];
    const mc = {}; allMat.forEach((m, i) => { mc[m] = couleursBg[i % couleursBg.length]; });
    const ths = JOURS.map((j) => "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;text-align:center;min-width:90px'>" + j + "</th>").join("");
    const subLabelStyle = "background:#f8fafc;color:#94a3b8;font-size:9px;padding:2px 6px;text-align:right;border:1px solid #e8edf2;white-space:nowrap;font-style:italic";
    const hrStyle = "background:#f0f4f8;font-weight:800;font-size:11px;color:#0A1628;padding:5px 7px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap;vertical-align:middle";
    const clsStyle = "background:#0A1628;color:#00C48C;font-weight:800;font-size:12px;text-align:center;padding:6px 8px;border:2px solid #0A1628;vertical-align:middle;writing-mode:horizontal-tb";
    const legendStyle = "display:inline-flex;align-items:center;gap:8px;margin:0 10px 8px 0;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:700";
    const coursLegend = legendStyle + ";background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe";
    const revisionLegend = legendStyle + ";background:#fff7ed;color:#9a3412;border:1px solid #fdba74";
    let tbody = "";
    classesTriees.forEach((cl) => {
      const total = totalLignesClasse();
      let firstRowOfClass = true;
      for (let ti = 0; ti < nbTranches; ti++) {
        const hd = TRANCHES[ti], hf = TRANCHES[ti + 1];
        const ns = nbSousLignes(ti);
        for (let si = 0; si < ns; si++) {
          const isLastSub = si === ns - 1;
          const isLastSlot = ti === nbTranches - 1;
          const borderB = isLastSub ? (isLastSlot ? "3px solid #0A1628" : "2px solid #b0c4d8") : "1px solid #f0f4f8";
          let row = "<tr>";
          if (firstRowOfClass && si === 0) { row += "<td rowspan='" + total + "' style='" + clsStyle + "'>" + cl.nom + "</td>"; firstRowOfClass = false; }
          if (si === 0) row += "<td rowspan='" + ns + "' style='" + hrStyle + "'>" + hd.slice(0, 5) + "<br>" + hf.slice(0, 5) + "</td>";
          row += "<td style='" + subLabelStyle + ";border-bottom:" + borderB + "'>" + (SOUS_LABELS[si] || "") + "</td>";
          JOURS.forEach((jour) => {
            const cr = emplois.find((e) => e.classe === cl.nom && e.jour === jour && e.heureDebut === hd);
            const isRevision = cr?.type === "revision";
            const bg = cr ? (isRevision ? "#fff7ed" : (mc[cr.matiere] || "#e0ebf8")) : "#fff";
            const color = isRevision ? "#9a3412" : "#0A1628";
            const border = isRevision ? "2px solid #fdba74" : "1px solid #e2e8f0";
            let val = "";
            if (cr) {
              if (si === 0) {
                const badge = isRevision ? "<div style='margin-bottom:3px'><span style=\"display:inline-block;background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:2px 5px;border-radius:999px;letter-spacing:.3px\">RÉVISION</span></div>" : "";
                val = badge + "<b>" + cr.matiere + "</b>";
              }
              else if (si === 1) {
                const ensObj = findEns(cr.enseignant);
                val = affNom(cr.enseignant || "") + (ensObj?.telephone ? "<br><span style='font-size:9px;color:#00876a;font-weight:600'>" + ensObj.telephone + "</span>" : "");
              }
              else if (si === 2) val = cr.salle || "";
            }
            row += "<td style='background:" + bg + ";color:" + color + ";border:" + border + ";border-bottom:" + borderB + ";padding:2px 5px;font-size:10px;text-align:center;vertical-align:middle'>" + val + "</td>";
          });
          row += "</tr>";
          tbody += row;
        }
      }
    });
    return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT Général</title>"
      + "<style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}.no-print{display:none}}"
      + "body{font-family:Arial,sans-serif;padding:10mm;font-size:11px;color:#0A1628;margin:0}"
      + "h2{text-align:center;font-size:14px;margin-bottom:10px}"
      + "table{width:100%;border-collapse:collapse}</style></head><body>"
      + enteteDoc(schoolInfo, schoolInfo.logo)
      + "<h2>Emploi du Temps Général</h2>"
      + "<div style='text-align:center;margin:-2px 0 12px'>"
      + "<span style='" + coursLegend + "'>Cours ordinaires</span>"
      + "<span style='" + revisionLegend + "'>Cours de révision</span>"
      + "</div>"
      + "<div class='no-print' style='text-align:center;margin-bottom:12px'>"
      + "<button onclick='window.print()' style='background:#0A1628;color:#fff;border:none;padding:7px 22px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:700'>🖨️ Imprimer</button></div>"
      + "<table><thead><tr>"
      + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:70px'>Classes</th>"
      + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:60px'>Horaires</th>"
      + "<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:10px;min-width:50px'></th>"
      + ths
      + "</tr></thead><tbody>" + tbody + "</tbody></table>"
      + "<scri" + "pt>window.onload=()=>window.print();</script></body></html>";
  };
  const voirEdtGeneral = () => {
    const w = window.open("", "_blank");
    w.document.write(getEdtGeneralHTML());
    w.document.close();
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
      {classeEdtActuelle!=="all"&&<Btn sm v="ghost" onClick={imprimerEDT}>🖨️ Imprimer</Btn>}
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

    {/* ── MINI MODAL CELLULE ── */}
    {edtCellule&&(canCreate||canEdit)&&<Modale
      titre={edtCellule.existing?"Modifier le créneau":"Nouveau créneau"}
      fermer={()=>setEdtCellule(null)}>
      <div style={{marginBottom:12,padding:"8px 12px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark,display:"flex",gap:16,flexWrap:"wrap"}}>
        <span>📅 <strong>{edtCellule.jour}</strong></span>
        <span>⏰ <strong>{edtCellule.heureDebut} → {edtCellule.heureFin}</strong></span>
        <span>🏫 <strong>{form.classe||classeEdtActuelle}</strong></span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{v:"cours",label:"📚 Cours"},{v:"revision",label:"📝 Révision"}].map(t=>(
          <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
            style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
              background:(form.type||"cours")===t.v?(t.v==="revision"?"#fff7ed":"#eff6ff"):"#f9fafb",
              border:`2px solid ${(form.type||"cours")===t.v?(t.v==="revision"?"#f97316":"#3b82f6"):"#e5e7eb"}`,
              color:(form.type||"cours")===t.v?(t.v==="revision"?"#9a3412":"#1d4ed8"):"#6b7280"}}>
            {t.label}
          </button>
        ))}
      </div>

      {(form.type||"cours")==="revision"&&(
        <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>📝</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:"#9a3412",marginBottom:4}}>Prime horaire révision</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" value={form.primeRevision||""}
                onChange={e=>setForm(p=>({...p,primeRevision:e.target.value}))}
                placeholder="Ex : 50000"
                style={{border:"1px solid #fdba74",borderRadius:6,padding:"6px 10px",fontSize:13,width:140,background:"#fff"}}/>
              <span style={{fontSize:12,color:"#c2410c",fontWeight:600}}>GNF / heure</span>
            </div>
            <div style={{fontSize:11,color:"#c2410c",marginTop:4}}>Cette prime remplace la prime horaire normale pour ce créneau.</div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Selec label="Matière" value={form.matiere||""} onChange={e=>{setForm(p=>({...p,matiere:e.target.value,enseignant:""}));}}>
          <option value="">— Sélectionner —</option>
          {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
        </Selec>
        {(()=>{
          const ensOccupes=emplois
            .filter(x=>x.jour===edtCellule.jour&&x.heureDebut===edtCellule.heureDebut
              &&(!edtCellule.existing||x._id!==edtCellule.existing._id)&&x.enseignant)
            .map(x=>x.enseignant);
          const ensFiltres=getEligibleTeachersForTimetable(ens,{
            classe: form.classe||classeEdtActuelle,
            matiere: form.matiere||"",
            isPrimary: isPrimarySection,
          });
          return <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
            <option value="">— Sélectionner —</option>
            {ensFiltres.map(e=>{
              const nomSimple=`${e.prenom} ${e.nom}`.trim();
              const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`;
              const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
              const label=`${nomSimple}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
              return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
            })}
          </Selec>;
        })()}
        <Input label="Salle (optionnel)" value={form.salle||""} onChange={chg("salle")}/>
        <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
          <Input label="Début" type="time" value={form.heureDebut||edtCellule.heureDebut} onChange={chg("heureDebut")}/>
          <Input label="Fin" type="time" value={form.heureFin||edtCellule.heureFin} onChange={chg("heureFin")}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
        <div>
          {edtCellule.existing&&canEdit&&<Btn v="danger" onClick={()=>{supEmp(edtCellule.existing._id);setEdtCellule(null);}}>🗑 Supprimer</Btn>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setEdtCellule(null)}>Annuler</Btn>
          <Btn onClick={()=>{
            if(!form.matiere){toast("Choisissez une matière.","warning");return;}
            if(!form.enseignant){toast("Choisissez un enseignant.","warning");return;}
            const typeCreneaux=form.type||"cours";
            const data={
              classe:form.classe||classeEdtActuelle,
              jour:edtCellule.jour,
              heureDebut:form.heureDebut||edtCellule.heureDebut,
              heureFin:form.heureFin||edtCellule.heureFin,
              matiere:form.matiere,
              enseignant:form.enseignant||"",
              salle:form.salle||"",
              type:typeCreneaux,
              primeRevision:typeCreneaux==="revision"?Number(form.primeRevision||0):null,
            };
            if(edtCellule.existing)modEmp({...data,_id:edtCellule.existing._id});
            else ajEmp(data);
            setEdtCellule(null);
          }}>✅ Enregistrer</Btn>
        </div>
      </div>
    </Modale>}

    {/* ── MODAL EDT GÉNÉRAL ── */}
    {edtGeneralOuvert&&<Modale titre="📊 Emploi du Temps Général" fermer={()=>setEdtGeneralOuvert(false)}>
      <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:12,color:"#64748b"}}>{classes.length} classe(s) · {emplois.length} créneaux</span>
        <Btn onClick={voirEdtGeneral}>🖨️ Imprimer / PDF</Btn>
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
                const total=totalLignesClasse();
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
    </Modale>}
  </div>;
}
