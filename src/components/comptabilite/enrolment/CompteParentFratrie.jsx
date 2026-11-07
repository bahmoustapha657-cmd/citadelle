import { Trans, useTranslation } from "react-i18next";
import { genererMdp } from "../../../constants";
import { Btn, Champ, Input } from "../../ui";

const prenoms = (eleves) => eleves.map((e) => e.prenom).filter(Boolean).join(", ");

// Panneau « compte parent de la fratrie » de la saisie rapide ; état et
// appel serveur dans use-compte-parent-fratrie.js.
export function CompteParentFratrie({ fratrie }) {
  const { t } = useTranslation();
  const { login, setLogin, mdp, setMdp, enCours, resultat, enAttente, valider } = fratrie;
  return (
    <div style={{marginTop:12,background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:10,padding:"12px 14px",textAlign:"left"}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#6b21a8",textTransform:"uppercase",letterSpacing:"0.06em"}}>
        🔑 {t("accounting.parentAcct.title")}
      </p>
      {resultat ? (
        <div style={{fontSize:12.5,color:"#166534",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px",lineHeight:1.6}}>
          {resultat.mdp
            ? <>✅ <Trans i18nKey="accounting.parentAcct.created" values={{ login: resultat.login, password: resultat.mdp }}
                components={{ b: <strong />, code: <strong style={{fontFamily:"monospace"}} /> }} /></>
            : <>✅ <Trans i18nKey="accounting.parentAcct.existing" values={{ login: resultat.login }} components={{ b: <strong /> }} /></>}
        </div>
      ) : (
        <>
          <p style={{margin:"0 0 10px",fontSize:12,color:"#475569",lineHeight:1.5}}>
            {t("accounting.parentAcct.intro")}
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label={t("accounting.parentAcct.login")} value={login} onChange={(e)=>setLogin(e.target.value)} placeholder="622123456"/>
            <Champ label={t("accounting.parentAcct.initialPassword")}>
              <div style={{display:"flex",gap:6}}>
                <input value={mdp} onChange={(e)=>setMdp(e.target.value)}
                  style={{flex:1,minWidth:0,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,fontFamily:"monospace",boxSizing:"border-box",outline:"none"}}/>
                <Btn sm v="ghost" onClick={()=>setMdp(genererMdp())}>{t("accounting.parentAcct.regenerate")}</Btn>
              </div>
            </Champ>
          </div>
        </>
      )}
      {!resultat&&enAttente.length>0&&(
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
          <Btn v="purple" onClick={valider} disabled={enCours}>
            {enCours ? `⏳ ${t("accounting.collect.saving")}` : t("accounting.parentAcct.create", { names: prenoms(enAttente) })}
          </Btn>
        </div>
      )}
    </div>
  );
}
