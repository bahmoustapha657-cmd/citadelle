import React from "react";
import { C } from "../../constants";
import { MODELES_BULLETIN } from "../../reports/bulletins/bulletin-page";
import { Btn } from "../ui";

// Onglet "Évaluations" de ParametresEcole.
// Chaque école peut renommer les formes affichées (Devoir, Composition…),
// activer/désactiver celles qu'elle utilise, choisir son MODÈLE de
// bulletin et déposer la signature scannée du directeur. Les calculs
// internes restent stables ; seuls libellés et mise en page varient.
export function EvaluationsTab({
  evaluationForms,
  setEvaluationLabel,
  toggleEvaluationActive,
  form,
  setForm,
  chg,
  handleSignatureFile,
  inp,
  sec,
  schoolInfo = {},
}) {
  const modeleChoisi = MODELES_BULLETIN.find((m) => m.id === (form.modeleBulletin || "classique")) || MODELES_BULLETIN[0];
  // Aperçu du modèle sélectionné, même non enregistré, sur l'en-tête de
  // l'école. Fenêtre ouverte sur le clic (sinon bloquée), module chargé ensuite.
  const voirApercu = () => {
    const win = window.open("", "_blank");
    import("../../reports/bulletins/bulletin-apercu")
      .then(({ apercuBulletin }) => apercuBulletin({ ...schoolInfo, ...form }, win))
      .catch(() => win?.close());
  };
  return (
    <>
    <div style={sec}>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:C.blueDark}}>🧾 Modèle de bulletin</h3>
      <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>
        Choisissez l'apparence des bulletins imprimés. Les moyennes, rangs et appréciations
        sont identiques dans tous les modèles — seule la mise en page change. Les modèles
        Officiel, Prestige et Contemporain ajoutent la note de classe et la composition, le rang
        et le professeur de chaque matière, le total des points, l'assiduité et la décision du conseil.
      </p>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <select style={{...inp,cursor:"pointer",flex:1}} value={form.modeleBulletin||"classique"} onChange={chg("modeleBulletin")}>
          {MODELES_BULLETIN.map((m)=><option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <Btn sm v="ghost" onClick={voirApercu} title="Voir un bulletin d'exemple dans ce modèle, avec l'en-tête de votre école">👁️ Aperçu</Btn>
      </div>
      <p style={{margin:"6px 0 16px",fontSize:11,color:"#9ca3af"}}>{modeleChoisi.desc}</p>

      <h4 style={{margin:"0 0 8px",fontSize:13,fontWeight:800,color:C.blueDark}}>✍️ Signature scannée du directeur</h4>
      <p style={{margin:"0 0 10px",fontSize:12,color:"#64748b"}}>
        Apposée automatiquement dans le bloc « Directeur » des bulletins (PNG/JPG, fond clair, max 300 Ko).
      </p>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        {form.signatureUrl
          ? <img crossOrigin="anonymous" src={form.signatureUrl} alt="Signature" style={{height:46,maxWidth:200,objectFit:"contain",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 10px",background:"#fff"}}/>
          : <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>Aucune signature déposée — la ligne reste vierge sur les bulletins.</span>}
        <label style={{display:"inline-block"}}>
          <input type="file" accept="image/*" onChange={handleSignatureFile} style={{display:"none"}}/>
          <span style={{display:"inline-block",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:"#e0ebf8",color:C.blue}}>📤 {form.signatureUrl?"Remplacer":"Déposer"} la signature</span>
        </label>
        {form.signatureUrl&&<Btn sm v="ghost" onClick={()=>setForm(p=>({...p,signatureUrl:""}))}>Retirer</Btn>}
      </div>
    </div>

    <div style={sec}>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:C.blueDark}}>Formes d'evaluation</h3>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>
        Chaque ecole peut renommer les formes affichees, et activer seulement celles qu'elle utilise.
        Les calculs restent stables en interne.
      </p>
      {[
        { id: "primaire", title: "Primaire" },
        { id: "secondaire", title: "Secondaire" },
        { id: "examens", title: "Examens" },
      ].map((group) => (
        <div key={group.id} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",marginBottom:14,background:"#f8fafc"}}>
          <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:800,color:C.blueDark}}>{group.title}</h4>
          <div style={{display:"grid",gap:10}}>
            {(evaluationForms[group.id] || []).map((item) => (
              <div key={item.id} style={{display:"grid",gridTemplateColumns:"minmax(140px,180px) 1fr auto",gap:10,alignItems:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#475569"}}>{item.value}</div>
                <input
                  style={inp}
                  value={item.label}
                  onChange={(e)=>setEvaluationLabel(group.id, item.id, e.target.value)}
                  placeholder={item.value}
                />
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:item.active?C.greenDk:"#64748b",cursor:"pointer",whiteSpace:"nowrap"}}>
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={()=>toggleEvaluationActive(group.id, item.id)}
                  />
                  {item.active ? "Active" : "Masquee"}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
