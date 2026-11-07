import { Trans, useTranslation } from "react-i18next";
import { useMessagesParents } from "./messages-parents/use-messages-parents";
import { MessagesPane } from "./messages-parents/MessagesPane";
import { AnnoncesPane } from "./messages-parents/AnnoncesPane";
import { useMessagerie } from "./messagerie/messagerie-contexte";

function MessagesParents({ readOnly }) {
  const { t } = useTranslation();
  const m = useMessagesParents();
  // Les parents écrivent désormais dans la Messagerie (messagerie-parents.sql).
  const messagerie = useMessagerie();
  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:900,color:m.c1}}>💬 {t("liaison.title")}</h2>
      </div>

      {messagerie && (
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:18,padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,fontSize:12.5,color:"#1e3a5f",lineHeight:1.5}}>
          <span style={{flex:1,minWidth:240}}>
            💡 <Trans i18nKey="liaison.movedHint" components={{ b: <strong /> }} />
          </span>
          <button type="button" onClick={()=>messagerie.ouvrirMessagerie()}
            style={{border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:800,fontSize:12,background:m.c1,color:"#fff"}}>
            {t("liaison.openMessaging")}
          </button>
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:20,background:"#f1f5f9",borderRadius:10,padding:4,width:"fit-content"}}>
        {[{id:"messages",label:`${t("liaison.tabMessages")} (${m.threads.reduce((s,th)=>s+th.nonLus,0)||""})`},{id:"annonces",label:t("liaison.tabAnnouncements")}].map(o=>(
          <button key={o.id} onClick={()=>m.setTab(o.id)} style={{
            padding:"8px 18px",border:"none",borderRadius:8,cursor:"pointer",
            fontSize:13,fontWeight:700,
            background:m.tab===o.id?"#fff":"transparent",
            color:m.tab===o.id?m.c1:"#64748b",
            boxShadow:m.tab===o.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
          }}>{o.label}</button>
        ))}
      </div>

      {m.tab==="messages"&&<MessagesPane
        c1={m.c1} threads={m.threads} threadSelec={m.threadSelec} selMsg={m.selMsg} setSelMsg={m.setSelMsg}
        marquerLus={m.marquerLus} reponse={m.reponse} setRep={m.setRep} envoyerReponse={m.envoyerReponse} readOnly={readOnly}
      />}

      {m.tab==="annonces"&&<AnnoncesPane
        c1={m.c1} annonces={m.annonces} supAnn={m.supAnn} formAnn={m.formAnn} setFormAnn={m.setFormAnn}
        modal={m.modal} setModal={m.setModal} publierAnnonce={m.publierAnnonce} readOnly={readOnly}
      />}
    </div>
  );
}

export { MessagesParents };
