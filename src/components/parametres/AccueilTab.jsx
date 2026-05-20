import React from "react";
import { C } from "../../constants";
import { Btn, Input, Modale, Selec } from "../ui";

// Onglet "Accueil" de ParametresEcole.
// Configure la page d'accueil publique de l'école (vitrine avant
// connexion) : activation, slogan/texte, bannière, galerie photos,
// tableau d'honneur, sections visibles, contact.
export function AccueilTab({
  // Page d'accueil
  accueil,
  setAccueil,
  chgA,
  handleBanniere,
  handlePhotoGalerie,
  // Tableau d'honneur (Firestore via parent)
  honneurs,
  ajHonneur,
  modHonneur,
  supHonneur,
  formHonneur,
  setFormHonneur,
  modalH,
  setModalH,
  toast,
  // Styles partagés
  inp,
  lbl,
  sec,
}) {
  return (
    <>
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
    </>
  );
}
