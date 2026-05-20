import React from "react";
import { C, MONNAIES, TOUS_MOIS_LONGS, calcMoisAnnee } from "../../constants";
import { PERIODICITES, getPeriodesForSchool } from "../../period-utils";
import { Btn } from "../ui";

// Onglet "Identité" de ParametresEcole.
// Concentre : informations générales (nom/type/ville/pays/devise/monnaie),
// couleurs (avec détection automatique depuis le logo), upload logo,
// mois de début d'année, périodicité (primaire + secondaire).
//
// Le formulaire d'état vit dans le parent (ParametresEcole) ; cet onglet
// reçoit form/setForm/chg + les handlers logo et le bouton de migration
// de périodicité.
export function IdentiteTab({
  form,
  setForm,
  chg,
  schoolInfo,
  // Logo
  apercu,
  handleLogoFile,
  resetLogo,
  // Détection couleurs
  couleursDetectees,
  setCouleursDetectees,
  appliquerCouleursDetectees,
  // Migration périodicité
  setMigrationOuverte,
  // Styles partagés
  inp,
  lbl,
  sec,
}) {
  return (
    <>
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
        <div style={{marginTop:16}}>
          <label style={lbl}>Monnaie utilisée pour les montants</label>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <select style={{...inp,maxWidth:180}} value={MONNAIES.includes((form.monnaie||"").toUpperCase())?form.monnaie.toUpperCase():"__autre__"}
              onChange={e=>{
                const v = e.target.value;
                if(v==="__autre__") setForm(p=>({...p,monnaie:""}));
                else setForm(p=>({...p,monnaie:v}));
              }}>
              {MONNAIES.map(m=><option key={m} value={m}>{m}</option>)}
              <option value="__autre__">Autre…</option>
            </select>
            {!MONNAIES.includes((form.monnaie||"").toUpperCase())&&
              <input style={{...inp,maxWidth:120}} value={form.monnaie} onChange={chg("monnaie")} placeholder="Ex. CAD" maxLength={5}/>}
            <span style={{fontSize:11,color:"#64748b"}}>Affichée après chaque montant (ex. « 125 000 {form.monnaie||"GNF"} »).</span>
          </div>
        </div>
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
              onChange={e=>{ setForm(p=>({...p,logo:e.target.value})); }}
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

      {/* Périodicité scolaire — par section */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🗓️ Périodicité scolaire</h3>
        <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>
          Le primaire et le secondaire peuvent suivre des rythmes différents. Convention typique en Guinée : <strong>Primaire trimestre</strong>, <strong>Secondaire semestre</strong>.
        </p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:8}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:6}}>Primaire</label>
            <select style={{...inp,cursor:"pointer"}} value={form.periodicitePrimaire||"trimestre"} onChange={chg("periodicitePrimaire")}>
              {PERIODICITES.map(p=>(
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
            <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
              <strong style={{color:C.blue}}>
                {getPeriodesForSchool({periodicite: form.periodicitePrimaire, moisDebut: form.moisDebut}).join(" · ")}
              </strong>
            </p>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:6}}>Secondaire (collège + lycée)</label>
            <select style={{...inp,cursor:"pointer"}} value={form.periodiciteSecondaire||"trimestre"} onChange={chg("periodiciteSecondaire")}>
              {PERIODICITES.map(p=>(
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
            <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
              <strong style={{color:C.blue}}>
                {getPeriodesForSchool({periodicite: form.periodiciteSecondaire, moisDebut: form.moisDebut}).join(" · ")}
              </strong>
            </p>
          </div>
        </div>

        {((schoolInfo.periodicitePrimaire||schoolInfo.periodicite) && (schoolInfo.periodicitePrimaire||schoolInfo.periodicite) !== form.periodicitePrimaire)
          || ((schoolInfo.periodiciteSecondaire||schoolInfo.periodicite) && (schoolInfo.periodiciteSecondaire||schoolInfo.periodicite) !== form.periodiciteSecondaire) ? (
          <p style={{margin:"8px 0 0",padding:"8px 12px",background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:6,fontSize:11,color:"#92400e"}}>
            ⚠️ Changer la périodicité après que des notes ont été saisies peut rendre certaines invisibles dans les bulletins. Après enregistrement, utilisez « Migrer les notes existantes » ci-dessous.
          </p>
        ) : null}
        <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <Btn sm v="ghost" onClick={()=>setMigrationOuverte(true)}>🔁 Migrer les notes existantes…</Btn>
          <span style={{fontSize:11,color:"#64748b"}}>
            Détecte les notes saisies sous une ancienne périodicité et propose un mapping vers la périodicité actuelle.
          </span>
        </div>
      </div>
    </>
  );
}
