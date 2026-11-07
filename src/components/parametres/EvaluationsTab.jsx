import React from "react";
import { C } from "../../constants";
import { getEffetForme } from "../../evaluation-forms";
import { MODELES_BULLETIN } from "../../reports/bulletins/bulletin-page";
import { Btn } from "../ui";

// Onglet "Évaluations" de ParametresEcole.
// Chaque école peut renommer les formes affichées (Devoir, Composition…),
// activer/désactiver celles qu'elle utilise, choisir son MODÈLE de
// bulletin et déposer la signature scannée du directeur. Les calculs
// internes restent stables ; seuls libellés et mise en page varient —
// d'où l'effet de chaque forme affiché sous son nom d'origine.
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
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:C.blueDark}}>📝 Formes de notes</h3>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>
        Renommez les formes à votre convenance et masquez celles que votre école n'utilise pas.
        Le nouveau nom s'affiche à la saisie et dans les listes de notes. La place de la forme dans
        le calcul de la moyenne, indiquée sous son nom d'origine, ne change pas.
      </p>
      {GROUPES_NOTES.map((group) => (
        <GroupeFormes key={group.id} group={group} items={evaluationForms[group.id] || []}
          setEvaluationLabel={setEvaluationLabel} toggleEvaluationActive={toggleEvaluationActive} inp={inp}/>
      ))}
    </div>

    <div style={sec}>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Épreuves du module Examens</h3>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>
        Noms proposés quand on planifie une épreuve dans le module Examens (calendrier, convocations).
        Ils n'ont aucun effet sur les notes ni sur les moyennes.
      </p>
      <GroupeFormes group={{ id: "examens" }} items={evaluationForms.examens || []}
        setEvaluationLabel={setEvaluationLabel} toggleEvaluationActive={toggleEvaluationActive} inp={inp}/>
    </div>
    </>
  );
}

// Groupes de formes de notes et leur règle de calcul (note-utils.ts). La
// maternelle suit le groupe du primaire (getNoteFormsGroup).
const GROUPES_NOTES = [
  {
    id: "primaire",
    title: "Maternelle et primaire",
    calcul: "Moyenne de la matière = moyenne simple de toutes les notes de la période : chaque note pèse autant, quelle que soit sa forme.",
  },
  {
    id: "secondaire",
    title: "Collège et lycée",
    calcul: "Note de classe = moyenne de la partie orale et de la partie écrite. Moyenne de la matière = (note de classe + 2 × composition) ÷ 3 ; s'il manque l'une des deux, l'autre compte seule.",
  },
];

function GroupeFormes({ group, items, setEvaluationLabel, toggleEvaluationActive, inp }) {
  const encadre = !!group.title;
  return (
    <div style={encadre ? {border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",marginBottom:14,background:"#f8fafc"} : undefined}>
      {encadre && <h4 style={{margin:"0 0 6px",fontSize:13,fontWeight:800,color:C.blueDark}}>{group.title}</h4>}
      {group.calcul && <p style={{margin:"0 0 12px",fontSize:11.5,color:"#64748b",lineHeight:1.5}}>{group.calcul}</p>}
      {!items.some((item) => item.active) && (
        <p style={{margin:"0 0 12px",padding:"8px 10px",background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,fontSize:11.5,color:"#92400e"}}>
          ⚠️ Tout est masqué : {group.id === "examens"
            ? "le module Examens proposera quand même les noms par défaut."
            : "la saisie des notes proposera quand même les formes par défaut."}
        </p>
      )}
      <div style={{display:"grid",gap:12}}>
        {items.map((item) => {
          const effet = getEffetForme(group.id, item.value);
          return (
            <div key={item.id} style={{display:"flex",flexWrap:"wrap",gap:"6px 10px",alignItems:"center"}}>
              <div style={{flex:"1 1 190px",minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#475569"}}>{item.value}</div>
                {effet && (
                  <div style={{fontSize:11,marginTop:2,lineHeight:1.35,color:effet.fort?"#b45309":"#64748b",fontWeight:effet.fort?700:400}}>
                    {effet.fort ? "⚠️ " : ""}{effet.texte}
                  </div>
                )}
              </div>
              <input
                style={{...inp,flex:"2 1 170px",minWidth:0,width:"auto"}}
                value={item.label}
                onChange={(e)=>setEvaluationLabel(group.id, item.id, e.target.value)}
                placeholder={item.value}
                aria-label={`Nom affiché pour « ${item.value} »`}
              />
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:item.active?C.greenDk:"#64748b",cursor:"pointer",whiteSpace:"nowrap",flex:"0 0 92px"}}>
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={()=>toggleEvaluationActive(group.id, item.id)}
                />
                {item.active ? "Active" : "Masquée"}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
