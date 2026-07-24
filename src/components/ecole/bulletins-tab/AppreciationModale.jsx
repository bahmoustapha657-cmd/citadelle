import { useState, useContext } from "react";
import { C } from "../../../constants";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { Btn, Modale, Textarea } from "../../ui";
import { genererAppreciation } from "../../../backend/ia";

// Modale de saisie de l'appréciation d'un élève pour la période courante.
export function AppreciationModale({
  t, form, chg, setForm, periodeB, getAppreciation, saveAppreciation, setModal,
}) {
  const [genLoading, setGenLoading] = useState(false);
  const [genErr, setGenErr] = useState("");
  // Génération facturée au jeton → réservée au plan Premium (le serveur
  // refuse de toute façon ; ici on évite un aller-retour et une erreur brute).
  const { planInfo } = useContext(SchoolContext);
  const estPremium = !!planInfo?.estPremium;

  const genererIA = async () => {
    setGenLoading(true);
    setGenErr("");
    try {
      const { ok, result, error } = await genererAppreciation({
        nom: form.nomComplet,
        classe: form.classe,
        periode: periodeB,
        moyenne: form.moyenne,
        mention: form.mention,
        notesMatieres: form.notesMatieres,
        consigne: form.texte || "", // texte existant = consigne facultative
      });
      if (ok && result) setForm((p) => ({ ...p, texte: result }));
      else setGenErr(error || "Génération impossible.");
    } catch (e) {
      setGenErr(e.message || "Génération impossible.");
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <Modale titre={`${t("school.bulletins.appreciation")} — ${form.nomComplet||""} · ${periodeB}`} fermer={()=>setModal(null)}>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark}}>
        {t("school.bulletins.appreciationHelp")}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginBottom:6}}>
        {!estPremium && (
          <span style={{fontSize:11,color:"#92400e"}}>Réservé au plan Premium</span>
        )}
        <Btn v="vert" sm onClick={genererIA} disabled={genLoading || !estPremium}
          title={estPremium ? "" : "La génération d'appréciations est incluse dans le plan Premium."}>
          {genLoading ? "✨ Génération…" : estPremium ? "✨ Générer avec l'IA" : "🔒 Générer avec l'IA"}
        </Btn>
      </div>
      <Textarea label={t("school.bulletins.appreciation")} rows={4} value={form.texte||""} onChange={chg("texte")} placeholder="Ex : Trimestre satisfaisant. Doit poursuivre ses efforts en mathématiques." maxLength={500}/>
      <div style={{fontSize:11,color:"#6b7280",marginTop:4,textAlign:"right"}}>{(form.texte||"").length} / 500</div>
      {genErr && <div style={{fontSize:12,color:"#b91c1c",marginTop:6}}>⚠ {genErr}</div>}
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
