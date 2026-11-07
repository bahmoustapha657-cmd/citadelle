// ══════════════════════════════════════════════════════════════
//  Modal « Guide de démarrage » (onboarding admin/direction)
// ══════════════════════════════════════════════════════════════
import { useTranslation } from "react-i18next";
import { C, isModuleOuvertPourEcole } from "../../constants";
import { Btn } from "../ui";

export function OnboardingModal({ schoolInfo, setPage, onClose }) {
  const { t } = useTranslation();
  const go = (id) => { setPage(id); onClose(); };
  // Une école sans maternelle ni primaire n'a pas de module Dir. Primaire :
  // classes, enseignants et emplois du temps se gèrent dans Secondaire.
  const moduleSections = isModuleOuvertPourEcole("primaire", schoolInfo) ? "primaire" : "secondaire";
  const etape = (done, cle, page) => ({
    done, label: t(`shell.onboarding.${cle}`), desc: t(`shell.onboarding.${cle}Desc`), action: () => go(page),
  });
  const steps = [
    etape(schoolInfo.nom !== "EduGest" && !!schoolInfo.nom, "identity", "parametres"),
    etape(true, "classes", moduleSections),
    etape(true, "teachers", moduleSections),
    etape(true, "students", "compta"),
    etape(true, "timetables", moduleSections),
    etape(true, "salaries", "compta"),
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:18,padding:"28px 28px 24px",maxWidth:520,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{fontSize:28}}>🚀</div>
          <div>
            <h2 style={{margin:0,fontSize:17,fontWeight:900,color:C.blue}}>{t("shell.onboarding.title")}</h2>
            <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>{t("shell.onboarding.subtitle")}</p>
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
          <Btn onClick={onClose}>{t("common.close")}</Btn>
        </div>
      </div>
    </div>
  );
}
