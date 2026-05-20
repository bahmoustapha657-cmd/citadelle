import React from "react";
import { C, MONNAIES } from "../../constants";

// Vue ultra-minimaliste affichée quand l'utilisateur est comptable :
// uniquement le sélecteur de monnaie (seul champ que les règles Firestore
// autorisent ce rôle à modifier — cf. firestore.rules §/ecoles).
// Court-circuite le rendu à onglets complet de ParametresEcole.
export function MonnaieComptableView({
  form,
  setForm,
  chg,
  chargement,
  msgSucces,
  erreur,
  sauvegarder,
  inp,
  lbl,
  sec,
}) {
  return (
    <div style={{padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:560,margin:"0 auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:C.blueDark}}>💰 Monnaie de l'école</h2>
      <p style={{margin:"0 0 20px",fontSize:12,color:"#9ca3af"}}>Choisissez la monnaie affichée pour tous les montants (recettes, dépenses, salaires).</p>
      {msgSucces&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#065f46",fontWeight:600}}>✅ {msgSucces}</div>}
      {erreur&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>{erreur}</div>}
      <div style={sec}>
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
        </div>
        <p style={{marginTop:10,fontSize:11,color:"#64748b"}}>Aperçu : « 125 000 {form.monnaie||"GNF"} ».</p>
      </div>
      <button onClick={sauvegarder} disabled={chargement} style={{marginTop:18,padding:"10px 22px",background:C.green,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:800,opacity:chargement?0.6:1}}>
        {chargement?"Enregistrement…":"Enregistrer la monnaie"}
      </button>
    </div>
  );
}
