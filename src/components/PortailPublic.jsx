import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { Stat } from "./ui";

function PortailPublic({onConnexion}) {
  const {schoolInfo} = useContext(SchoolContext);
  const {items:annonces} = useFirestore("annonces");
  const {items:honneurs} = useFirestore("honneurs");

  const acc = schoolInfo.accueil || {};
  const c1  = schoolInfo.couleur1 || "#0A1628";
  const c2  = schoolInfo.couleur2 || "#00C48C";
  const [galIndex, setGalIndex] = useState(null); // lightbox
  const photos = acc.photos || [];
  const annoncesPub = annonces.filter(a=>a.date).sort((a,b)=>b.date-a.date).slice(0,4);

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Inter','Segoe UI',sans-serif",color:"#0A1628"}}>
      <GlobalStyles/>

      {/* ── HERO ── */}
      <div style={{
        position:"relative",minHeight:"100vh",display:"flex",flexDirection:"column",
        justifyContent:"center",alignItems:"center",textAlign:"center",
        overflow:"hidden",padding:"80px 24px 60px",
      }}>
        {/* Fond */}
        {acc.bannerUrl
          ? <div style={{position:"absolute",inset:0,backgroundImage:`url(${acc.bannerUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(0.35)"}}/>
          : <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,${c1} 0%,${c1}ee 50%,${c2}44 100%)`}}/>
        }
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.25)"}}/>

        {/* Contenu hero */}
        <div style={{position:"relative",zIndex:1,maxWidth:680}}>
          {schoolInfo.logo&&<img src={schoolInfo.logo} alt="logo"
            style={{width:110,height:110,objectFit:"contain",borderRadius:20,
              background:"rgba(255,255,255,0.12)",padding:12,marginBottom:24,
              boxShadow:"0 8px 32px rgba(0,0,0,0.3)",backdropFilter:"blur(4px)"}}/>}

          {schoolInfo.ministere&&<div style={{display:"inline-block",fontSize:10,fontWeight:700,
            letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,0.55)",marginBottom:12}}>
            {schoolInfo.ministere} {schoolInfo.ire&&`· ${schoolInfo.ire}`}
          </div>}

          <h1 style={{margin:"0 0 8px",fontSize:"clamp(28px,5vw,52px)",fontWeight:900,
            color:"#fff",letterSpacing:-1,lineHeight:1.1,textShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
            {schoolInfo.nom||"Notre École"}
          </h1>
          <div style={{color:c2,fontSize:"clamp(12px,2vw,14px)",fontWeight:700,letterSpacing:1,
            textTransform:"uppercase",marginBottom:16}}>
            {schoolInfo.type||"Établissement scolaire privé"} · {schoolInfo.ville||""}
          </div>

          {acc.slogan&&<p style={{fontSize:"clamp(14px,2.5vw,20px)",fontWeight:300,
            color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:8,fontStyle:"italic"}}>
            « {acc.slogan} »
          </p>}
          {schoolInfo.devise&&!acc.slogan&&<p style={{fontSize:16,color:"rgba(255,255,255,0.6)",
            marginBottom:8,fontStyle:"italic"}}>« {schoolInfo.devise} »</p>}

          {acc.texteAccueil&&<p style={{fontSize:14,color:"rgba(255,255,255,0.65)",
            lineHeight:1.7,maxWidth:520,margin:"16px auto 0"}}>{acc.texteAccueil}</p>}

          <div style={{marginTop:36,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={onConnexion} style={{
              background:c2,color:"#fff",border:"none",
              padding:"14px 36px",borderRadius:30,fontSize:15,fontWeight:800,
              cursor:"pointer",boxShadow:`0 6px 20px ${c2}55`,
              transition:"transform .15s,box-shadow .15s",letterSpacing:0.3,
            }}
            onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow=`0 10px 28px ${c2}66`;}}
            onMouseLeave={e=>{e.target.style.transform="";e.target.style.boxShadow=`0 6px 20px ${c2}55`;}}>
              🔐 Se connecter
            </button>
            {acc.whatsapp&&<a href={`https://wa.me/${acc.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
              style={{background:"rgba(255,255,255,0.12)",color:"#fff",border:"1px solid rgba(255,255,255,0.25)",
                padding:"14px 28px",borderRadius:30,fontSize:14,fontWeight:700,
                cursor:"pointer",textDecoration:"none"}}>
              💬 WhatsApp
            </a>}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",
          color:"rgba(255,255,255,0.3)",fontSize:20,animation:"bounce 2s infinite"}}>↓</div>
        <style>{`@keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8px)}}`}</style>
      </div>

      {/* ── ANNONCES ── */}
      {acc.showAnnonces&&annoncesPub.length>0&&(
        <div style={{padding:"60px 24px",background:"#fff"}}>
          <div style={{maxWidth:900,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:36}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:c2,marginBottom:8}}>Actualités</div>
              <h2 style={{margin:0,fontSize:"clamp(22px,4vw,32px)",fontWeight:900,color:c1}}>Annonces de l'école</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
              {annoncesPub.map((an,i)=>(
                <div key={i} style={{
                  background:an.important?"linear-gradient(135deg,#fefce8,#fff)":"#f8fafc",
                  border:`1px solid ${an.important?"#fcd34d":"#e2e8f0"}`,
                  borderTop:`4px solid ${an.important?"#f59e0b":c1}`,
                  borderRadius:12,padding:"20px 22px",
                }}>
                  {an.important&&<span style={{display:"inline-block",background:"#fef3c7",color:"#d97706",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:8,marginBottom:10,letterSpacing:1}}>📌 IMPORTANT</span>}
                  <h3 style={{margin:"0 0 8px",fontSize:15,fontWeight:800,color:c1,lineHeight:1.3}}>{an.titre}</h3>
                  <p style={{margin:"0 0 12px",fontSize:13,color:"#475569",lineHeight:1.6}}>{an.corps}</p>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{new Date(an.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TABLEAU D'HONNEUR ── */}
      {acc.showHonneurs&&honneurs.length>0&&(
        <div style={{padding:"60px 24px",background:`linear-gradient(135deg,${c1},${c1}f0)`}}>
          <div style={{maxWidth:1000,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:36}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:c2,marginBottom:8}}>Mérite & Excellence</div>
              <h2 style={{margin:0,fontSize:"clamp(22px,4vw,32px)",fontWeight:900,color:"#fff"}}>🏆 Tableau d'honneur</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
              {honneurs.map((h,i)=>(
                <div key={i} style={{
                  background:"rgba(255,255,255,0.07)",
                  border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:14,padding:"20px 18px",textAlign:"center",
                  backdropFilter:"blur(4px)",
                }}>
                  <div style={{width:52,height:52,borderRadius:"50%",
                    background:`linear-gradient(135deg,${c2},${c2}99)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:22,margin:"0 auto 12px",boxShadow:`0 4px 14px ${c2}44`}}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":"🏅"}
                  </div>
                  <div style={{fontWeight:900,fontSize:14,color:"#fff",marginBottom:4}}>
                    {h.prenom} {h.nom}
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:c2,marginBottom:6}}>{h.distinction}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{h.classe} · {h.periode}</div>
                  {h.observation&&<div style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,0.6)",fontStyle:"italic"}}>{h.observation}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── GALERIE ── */}
      {photos.length>0&&(
        <div style={{padding:"60px 24px",background:"#f8fafc"}}>
          <div style={{maxWidth:1000,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:36}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:c2,marginBottom:8}}>Notre établissement</div>
              <h2 style={{margin:0,fontSize:"clamp(22px,4vw,32px)",fontWeight:900,color:c1}}>📸 Galerie</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
              {photos.map((p,i)=>(
                <div key={i} onClick={()=>setGalIndex(i)} style={{cursor:"zoom-in",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",background:"#e2e8f0"}}>
                  <img src={p.url} alt={p.caption||""} style={{width:"100%",height:160,objectFit:"cover",display:"block",transition:"transform .3s"}}
                    onMouseEnter={e=>e.target.style.transform="scale(1.04)"}
                    onMouseLeave={e=>e.target.style.transform=""}/>
                  {p.caption&&<div style={{padding:"8px 12px",fontSize:12,color:"#475569",fontWeight:600}}>{p.caption}</div>}
                </div>
              ))}
            </div>
          </div>
          {/* Lightbox */}
          {galIndex!==null&&(
            <div onClick={()=>setGalIndex(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
              <button onClick={e=>{e.stopPropagation();setGalIndex(i=>Math.max(0,i-1));}}
                style={{position:"absolute",left:20,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:24,width:48,height:48,borderRadius:"50%",cursor:"pointer"}}>‹</button>
              <img src={photos[galIndex]?.url} alt="" style={{maxWidth:"90vw",maxHeight:"85vh",objectFit:"contain",borderRadius:8,boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}/>
              <button onClick={e=>{e.stopPropagation();setGalIndex(i=>Math.min(photos.length-1,i+1));}}
                style={{position:"absolute",right:20,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:24,width:48,height:48,borderRadius:"50%",cursor:"pointer"}}>›</button>
              {photos[galIndex]?.caption&&<div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,0.7)",fontSize:13,background:"rgba(0,0,0,0.5)",padding:"6px 16px",borderRadius:20}}>{photos[galIndex].caption}</div>}
            </div>
          )}
        </div>
      )}

      {/* ── CONTACT ── */}
      {acc.showContact&&(acc.telephone||acc.email||acc.adresse||acc.facebook)&&(
        <div style={{padding:"60px 24px",background:`linear-gradient(135deg,#0A1628,${c1})`}}>
          <div style={{maxWidth:800,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:c2,marginBottom:8}}>Nous trouver</div>
            <h2 style={{margin:"0 0 32px",fontSize:"clamp(20px,4vw,30px)",fontWeight:900,color:"#fff"}}>📍 Contact & localisation</h2>
            <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
              {acc.telephone&&<a href={`tel:${acc.telephone}`} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 22px",textDecoration:"none",color:"#fff"}}>
                <span style={{fontSize:20}}>📞</span>
                <div style={{textAlign:"left"}}><div style={{fontSize:10,color:c2,fontWeight:700,letterSpacing:1}}>TÉLÉPHONE</div><div style={{fontSize:13,fontWeight:700}}>{acc.telephone}</div></div>
              </a>}
              {acc.whatsapp&&<a href={`https://wa.me/${acc.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 22px",textDecoration:"none",color:"#fff"}}>
                <span style={{fontSize:20}}>💬</span>
                <div style={{textAlign:"left"}}><div style={{fontSize:10,color:c2,fontWeight:700,letterSpacing:1}}>WHATSAPP</div><div style={{fontSize:13,fontWeight:700}}>{acc.whatsapp}</div></div>
              </a>}
              {acc.email&&<a href={`mailto:${acc.email}`} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 22px",textDecoration:"none",color:"#fff"}}>
                <span style={{fontSize:20}}>✉️</span>
                <div style={{textAlign:"left"}}><div style={{fontSize:10,color:c2,fontWeight:700,letterSpacing:1}}>EMAIL</div><div style={{fontSize:13,fontWeight:700}}>{acc.email}</div></div>
              </a>}
              {acc.facebook&&<a href={acc.facebook.startsWith("http")?acc.facebook:`https://${acc.facebook}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 22px",textDecoration:"none",color:"#fff"}}>
                <span style={{fontSize:20}}>📘</span>
                <div style={{textAlign:"left"}}><div style={{fontSize:10,color:c2,fontWeight:700,letterSpacing:1}}>FACEBOOK</div><div style={{fontSize:13,fontWeight:700}}>Page Facebook</div></div>
              </a>}
            </div>
            {acc.adresse&&<div style={{marginTop:24,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"rgba(255,255,255,0.55)",fontSize:13}}>
              <span>📍</span><span>{acc.adresse}</span>
            </div>}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{background:"#020c1b",padding:"20px 24px",textAlign:"center"}}>
        <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.2)"}}>
          {schoolInfo.nom} · Propulsé par <strong style={{color:c2}}>EduGest</strong> · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  GESTION DES EXAMENS
// ══════════════════════════════════════════════════════════════

export { PortailPublic };
