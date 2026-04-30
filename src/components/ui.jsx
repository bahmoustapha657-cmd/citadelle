import React, { useState, useRef, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { C, today } from "../constants";
import { uploadFichier } from "../storageUtils";

// ══════════════════════════════════════════════════════════════
//  COMPOSANTS UI
// ══════════════════════════════════════════════════════════════
const Badge = ({children,color="gray"}) => {
  const M={
    green:  "#d1fae5;#065f46",
    red:    "#fee2e2;#991b1b",
    blue:   "#dbeafe;#1e40af",
    amber:  "#fef3c7;#92400e",
    gray:   "#f3f4f6;#4b5563",
    purple: "#ede9fe;#6d28d9",
    teal:   "#ccfbf1;#0f766e",
    vert:   "#d1fae5;#065f46",
    orange: "#ffedd5;#9a3412",
  };
  const [bg,cl]=(M[color]||M.gray).split(";");
  return <span style={{background:bg,color:cl,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap",letterSpacing:"0.02em"}}>{children}</span>;
};

const Card=({children,style})=><div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(10,22,40,0.06)",...style}}>{children}</div>;

const Modale=({titre,fermer,children,large,xlarge})=>(
  <div className="lc-modal-overlay" style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(10,22,40,0.6)",backdropFilter:"blur(4px)"}}>
    <div className="lc-modal-box" style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:xlarge?1100:large?820:540,margin:"0 14px",maxHeight:"93dvh",overflowY:"auto",boxShadow:"0 20px 60px rgba(10,22,40,0.35)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",background:`linear-gradient(135deg,${C.blue},#1a3a6b)`,borderRadius:"18px 18px 0 0",position:"sticky",top:0,zIndex:1}}>
        <strong style={{fontSize:14,color:"#fff",letterSpacing:"0.02em"}}>{titre}</strong>
        <button onClick={fermer} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",width:30,height:30,borderRadius:"50%",cursor:"pointer",color:"#fff",fontSize:18,lineHeight:"28px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      <div style={{padding:"22px"}}>{children}</div>
    </div>
  </div>
);

const Champ=({label,children})=>(
  <div>
    <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{label}</label>
    {children}
  </div>
);
const Input=({label,...p})=><Champ label={label}><input style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#fafbfc",transition:"border-color .15s"}} {...p}/></Champ>;
const Selec=({label,children,...p})=><Champ label={label}><select style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,background:"#fafbfc",boxSizing:"border-box",outline:"none",transition:"border-color .15s"}} {...p}>{children}</select></Champ>;
const Textarea=({label,...p})=><Champ label={label}><textarea style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,boxSizing:"border-box",outline:"none",resize:"vertical",minHeight:80,background:"#fafbfc"}} {...p}/></Champ>;

const Btn=({children,v="primary",sm,...p})=>{
  const S={
    primary:{background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))",color:"#fff"},
    success:{background:`linear-gradient(135deg,${C.greenDk},${C.green})`,color:"#fff"},
    danger: {background:"linear-gradient(135deg,#991b1b,#b91c1c)",color:"#fff"},
    ghost:  {background:"#fff",color:"var(--sc1)",border:"1.5px solid #e2e8f0"},
    amber:  {background:"linear-gradient(135deg,#b45309,#d97706)",color:"#fff"},
    vert:   {background:"linear-gradient(135deg,var(--sc2-dk),var(--sc2))",color:"#fff"},
    red:    {background:"linear-gradient(135deg,#991b1b,#b91c1c)",color:"#fff"},
    purple: {background:"linear-gradient(135deg,#6d28d9,#7c3aed)",color:"#fff"},
    orange: {background:"linear-gradient(135deg,#c2410c,#ea580c)",color:"#fff"},
  };
  return <button style={{...S[v]||S.primary,border:"none",padding:sm?"4px 12px":"8px 18px",borderRadius:8,fontSize:sm?11:13,fontWeight:700,cursor:"pointer",letterSpacing:"0.01em",...(p.disabled?{opacity:0.5,cursor:"not-allowed"}:{})}} {...p}>{children}</button>;
};

const THead=({cols})=>(
  <thead><tr style={{background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))"}}>
    {cols.map((c,i)=><th key={i} style={{textAlign:"left",padding:"10px 13px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap",borderBottom:"2px solid var(--sc2)"}}>{c}</th>)}
  </tr></thead>
);
const TR=({children,bg})=><tr style={{borderBottom:"1px solid #f1f5f9",background:bg||"transparent"}}>{children}</tr>;
const TD=({children,bold,center,style})=><td style={{padding:"10px 13px",fontSize:13,color:bold?C.blueDark:"#374151",fontWeight:bold?700:400,verticalAlign:"middle",textAlign:center?"center":"left",...style}}>{children}</td>;

const Stat=({label,value,sub,bg})=>(
  <div style={{background:bg||"#fff",borderRadius:12,padding:"14px 18px",border:"1px solid #e2e8f0",boxShadow:"0 1px 4px rgba(10,22,40,0.06)"}}>
    <p style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",margin:"0 0 4px",letterSpacing:"0.08em"}}>{label}</p>
    <p style={{fontSize:21,fontWeight:800,color:C.blueDark,margin:"0 0 2px",lineHeight:1.1}}>{value}</p>
    {sub&&<p style={{fontSize:11,color:"#94a3b8",margin:0}}>{sub}</p>}
  </div>
);

const Tabs=({items,actif,onChange})=>(
  <div style={{display:"flex",gap:3,marginBottom:18,background:"#e2e8f0",padding:4,borderRadius:12,flexWrap:"wrap"}}>
    {items.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{padding:"7px 15px",borderRadius:9,fontSize:12,fontWeight:700,border:"none",cursor:"pointer",
      background:actif===t.id?`linear-gradient(135deg,${C.greenDk},${C.green})`:"transparent",
      color:actif===t.id?"#fff":C.blue,
      boxShadow:actif===t.id?"0 2px 8px rgba(0,168,118,0.35)":"none",whiteSpace:"nowrap",
      transition:"all .15s"}}>{t.label}</button>)}
  </div>
);

const Vide=({icone,msg})=>(
  <div style={{textAlign:"center",padding:"56px 20px",background:"#fff",borderRadius:14,border:"2px dashed #e2e8f0"}}>
    <div style={{fontSize:44,marginBottom:12,filter:"grayscale(0.2)"}}>{icone}</div>
    <p style={{fontSize:15,fontWeight:800,color:C.blue,margin:"0 0 6px"}}>{msg}</p>
    <p style={{fontSize:12,color:"#94a3b8",margin:0}}>Utilisez le bouton ci-dessus pour ajouter des données.</p>
  </div>
);

// ── Skeleton de base ──────────────────────────────────────────
const Sk=({w="100%",h=14,r=6,mb=0})=>(
  <div className="lc-skeleton" style={{width:w,height:h,borderRadius:r,marginBottom:mb,flexShrink:0}}/>
);

// Skeleton tableau (listes, tables)
const SkeletonTable=({rows=5})=>(
  <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0ebf8",overflow:"hidden"}}>
    {/* En-tête */}
    <div style={{display:"flex",gap:12,padding:"12px 18px",borderBottom:"2px solid #e0ebf8",background:"#f8fafc"}}>
      {[30,20,20,20].map((w,i)=><Sk key={i} w={`${w}%`} h={11}/>)}
    </div>
    {/* Lignes */}
    {Array.from({length:rows}).map((_,i)=>(
      <div key={i} style={{display:"flex",gap:12,padding:"13px 18px",borderBottom:"1px solid #f1f5f9",alignItems:"center"}}>
        <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0}} className="lc-skeleton"/>
        <Sk w="25%" h={12}/>
        <Sk w="18%" h={12}/>
        <Sk w="18%" h={12}/>
        <Sk w="18%" h={20} r={10}/>
      </div>
    ))}
  </div>
);

// Skeleton cartes KPI (tableau de bord)
const SkeletonKPI=({cols=4})=>(
  <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:12}}>
    {Array.from({length:cols}).map((_,i)=>(
      <div key={i} style={{background:"#e8f0f7",borderRadius:14,padding:"18px 20px"}}>
        <Sk w="55%" h={10} mb={10}/>
        <Sk w="70%" h={28} mb={8}/>
        <Sk w="40%" h={10}/>
      </div>
    ))}
  </div>
);

// Skeleton liste (historique, messages, événements)
const SkeletonListe=({rows=4})=>(
  <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0ebf8",overflow:"hidden"}}>
    {Array.from({length:rows}).map((_,i)=>(
      <div key={i} style={{display:"flex",gap:12,padding:"14px 18px",borderBottom:"1px solid #f1f5f9",alignItems:"flex-start"}}>
        <div style={{width:36,height:36,borderRadius:10,flexShrink:0}} className="lc-skeleton"/>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
          <Sk w="45%" h={12}/>
          <Sk w="70%" h={10}/>
        </div>
        <Sk w="15%" h={10}/>
      </div>
    ))}
  </div>
);

// Chargement générique (garde le spinner pour les cas simples)
const Chargement=({type="table",rows,cols})=>{
  if(type==="kpi")    return <div style={{padding:"22px 26px"}}><SkeletonKPI cols={cols||4}/></div>;
  if(type==="liste")  return <SkeletonListe rows={rows||4}/>;
  return <SkeletonTable rows={rows||5}/>;
};

const LectureSeule=()=>(
  <div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",borderRadius:10,padding:"11px 16px",fontSize:13,color:"#92400e",marginBottom:16,display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
    <span style={{fontSize:20}}>👁️</span>
    <span><strong>Mode lecture seule</strong> — vous pouvez consulter mais pas modifier.</span>
  </div>
);

// ══════════════════════════════════════════════════════════════
//  UPLOAD FICHIERS COMPONENT
// ══════════════════════════════════════════════════════════════
function UploadFichiers({dossier, fichiers=[], onAjouter, onSupprimer, readOnly=false}) {
  const {toast, schoolId} = useContext(SchoolContext);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { toast("Fichier trop grand (max 5MB)","warning"); return; }
    if (!schoolId) { toast("Session école manquante.","error"); return; }
    setUploading(true);
    try {
      const url = await uploadFichier(file, `ecoles/${schoolId}/${dossier}/${Date.now()}_${file.name}`);
      onAjouter({nom: file.name, url, type: file.type, date: today()});
    } catch(e) {
      toast("Erreur upload: " + e.message,"error");
    }
    setUploading(false);
    inputRef.current.value = "";
  };

  const icone = (type) => {
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("image")) return "🖼️";
    if (type?.includes("word") || type?.includes("document")) return "📝";
    return "📎";
  };

  return (
    <div style={{marginTop:12}}>
      <p style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Documents attachés</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
        {fichiers.map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"#e0ebf8",borderRadius:8,padding:"5px 10px"}}>
            <span style={{fontSize:14}}>{icone(f.type)}</span>
            <a href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:C.blue,fontWeight:600,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</a>
            <span style={{fontSize:10,color:"#9ca3af"}}>{f.date}</span>
            {!readOnly && <button onClick={()=>onSupprimer(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#b91c1c",fontSize:14,lineHeight:1}}>×</button>}
          </div>
        ))}
        {fichiers.length===0 && <span style={{fontSize:12,color:"#9ca3af"}}>Aucun document</span>}
      </div>
      {!readOnly && (
        <>
          <input ref={inputRef} type="file" onChange={handleUpload} style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/>
          <Btn sm v="ghost" onClick={()=>inputRef.current.click()} disabled={uploading}>
            {uploading ? "⏳ Upload..." : "📎 Joindre un fichier"}
          </Btn>
          <span style={{fontSize:10,color:"#9ca3af",marginLeft:8}}>PDF, images, Word (max 5MB)</span>
        </>
      )}
    </div>
  );
}

export {
  Badge, Card, Modale, Champ, Input, Selec, Textarea, Btn,
  THead, TR, TD, Stat, Tabs, Vide,
  Sk, SkeletonTable, SkeletonKPI, SkeletonListe, Chargement,
  LectureSeule, UploadFichiers,
};
