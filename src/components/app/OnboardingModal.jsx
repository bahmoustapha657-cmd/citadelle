// ══════════════════════════════════════════════════════════════
//  Modal « Guide de démarrage » (onboarding admin/direction)
// ══════════════════════════════════════════════════════════════
import { C } from "../../constants";
import { Btn } from "../ui";

export function OnboardingModal({ schoolInfo, setPage, onClose }) {
  const go = (id) => { setPage(id); onClose(); };
  const steps = [
    {done:schoolInfo.nom!=="EduGest"&&!!schoolInfo.nom, label:"Configurer l'identité de l'école", desc:"Nom, logo, couleurs, coordonnées", action:()=>go("parametres")},
    {done:true, label:"Creer les classes", desc:"Primaire et/ou Secondaire selon votre etablissement", action:()=>go("primaire")},
    {done:true, label:"Ajouter les enseignants", desc:"Profil, matière, prime horaire", action:()=>go("primaire")},
    {done:true, label:"Enrôler les élèves", desc:"Via le module Comptabilité → Élèves", action:()=>go("compta")},
    {done:true, label:"Configurer les emplois du temps", desc:"Par classe, dans chaque section", action:()=>go("primaire")},
    {done:true, label:"Générer les états de salaires", desc:"Via Comptabilité → Salaires → Auto-générer", action:()=>go("compta")},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:18,padding:"28px 28px 24px",maxWidth:520,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{fontSize:28}}>🚀</div>
          <div>
            <h2 style={{margin:0,fontSize:17,fontWeight:900,color:C.blue}}>Guide de démarrage</h2>
            <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>Suivez ces étapes pour configurer votre école</p>
          </div>
        </div>
        {steps.map((step,i)=>(
          <div key={i} onClick={step.action} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,marginBottom:6,cursor:"pointer",border:`1px solid ${step.done?"#d1fae5":"#e5e7eb"}`,background:step.done?"#f0fdf4":"#fafafa",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=step.done?"#dcfce7":"#f0f4ff"}
            onMouseLeave={e=>e.currentTarget.style.background=step.done?"#f0fdf4":"#fafafa"}>
            <div style={{width:26,height:26,borderRadius:"50%",background:step.done?"#00C48C":C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
              {step.done?"✓":i+1}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:step.done?C.greenDk:C.blue}}>{step.label}</div>
              <div style={{fontSize:11,color:"#6b7280"}}>{step.desc}</div>
            </div>
            <span style={{fontSize:12,color:"#9ca3af"}}>→</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
          <Btn onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}
