import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { Stat } from "./ui";

// ══════════════════════════════════════════════════════════════
//  RECHERCHE GLOBALE (Ctrl+K / ⌘K)
// ══════════════════════════════════════════════════════════════
function RechercheGlobale({modules, onNaviguer, onFermer}) {
  const {schoolInfo, moisAnnee} = useContext(SchoolContext);
  const {items:elevesC} = useFirestore("elevesCollege");
  const {items:elevesP} = useFirestore("elevesPrimaire");
  const {items:elevesL} = useFirestore("elevesLycee");
  const {items:ensP}    = useFirestore("ensPrimaire");
  const {items:ensC}    = useFirestore("ensCollege");
  const {items:ensL}    = useFirestore("ensLycee");
  const [q, setQ]       = useState("");
  const inputRef        = useRef(null);
  const [selIdx, setSelIdx] = useState(0);
  const [fiche, setFiche]   = useState(null); // {type:"élève"|"enseignant", data, section}

  useEffect(()=>{ if(!fiche) inputRef.current?.focus(); },[fiche]);

  const q2 = q.trim().toLowerCase();

  const resultats = useMemo(()=>{
    if(q2.length < 2) return modules.map(m=>({type:"module",label:m.label,sub:m.desc,icon:m.icon,data:null,section:m.id}));
    const r = [];
    modules.filter(m=>m.label.toLowerCase().includes(q2)||m.desc.toLowerCase().includes(q2))
      .forEach(m=>r.push({type:"module",label:m.label,sub:m.desc,icon:m.icon,data:null,section:m.id}));
    [...elevesC,...elevesP,...elevesL].filter(e=>
      `${e.nom} ${e.prenom} ${e.matricule||""} ${e.classe||""} ${e.ien||""}`.toLowerCase().includes(q2)
    ).slice(0,8).forEach(e=>{
      const section = elevesC.find(x=>x._id===e._id) ? "college"
        : elevesL.find(x=>x._id===e._id) ? "lycee" : "primaire";
      r.push({type:"élève",label:`${e.nom} ${e.prenom}`,sub:`${e.classe||""} · ${e.matricule||"—"}`,icon:"🎓",data:e,section});
    });
    [...ensP,...ensC,...ensL].filter(e=>
      `${e.nom} ${e.prenom||""} ${e.matiere||""} ${e.contact||""}`.toLowerCase().includes(q2)
    ).slice(0,5).forEach(e=>{
      const section = ensP.find(x=>x._id===e._id) ? "primaire"
        : ensL.find(x=>x._id===e._id) ? "lycee" : "college";
      r.push({type:"enseignant",label:`${e.nom}${e.prenom?" "+e.prenom:""}`,sub:e.matiere||"Enseignant",icon:"👨‍🏫",data:e,section});
    });
    return r;
  },[q2, modules, elevesC, elevesP, elevesL, ensP, ensC, ensL]);

  const executer = (res) => {
    if(!res) return;
    if(res.type==="module"){ onNaviguer(res.section); onFermer(); return; }
    setFiche(res); // afficher la fiche détaillée
  };

  const onKey = (e) => {
    if(fiche){ if(e.key==="Escape"){ setFiche(null); } return; }
    if(e.key==="ArrowDown"){ e.preventDefault(); setSelIdx(i=>Math.min(i+1,resultats.length-1)); }
    if(e.key==="ArrowUp")  { e.preventDefault(); setSelIdx(i=>Math.max(i-1,0)); }
    if(e.key==="Enter")    { e.preventDefault(); executer(resultats[selIdx]); }
    if(e.key==="Escape")   { onFermer(); }
  };

  const TYPE_COLOR = {module:"#6366f1",élève:"#0ea5e9",enseignant:"#10b981"};

  // ── Fiche élève ─────────────────────────────────────────────
  const FicheEleve = ({data, section}) => {
    const mens = data.mens || {};
    const mois = moisAnnee || [];
    const nbPayes = mois.filter(m=>mens[m]==="Payé").length;
    const nbTotal = mois.length;
    const sectionLabel = section==="college"?"Collège":section==="lycee"?"Lycée":"Primaire";
    const sectionColor = section==="college"?"#3b82f6":section==="lycee"?"#8b5cf6":"#10b981";
    return (
      <div>
        {/* En-tête */}
        <div style={{display:"flex",gap:16,alignItems:"center",padding:"20px 24px",background:"linear-gradient(135deg,#0A1628,#1e3a5f)"}}>
          <div style={{width:64,height:64,borderRadius:12,overflow:"hidden",border:"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {data.photo
              ? <img src={data.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontSize:28}}>👤</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:18,fontWeight:900,color:"#fff",lineHeight:1.2}}>{data.nom} {data.prenom}</div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              <span style={{background:sectionColor,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{sectionLabel}</span>
              <span style={{background:"rgba(255,255,255,0.15)",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{data.classe||"—"}</span>
              <span style={{background:data.statut==="Actif"?"#10b981":"#ef4444",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{data.statut||"Actif"}</span>
            </div>
          </div>
        </div>
        {/* Corps */}
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Identité */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {l:"Matricule",v:data.matricule,mono:true},
              {l:"IEN",v:data.ien,mono:true},
              {l:"Sexe",v:data.sexe==="M"?"Masculin":data.sexe==="F"?"Féminin":data.sexe||"—"},
              {l:"Date de naissance",v:data.dateNaissance||"—"},
              {l:"Lieu de naissance",v:data.lieuNaissance||"—"},
              {l:"Type d'inscription",v:data.typeInscription||"—"},
            ].map(({l,v,mono})=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",fontFamily:mono?"monospace":"inherit"}}>{v||"—"}</div>
              </div>
            ))}
          </div>
          {/* Famille */}
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:800,color:"#0369a1",marginBottom:8,textTransform:"uppercase"}}>👨‍👩‍👧 Famille & contact</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                {l:"Tuteur",v:data.tuteur},
                {l:"Contact",v:data.contactTuteur},
                {l:"Filiation",v:data.filiation},
                {l:"Domicile",v:data.domicile},
              ].map(({l,v})=>(
                <div key={l}>
                  <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{v||"—"}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Mensualités */}
          {nbTotal>0&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:800,color:"#15803d",textTransform:"uppercase"}}>💰 Mensualités</div>
              <div style={{fontSize:12,fontWeight:700,color:nbPayes===nbTotal?"#15803d":"#dc2626"}}>{nbPayes}/{nbTotal} payés</div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {mois.map(m=>{
                const paye=mens[m]==="Payé";
                return <span key={m} title={m} style={{
                  padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,
                  background:paye?"#dcfce7":"#fee2e2",color:paye?"#15803d":"#dc2626",
                  border:`1px solid ${paye?"#86efac":"#fca5a5"}`
                }}>{m.slice(0,3)} {paye?"✓":"✗"}</span>;
              })}
            </div>
          </div>}
          {/* Bouton naviguer */}
          <button onClick={()=>{ onNaviguer(section==="primaire"?"primaire":"secondaire"); onFermer(); }}
            style={{width:"100%",background:"#0A1628",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📂 Voir dans le module {sectionLabel} →
          </button>
        </div>
      </div>
    );
  };

  // ── Fiche enseignant ─────────────────────────────────────────
  const FicheEnseignant = ({data, section}) => {
    const sectionLabel = section==="primaire"?"Primaire":section==="lycee"?"Lycée":"Collège";
    const sectionColor = section==="college"?"#3b82f6":section==="lycee"?"#8b5cf6":"#10b981";
    const moduleTarget = section==="primaire"?"primaire":"secondaire";
    return (
      <div>
        {/* En-tête */}
        <div style={{display:"flex",gap:16,alignItems:"center",padding:"20px 24px",background:"linear-gradient(135deg,#064e3b,#065f46)"}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,0.15)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
            👨‍🏫
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:18,fontWeight:900,color:"#fff",lineHeight:1.2}}>{data.nom}{data.prenom?" "+data.prenom:""}</div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              <span style={{background:sectionColor,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{sectionLabel}</span>
              {data.matiere&&<span style={{background:"rgba(255,255,255,0.2)",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{data.matiere}</span>}
            </div>
          </div>
        </div>
        {/* Corps */}
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {l:"Matière",v:data.matiere},
              {l:"Contact",v:data.contact},
              {l:"Diplôme",v:data.diplome},
              {l:"Grade",v:data.grade},
              {l:"Statut",v:data.statut},
              {l:"Email",v:data.email},
              {l:"Adresse",v:data.adresse},
              {l:"Date d'embauche",v:data.dateEmbauche},
            ].filter(x=>x.v).map(({l,v})=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{v}</div>
              </div>
            ))}
          </div>
          {data.observation&&<div style={{background:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#854d0e",fontWeight:700,marginBottom:4}}>OBSERVATION</div>
            <div style={{fontSize:12,color:"#713f12"}}>{data.observation}</div>
          </div>}
          <button onClick={()=>{ onNaviguer(moduleTarget); onFermer(); }}
            style={{width:"100%",background:"#064e3b",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📂 Voir dans le module {sectionLabel} →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div onClick={onFermer} onKeyDown={onKey} tabIndex={-1}
      style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(10,22,40,0.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8vh",outline:"none"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:16,width:"min(640px,95vw)",
        boxShadow:"0 24px 80px rgba(0,0,0,0.35)",overflow:"hidden",
        animation:"fadeUp .15s ease",maxHeight:"85vh",display:"flex",flexDirection:"column",
      }}>
        {/* Barre de recherche */}
        {!fiche&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
          <span style={{fontSize:20,flexShrink:0}}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e=>{ setQ(e.target.value); setSelIdx(0); }}
            onKeyDown={onKey}
            placeholder="Rechercher un élève, enseignant, module…"
            style={{flex:1,border:"none",outline:"none",fontSize:16,color:"#0f172a",background:"transparent"}}
          />
          {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18,padding:"2px",lineHeight:1}}>✕</button>}
          <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#64748b",flexShrink:0}}>ESC</kbd>
        </div>}

        {/* En-tête fiche (retour) */}
        {fiche&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
          <button onClick={()=>setFiche(null)}
            style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,color:"#334155",cursor:"pointer"}}>
            ← Retour
          </button>
          <span style={{fontSize:13,color:"#64748b"}}>{fiche.label}</span>
          <button onClick={onFermer} style={{marginLeft:"auto",background:"none",border:"none",color:"#94a3b8",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>}

        {/* Résultats */}
        {!fiche&&<div style={{flex:1,overflowY:"auto"}}>
          {resultats.length===0&&<div style={{padding:"32px 20px",textAlign:"center",color:"#94a3b8",fontSize:14}}>Aucun résultat pour « {q} »</div>}
          {resultats.map((r,i)=>(
            <div key={i} onMouseEnter={()=>setSelIdx(i)} onClick={()=>executer(r)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",cursor:"pointer",
                background:i===selIdx?"#f0f6ff":"transparent",
                borderLeft:i===selIdx?"3px solid #0A1628":"3px solid transparent",
                transition:"background .1s",
              }}>
              <span style={{fontSize:20,flexShrink:0}}>{r.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:"#0f172a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.label}</div>
                <div style={{fontSize:12,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.sub}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <span style={{background:TYPE_COLOR[r.type]||"#94a3b8",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,textTransform:"capitalize"}}>{r.type}</span>
                {r.type!=="module"&&<span style={{fontSize:12,color:"#94a3b8"}}>›</span>}
              </div>
            </div>
          ))}
        </div>}

        {/* Fiche détaillée */}
        {fiche&&<div style={{flex:1,overflowY:"auto"}}>
          {fiche.type==="élève"&&<FicheEleve data={fiche.data} section={fiche.section}/>}
          {fiche.type==="enseignant"&&<FicheEnseignant data={fiche.data} section={fiche.section}/>}
        </div>}

        {/* Footer */}
        {!fiche&&<div style={{padding:"8px 20px",borderTop:"1px solid #f1f5f9",display:"flex",gap:16,fontSize:11,color:"#94a3b8",flexShrink:0}}>
          <span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Échap fermer</span>
          <span style={{marginLeft:"auto"}}>Ctrl+K pour rouvrir</span>
        </div>}
      </div>
    </div>
  );
}

export { RechercheGlobale };
