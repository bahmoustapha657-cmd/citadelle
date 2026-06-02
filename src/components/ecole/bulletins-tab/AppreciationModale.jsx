import { C } from "../../../constants";
import { Btn, Modale, Textarea } from "../../ui";

// Modale de saisie de l'appréciation d'un élève pour la période courante.
export function AppreciationModale({
  t, form, chg, periodeB, getAppreciation, saveAppreciation, setModal,
}) {
  return (
    <Modale titre={`${t("school.bulletins.appreciation")} — ${form.nomComplet||""} · ${periodeB}`} fermer={()=>setModal(null)}>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark}}>
        {t("school.bulletins.appreciationHelp")}
      </div>
      <Textarea label={t("school.bulletins.appreciation")} rows={4} value={form.texte||""} onChange={chg("texte")} placeholder="Ex : Trimestre satisfaisant. Doit poursuivre ses efforts en mathématiques." maxLength={500}/>
      <div style={{fontSize:11,color:"#6b7280",marginTop:4,textAlign:"right"}}>{(form.texte||"").length} / 500</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14}}>
        <div>
          {getAppreciation(form.eleveId,periodeB)?.texte && (
            <Btn v="ghost" sm onClick={async()=>{
              if(!confirm(t("school.bulletins.clearConfirm")))return;
              await saveAppreciation(form.eleveId,periodeB,"");
              setModal(null);
            }}>{t("school.bulletins.clearAppreciation")}</Btn>
          )}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn onClick={async()=>{
            await saveAppreciation(form.eleveId,periodeB,form.texte||"");
            setModal(null);
          }}>✅ {t("common.save")}</Btn>
        </div>
      </div>
    </Modale>
  );
}
