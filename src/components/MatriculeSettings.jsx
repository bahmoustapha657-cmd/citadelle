import React, { useState, useContext } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseDb";
import { SchoolContext } from "../contexts/SchoolContext";
import { C, getAnnee } from "../constants";
import { Btn, Stat, TR } from "./ui";

function MatriculeSettings({sec, lbl, inp, setMsgSucces, setErreur}) {
  const {schoolId, schoolInfo, setSchoolInfo} = useContext(SchoolContext);
  const [cfgLocal, setCfgLocal] = useState({
    matriculePrefixPrim: schoolInfo.matriculePrefixPrim||"P",
    matriculePrefixColl: schoolInfo.matriculePrefixColl||"C",
    matriculeSep:        schoolInfo.matriculeSep!=null ? schoolInfo.matriculeSep : "-",
    matriculeAnnee:      schoolInfo.matriculeAnnee!==false,
    matriculeAnnee4:     !!schoolInfo.matriculeAnnee4,
    matriculeChiffres:   Number(schoolInfo.matriculeChiffres||3),
  });
  const [savingMat, setSavingMat] = useState(false);
  const anneeShort = getAnnee().split("-")[0].slice(-2);
  const anneeFull  = getAnnee().split("-")[0];

  const previewFor = (type) => {
    const pref = type==="college" ? cfgLocal.matriculePrefixColl : cfgLocal.matriculePrefixPrim;
    const sep  = cfgLocal.matriculeSep;
    const anneeStr = cfgLocal.matriculeAnnee ? (cfgLocal.matriculeAnnee4?anneeFull:anneeShort) : "";
    const prefix = cfgLocal.matriculeAnnee ? `${pref}${anneeStr}${sep}` : `${pref}${sep}`;
    return `${prefix}${"1".padStart(Number(cfgLocal.matriculeChiffres)||3,"0")} · ${prefix}${"2".padStart(Number(cfgLocal.matriculeChiffres)||3,"0")} · ...`;
  };

  const sauvegarderMat = async () => {
    setSavingMat(true);
    try {
      await updateDoc(doc(db,"ecoles",schoolId), cfgLocal);
      setSchoolInfo(prev=>({...prev,...cfgLocal}));
      setMsgSucces("Modèle de matricule enregistré."); setTimeout(()=>setMsgSucces(""),3000);
    } catch(e) { setErreur(e.message); } finally { setSavingMat(false); }
  };

  const upd = k => e => setCfgLocal(p=>({...p,[k]:e.target.type==="checkbox"?e.target.checked:e.target.value}));

  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🔢 Modèle de matricule</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div>
          <label style={lbl}>Préfixe — Primaire</label>
          <input style={inp} value={cfgLocal.matriculePrefixPrim} onChange={upd("matriculePrefixPrim")} placeholder="P"/>
        </div>
        <div>
          <label style={lbl}>Préfixe — Collège / Secondaire</label>
          <input style={inp} value={cfgLocal.matriculePrefixColl} onChange={upd("matriculePrefixColl")} placeholder="C"/>
        </div>
        <div>
          <label style={lbl}>Séparateur (entre préfixe+année et numéro)</label>
          <input style={inp} value={cfgLocal.matriculeSep} onChange={upd("matriculeSep")} placeholder="-" maxLength={3}/>
        </div>
        <div>
          <label style={lbl}>Nombre de chiffres du numéro séquentiel</label>
          <select style={{...inp,cursor:"pointer"}} value={cfgLocal.matriculeChiffres} onChange={upd("matriculeChiffres")}>
            <option value={3}>3 → 001, 002…</option>
            <option value={4}>4 → 0001, 0002…</option>
            <option value={5}>5 → 00001, 00002…</option>
          </select>
        </div>
      </div>
      <div style={{display:"flex",gap:24,marginBottom:16}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={cfgLocal.matriculeAnnee} onChange={upd("matriculeAnnee")}/>
          Inclure l'année dans le matricule
        </label>
        {cfgLocal.matriculeAnnee&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={cfgLocal.matriculeAnnee4} onChange={upd("matriculeAnnee4")}/>
          Année sur 4 chiffres ({anneeFull} au lieu de {anneeShort})
        </label>}
      </div>
      <div style={{background:"#f0f9ff",border:"1px solid #7dd3fc",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:C.blueDark}}>Aperçu</p>
        <p style={{margin:"0 0 4px",fontSize:12,color:"#0369a1"}}>Primaire : <strong>{previewFor("primaire")}</strong></p>
        <p style={{margin:0,fontSize:12,color:"#0369a1"}}>Collège : <strong>{previewFor("college")}</strong></p>
      </div>
      <p style={{margin:"0 0 14px",fontSize:11,color:"#9ca3af"}}>
        ⚠️ Ce modèle s'applique uniquement aux <strong>nouveaux élèves</strong>. Les matricules existants ne sont pas modifiés.
      </p>
      <Btn onClick={sauvegarderMat} disabled={savingMat} v="success">
        {savingMat?"Enregistrement…":"💾 Enregistrer le modèle"}
      </Btn>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PARAMÈTRES DE L'ÉCOLE
// ══════════════════════════════════════════════════════════════

export { MatriculeSettings };
