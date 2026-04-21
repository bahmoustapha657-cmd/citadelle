import React, { useContext, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { C, TOUS_MOIS_LONGS, calcMoisAnnee } from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { db } from "../firebaseDb";
import { getAuthHeaders } from "../apiClient";
import { AffichageSettings } from "./AffichageSettings";
import { MatriculeSettings } from "./MatriculeSettings";
import { Btn, Input, Modale, Selec } from "./ui";

function ParametresEcole() {
  const {schoolId,schoolInfo,setSchoolInfo,toast} = useContext(SchoolContext);
  const {items:honneurs, ajouter:ajHonneur, modifier:modHonneur, supprimer:supHonneur} = useFirestore("honneurs");
  const [tabParam, setTabParam] = useState("identite");
  const [form,setForm] = useState({
    nom: schoolInfo.nom||"",
    type: schoolInfo.type||"Groupe Scolaire Privé",
    ville: schoolInfo.ville||"",
    pays: schoolInfo.pays||"Guinée",
    couleur1: schoolInfo.couleur1||"#0A1628",
    couleur2: schoolInfo.couleur2||"#00C48C",
    logo: schoolInfo.logo||"",
    devise: schoolInfo.devise||"",
    ministere: schoolInfo.ministere||"",
    ire: schoolInfo.ire||"",
    dpe: schoolInfo.dpe||"",
    agrement: schoolInfo.agrement||"",
    moisDebut: schoolInfo.moisDebut||"Octobre",
  });
  const acc0 = schoolInfo.accueil||{};
  const [accueil, setAccueil] = useState({
    active: acc0.active||false,
    slogan: acc0.slogan||"",
    texteAccueil: acc0.texteAccueil||"",
    bannerUrl: acc0.bannerUrl||"",
    photos: acc0.photos||[],
    showAnnonces: acc0.showAnnonces!==false,
    showHonneurs: acc0.showHonneurs!==false,
    showContact: acc0.showContact!==false,
    telephone: acc0.telephone||"",
    email: acc0.email||"",
    facebook: acc0.facebook||"",
    whatsapp: acc0.whatsapp||"",
    adresse: acc0.adresse||"",
  });
  const [formHonneur, setFormHonneur] = useState({});
  const [modalH, setModalH] = useState(null);
  const chgA = k => e => setAccueil(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));
  const [chargement,setChargement] = useState(false);
  const [msgSucces,setMsgSucces] = useState("");
  const [erreur,setErreur] = useState("");
  const [apercu,setApercu] = useState(null); // aperçu logo uploadé

  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const [couleursDetectees, setCouleursDetectees] = useState(null);

  // Extrait les 2 couleurs dominantes d'une image via Canvas
  const extraireCouleurs = (src, cb) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 80; // résolution réduite pour perf
        const canvas = document.createElement("canvas");
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        const freq = {};
        for(let i=0;i<px.length;i+=4){
          const [r,g,b,a] = [px[i],px[i+1],px[i+2],px[i+3]];
          if(a<100) continue;                        // transparent
          if(r>230&&g>230&&b>230) continue;          // blanc
          if(r<25&&g<25&&b<25) continue;             // noir
          // Quantiser (grouper les teintes proches)
          const k=`${Math.round(r/28)*28},${Math.round(g/28)*28},${Math.round(b/28)*28}`;
          freq[k]=(freq[k]||0)+1;
        }
        const tri = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
        if(!tri.length){cb(null,null);return;}
        const hex=([r,g,b])=>"#"+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,"0")).join("");
        const c1rgb = tri[0][0].split(",").map(Number);
        const c1 = hex(c1rgb);
        let c2=null;
        for(const [k] of tri.slice(1)){
          const rgb=k.split(",").map(Number);
          const d=Math.sqrt(c1rgb.reduce((s,v,i)=>s+(v-rgb[i])**2,0));
          if(d>70){c2=hex(rgb);break;}
        }
        cb(c1, c2||"#00C48C");
      } catch{ cb(null,null); }
    };
    img.onerror=()=>cb(null,null);
    img.src=src;
  };

  // Upload logo fichier → base64 + extraction couleurs
  const handleLogoFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){ setErreur("Logo trop grand (max 500 Ko)."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      setForm(p=>({...p,logo:src}));
      setApercu(src);
      setCouleursDetectees(null);
      extraireCouleurs(src, (c1, c2) => {
        if(c1) setCouleursDetectees({c1, c2});
      });
    };
    reader.readAsDataURL(file);
  };

  const appliquerCouleursDetectees = () => {
    if(!couleursDetectees) return;
    setForm(p=>({...p, couleur1:couleursDetectees.c1, couleur2:couleursDetectees.c2}));
    setCouleursDetectees(null);
  };

  const sauvegarder = async () => {
    if(!form.nom.trim()){setErreur("Le nom de l'école est requis.");return;}
    setChargement(true); setErreur("");
    try {
      const data = {
        nom: form.nom.trim(),
        type: form.type.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        couleur1: form.couleur1,
        couleur2: form.couleur2,
        logo: form.logo||null,
        devise: form.devise.trim(),
        ministere: form.ministere.trim(),
        ire: form.ire.trim(),
        dpe: form.dpe.trim(),
        agrement: form.agrement.trim(),
        moisDebut: form.moisDebut,
        accueil: {
          active: accueil.active,
          slogan: accueil.slogan.trim(),
          texteAccueil: accueil.texteAccueil.trim(),
          bannerUrl: accueil.bannerUrl.trim(),
          photos: accueil.photos,
          showAnnonces: accueil.showAnnonces,
          showHonneurs: accueil.showHonneurs,
          showContact: accueil.showContact,
          telephone: accueil.telephone.trim(),
          email: accueil.email.trim(),
          facebook: accueil.facebook.trim(),
          whatsapp: accueil.whatsapp.trim(),
          adresse: accueil.adresse.trim(),
        },
      };
      await updateDoc(doc(db,"ecoles",schoolId), data);
      setSchoolInfo(prev=>({...prev,...data}));
      try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        await fetch("/api/ecole-public-sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync", schoolId }),
        });
      } catch { /* non-bloquant : la source privée est à jour */ }
      if(data.couleur1) document.documentElement.style.setProperty("--sc1", data.couleur1);
      if(data.couleur2) document.documentElement.style.setProperty("--sc2", data.couleur2);
      setMsgSucces("Paramètres enregistrés avec succès.");
      setTimeout(()=>setMsgSucces(""),4000);
    } catch(e) {
      setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
    } finally {
      setChargement(false);
    }
  };

  // Upload photo galerie → base64
  const handlePhotoGalerie = e => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if(file.size > 800*1024){ toast(`${file.name} trop grande (max 800 Ko).`,"warning"); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setAccueil(p=>({...p, photos:[...(p.photos||[]), {url:ev.target.result, caption:""}]}));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Upload bannière → base64
  const handleBanniere = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 1024*1024){ setErreur("Bannière trop grande (max 1 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = ev => setAccueil(p=>({...p, bannerUrl:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetLogo = () => { setForm(p=>({...p,logo:""})); setApercu(null); };

  const inp = {
    width:"100%",border:"1px solid #d1d5db",borderRadius:8,
    padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",
  };
  const lbl = {
    display:"block",fontSize:11,fontWeight:700,color:C.blueDark,
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4,marginTop:14,
  };
  const sec = {
    background:"#fff",borderRadius:14,padding:"24px 28px",
    boxShadow:"0 2px 16px rgba(0,32,80,0.07)",marginBottom:20,
  };

  return (
    <div style={{padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:760,margin:"0 auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:C.blueDark}}>⚙️ Paramètres de l'école</h2>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#9ca3af"}}>Personnalisez l'identité visuelle et les informations de votre établissement</p>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:24,width:"fit-content"}}>
        {[
          {id:"identite",    label:"🏫 Identité"},
          {id:"accueil",     label:"🌐 Page d'accueil"},
          {id:"officiel",    label:"🏛️ Officiel & Année"},
          {id:"matricules",  label:"🔢 Matricules"},
          {id:"affichage",   label:"🎨 Affichage"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTabParam(t.id)} style={{
            padding:"8px 18px",border:"none",borderRadius:9,cursor:"pointer",
            fontSize:13,fontWeight:700,
            background:tabParam===t.id?"#fff":"transparent",
            color:tabParam===t.id?C.blueDark:"#64748b",
            boxShadow:tabParam===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
            transition:"all .15s",
          }}>{t.label}</button>
        ))}
      </div>

      {msgSucces&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#065f46",fontWeight:600}}>✅ {msgSucces}</div>}
      {erreur&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>{erreur}</div>}

      {/* ══ TAB IDENTITÉ ══ */}
      {tabParam==="identite"&&<>
      {/* Informations générales */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🏫 Informations générales</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <label style={lbl}>Nom de l'école *</label>
            <input style={inp} value={form.nom} onChange={chg("nom")} placeholder="Ex. : La Citadelle"/>
          </div>
          <div>
            <label style={lbl}>Type d'établissement</label>
            <input style={inp} value={form.type} onChange={chg("type")} placeholder="Ex. : Groupe Scolaire Privé"/>
          </div>
          <div>
            <label style={lbl}>Ville</label>
            <input style={inp} value={form.ville} onChange={chg("ville")} placeholder="Ex. : Kindia"/>
          </div>
          <div>
            <label style={lbl}>Pays</label>
            <input style={inp} value={form.pays} onChange={chg("pays")} placeholder="Ex. : Guinée"/>
          </div>
        </div>
        <label style={lbl}>Devise / Slogan</label>
        <input style={inp} value={form.devise} onChange={chg("devise")} placeholder="Ex. : Travail – Rigueur – Réussite"/>
      </div>

      {/* Couleurs */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🎨 Couleurs de l'établissement</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
          {[
            {key:"couleur1",label:"Couleur principale (fond sidebar, titres)"},
            {key:"couleur2",label:"Couleur secondaire (accents, boutons)"},
          ].map(({key,label})=>(
            <div key={key}>
              <label style={lbl}>{label}</label>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <input type="color" value={form[key]} onChange={chg(key)}
                  style={{width:48,height:40,border:"1px solid #d1d5db",borderRadius:8,cursor:"pointer",padding:2}}/>
                <input style={{...inp,flex:1}} value={form[key]} onChange={chg(key)} placeholder="#0A1628"/>
                <div style={{width:40,height:40,borderRadius:8,background:form[key],border:"1px solid #e5e7eb",flexShrink:0}}/>
              </div>
            </div>
          ))}
        </div>
        {/* Aperçu couleurs */}
        <div style={{marginTop:16,padding:"14px 18px",borderRadius:10,background:form.couleur1,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:form.couleur2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏫</div>
          <div>
            <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Aperçu sidebar</p>
            <p style={{margin:0,fontSize:14,fontWeight:800,color:form.couleur2}}>{form.nom||"Nom de l'école"}</p>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🖼️ Logo de l'établissement</h3>
        <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
          {/* Aperçu */}
          <div style={{width:100,height:100,borderRadius:12,border:"2px dashed #d1d5db",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#f9fafb",flexShrink:0}}>
            {(apercu||form.logo)
              ? <img src={apercu||form.logo} alt="Logo" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              : <span style={{fontSize:32}}>🏫</span>}
          </div>
          <div style={{flex:1,minWidth:200}}>
            <label style={{...lbl,marginTop:0}}>Uploader un fichier (max 500 Ko)</label>
            <input type="file" accept="image/*" onChange={handleLogoFile}
              style={{...inp,padding:"6px 8px",cursor:"pointer"}}/>
            <label style={lbl}>Ou coller une URL d'image</label>
            <input style={inp} value={form.logo.startsWith("data:")?"":(form.logo||"")}
              onChange={e=>{ setForm(p=>({...p,logo:e.target.value})); setApercu(null); }}
              placeholder="https://exemple.com/logo.png"/>
            {(form.logo||apercu)&&(
              <button onClick={resetLogo}
                style={{marginTop:8,background:"#fee2e2",border:"none",color:"#991b1b",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                ✕ Supprimer le logo
              </button>
            )}
            {couleursDetectees&&(
              <div style={{marginTop:10,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10}}>
                <p style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:8}}>🎨 Couleurs détectées dans le logo :</p>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:28,height:28,borderRadius:6,background:couleursDetectees.c1,border:"2px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,.15)"}}/>
                    <span style={{fontSize:11,color:"#374151",fontWeight:600}}>Couleur 1<br/><code style={{fontSize:10,color:"#6b7280"}}>{couleursDetectees.c1}</code></span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:28,height:28,borderRadius:6,background:couleursDetectees.c2,border:"2px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,.15)"}}/>
                    <span style={{fontSize:11,color:"#374151",fontWeight:600}}>Couleur 2<br/><code style={{fontSize:10,color:"#6b7280"}}>{couleursDetectees.c2}</code></span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={appliquerCouleursDetectees}
                    style={{background:"linear-gradient(135deg,#065f46,#059669)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    ✔ Appliquer ces couleurs
                  </button>
                  <button onClick={()=>setCouleursDetectees(p=>({c1:p.c2,c2:p.c1}))}
                    style={{background:"#e0ebf8",color:C.blueDark,border:"none",padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    ⇄ Inverser
                  </button>
                  <button onClick={()=>setCouleursDetectees(null)}
                    style={{background:"#e5e7eb",color:"#374151",border:"none",padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Ignorer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Année scolaire — dans onglet identité */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Mois de début de l'année</h3>
        <select style={{...inp,cursor:"pointer"}} value={form.moisDebut} onChange={chg("moisDebut")}>
          {TOUS_MOIS_LONGS.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
          Actuellement : <strong style={{color:C.blue}}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
        </p>
      </div>
      </>}

      {/* ══ TAB PAGE D'ACCUEIL ══ */}
      {tabParam==="accueil"&&<>

        {/* Activation */}
        <div style={{...sec,borderLeft:`4px solid ${accueil.active?C.green:"#e2e8f0"}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.blueDark}}>🌐 Page d'accueil publique</h3>
              <p style={{margin:0,fontSize:12,color:"#64748b"}}>Visible par tous les visiteurs avant connexion — vitrine de votre école</p>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
              <span style={{fontSize:13,fontWeight:700,color:accueil.active?C.greenDk:"#94a3b8"}}>
                {accueil.active?"✅ Activée":"⭕ Désactivée"}
              </span>
              <div onClick={()=>setAccueil(p=>({...p,active:!p.active}))} style={{
                width:44,height:24,borderRadius:12,cursor:"pointer",transition:"background .2s",
                background:accueil.active?C.green:"#d1d5db",position:"relative",flexShrink:0,
              }}>
                <div style={{
                  position:"absolute",top:2,left:accueil.active?22:2,
                  width:20,height:20,borderRadius:"50%",background:"#fff",
                  transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.25)",
                }}/>
              </div>
            </label>
          </div>
        </div>

        {/* Textes */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>✏️ Textes de la page</h3>
          <label style={lbl}>Slogan / Tagline</label>
          <input style={inp} value={accueil.slogan} onChange={chgA("slogan")} placeholder="Ex. : L'excellence au cœur de l'Afrique"/>
          <label style={lbl}>Message d'accueil</label>
          <textarea value={accueil.texteAccueil} onChange={chgA("texteAccueil")} rows={3}
            placeholder="Ex. : Bienvenue à l'École La Citadelle, un établissement d'excellence..."
            style={{...inp,resize:"vertical",fontFamily:"inherit"}}/>
        </div>

        {/* Bannière */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🖼️ Image bannière (hero)</h3>
          {accueil.bannerUrl&&<div style={{marginBottom:12,borderRadius:10,overflow:"hidden",height:120,background:"#f1f5f9"}}>
            <img src={accueil.bannerUrl} alt="Bannière" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </div>}
          <input type="file" accept="image/*" onChange={handleBanniere} style={{...inp,padding:"6px 8px",cursor:"pointer"}}/>
          <label style={lbl}>Ou coller une URL</label>
          <input style={inp} value={accueil.bannerUrl.startsWith("data:")?"":accueil.bannerUrl}
            onChange={e=>setAccueil(p=>({...p,bannerUrl:e.target.value}))}
            placeholder="https://...jpg"/>
          {accueil.bannerUrl&&<button onClick={()=>setAccueil(p=>({...p,bannerUrl:""}))}
            style={{marginTop:8,background:"#fee2e2",border:"none",color:"#991b1b",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ✕ Supprimer la bannière
          </button>}
        </div>

        {/* Galerie photos */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📸 Galerie de photos</h3>
          <input type="file" accept="image/*" multiple onChange={handlePhotoGalerie}
            style={{...inp,padding:"6px 8px",cursor:"pointer",marginBottom:12}}/>
          {(accueil.photos||[]).length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucune photo ajoutée</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginTop:8}}>
            {(accueil.photos||[]).map((p,i)=>(
              <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                <img src={p.url} alt="" style={{width:"100%",height:90,objectFit:"cover",display:"block"}}/>
                <input value={p.caption||""} onChange={e=>{
                  const photos=[...accueil.photos];
                  photos[i]={...photos[i],caption:e.target.value};
                  setAccueil(pa=>({...pa,photos}));
                }} placeholder="Légende..." style={{width:"100%",border:"none",borderTop:"1px solid #e2e8f0",padding:"4px 6px",fontSize:11,outline:"none",boxSizing:"border-box"}}/>
                <button onClick={()=>setAccueil(pa=>({...pa,photos:pa.photos.filter((_,j)=>j!==i)}))}
                  style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Tableau d'honneur */}
        <div style={sec}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:800,color:C.blueDark}}>🏆 Tableau d'honneur</h3>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>
                <input type="checkbox" checked={accueil.showHonneurs} onChange={chgA("showHonneurs")}/>
                Afficher sur la page
              </label>
              <Btn sm onClick={()=>{setFormHonneur({periode:"",distinction:"Major de promotion"});setModalH("add");}}>+ Ajouter</Btn>
            </div>
          </div>
          {honneurs.length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucun élève distingué</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {honneurs.map(h=>(
              <div key={h._id} style={{background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:"1px solid #fde68a",borderRadius:12,padding:"14px 16px",position:"relative"}}>
                <div style={{fontSize:22,marginBottom:6}}>🏅</div>
                <div style={{fontWeight:800,fontSize:13,color:"#0A1628"}}>{h.prenom} {h.nom}</div>
                <div style={{fontSize:11,color:"#92400e",fontWeight:700,marginTop:2}}>{h.distinction}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{h.classe} · {h.periode}</div>
                <div style={{display:"flex",gap:4,marginTop:8}}>
                  <Btn sm v="ghost" onClick={()=>{setFormHonneur({...h});setModalH("edit");}}>✏️</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supHonneur(h._id);}}>🗑</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections visibles */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>👁️ Sections affichées</h3>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              {key:"showAnnonces", label:"Annonces de l'école"},
              {key:"showContact",  label:"Informations de contact"},
            ].map(({key,label})=>(
              <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:"#374151"}}>
                <input type="checkbox" checked={accueil[key]} onChange={chgA(key)} style={{width:16,height:16}}/>
                <span style={{fontWeight:600}}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📞 Informations de contact</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div><label style={lbl}>Téléphone</label><input style={inp} value={accueil.telephone} onChange={chgA("telephone")} placeholder="+224 6XX XXX XXX"/></div>
            <div><label style={lbl}>Email</label><input style={inp} value={accueil.email} onChange={chgA("email")} placeholder="contact@ecole.gn"/></div>
            <div><label style={lbl}>WhatsApp</label><input style={inp} value={accueil.whatsapp} onChange={chgA("whatsapp")} placeholder="+224 6XX XXX XXX"/></div>
            <div><label style={lbl}>Facebook</label><input style={inp} value={accueil.facebook} onChange={chgA("facebook")} placeholder="facebook.com/monecole"/></div>
          </div>
          <label style={lbl}>Adresse physique</label>
          <input style={inp} value={accueil.adresse} onChange={chgA("adresse")} placeholder="Ex. : Quartier Madina, Kindia, Guinée"/>
        </div>

        {/* Modal honneur */}
        {modalH&&<Modale titre={modalH==="add"?"Ajouter une distinction":"Modifier"} fermer={()=>setModalH(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="Prénom" value={formHonneur.prenom||""} onChange={e=>setFormHonneur(p=>({...p,prenom:e.target.value}))}/>
            <Input label="Nom" value={formHonneur.nom||""} onChange={e=>setFormHonneur(p=>({...p,nom:e.target.value}))}/>
            <Input label="Classe" value={formHonneur.classe||""} onChange={e=>setFormHonneur(p=>({...p,classe:e.target.value}))} placeholder="Ex : 9ème A"/>
            <Input label="Période" value={formHonneur.periode||""} onChange={e=>setFormHonneur(p=>({...p,periode:e.target.value}))} placeholder="Ex : T1 2025-2026"/>
          </div>
          <div style={{marginTop:12}}>
            <Selec label="Distinction" value={formHonneur.distinction||"Major de promotion"} onChange={e=>setFormHonneur(p=>({...p,distinction:e.target.value}))}>
              <option>Major de promotion</option>
              <option>Premier de classe</option>
              <option>Deuxième de classe</option>
              <option>Troisième de classe</option>
              <option>Excellence académique</option>
              <option>Mention Très Bien</option>
              <option>Mention Bien</option>
              <option>Prix du mérite</option>
              <option>Meilleur(e) en Mathématiques</option>
              <option>Meilleur(e) en Français</option>
              <option>Meilleur(e) en Sciences</option>
            </Selec>
          </div>
          <div style={{marginTop:12}}>
            <label style={{...lbl,marginTop:0}}>Observation (optionnel)</label>
            <input style={inp} value={formHonneur.observation||""} onChange={e=>setFormHonneur(p=>({...p,observation:e.target.value}))} placeholder="Ex : Moyenne 19.5/20"/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModalH(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              if(!formHonneur.nom?.trim()||!formHonneur.prenom?.trim()){toast("Nom et prénom requis.","warning");return;}
              if(modalH==="add") ajHonneur(formHonneur); else modHonneur(formHonneur);
              setModalH(null);
            }}>Enregistrer</Btn>
          </div>
        </Modale>}

      </>}

      {/* ══ TAB OFFICIEL & ANNÉE ══ */}
      {tabParam==="officiel"&&<>
      {/* Informations officielles */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🏛️ Informations officielles</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <label style={lbl}>Ministère (abrégé)</label>
            <input style={inp} value={form.ministere} onChange={chg("ministere")} placeholder="Ex. : MEPU-FP"/>
          </div>
          <div>
            <label style={lbl}>N° Agrément</label>
            <input style={inp} value={form.agrement} onChange={chg("agrement")} placeholder="Ex. : 2024/001"/>
          </div>
          <div>
            <label style={lbl}>Inspection Régionale (abrégé)</label>
            <input style={inp} value={form.ire} onChange={chg("ire")} placeholder="Ex. : IRE de Kindia"/>
          </div>
          <div>
            <label style={lbl}>Direction Préfectorale (abrégé)</label>
            <input style={inp} value={form.dpe} onChange={chg("dpe")} placeholder="Ex. : DPE de Kindia"/>
          </div>
        </div>
      </div>

      {/* Année scolaire */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Année scolaire</h3>
        <div>
          <label style={lbl}>Mois de début de l'année scolaire</label>
          <select style={{...inp,cursor:"pointer"}} value={form.moisDebut} onChange={chg("moisDebut")}>
            {TOUS_MOIS_LONGS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
            L'année scolaire couvre 9 mois à partir du mois choisi. Actuellement&nbsp;:&nbsp;
            <strong style={{color:C.blue}}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
          </p>
        </div>
      </div>
      </>}

      {/* ══ TAB MATRICULES ══ */}
      {tabParam==="matricules"&&<MatriculeSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}

      {/* ══ TAB AFFICHAGE ══ */}
      {tabParam==="affichage"&&<AffichageSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}

      {/* Bouton sauvegarder (identité / officiel / accueil) */}
      {["identite","accueil","officiel"].includes(tabParam)&&<button onClick={sauvegarder} disabled={chargement}
        style={{width:"100%",background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",
          border:"none",padding:"13px",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer",
          opacity:chargement?0.7:1}}>
        {chargement?"Enregistrement…":"💾 Enregistrer les paramètres"}
      </button>}

      <p style={{textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:12}}>
        Code école : <strong style={{color:C.blue}}>{schoolId}</strong> · Les modifications sont visibles immédiatement dans la sidebar et au prochain chargement.
      </p>
    </div>
  );
}

export { ParametresEcole };
