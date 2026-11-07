import { useTranslation } from "react-i18next";
import { Btn, Card, Champ, Input, Modale, Vide } from "../ui";
import { localeCourante } from "../../i18n";

// Onglet "Annonces" : liste des annonces publiées et modale de création.
export function AnnoncesPane({ c1, annonces, supAnn, formAnn, setFormAnn, modal, setModal, publierAnnonce, readOnly }) {
  const { t } = useTranslation();
  return (
    <>
      {!readOnly&&<div style={{marginBottom:16,display:"flex",justifyContent:"flex-end"}}>
        <Btn onClick={()=>setModal("add_ann")}>+ {t("liaison.newAnnouncement")}</Btn>
      </div>}
      {annonces.length===0&&<Vide icone="📌" msg={t("liaison.noAnnouncement")}/>}
      {annonces.sort((a,b)=>b.date-a.date).map((an,i)=>(
        <Card key={i} style={{marginBottom:10,borderLeft:`4px solid ${an.important?"#f59e0b":c1}`}}>
          <div style={{padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              {an.important&&<span style={{background:"#fef3c7",color:"#d97706",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>📌 {t("liaison.important")}</span>}
              {an.publique
                ? <span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>🌍 {t("liaison.publicSite")}</span>
                : <span style={{background:"#f1f5f9",color:"#475569",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>🔒 {t("liaison.parentsOnly")}</span>}
              <strong style={{fontSize:14,color:"#0A1628"}}>{an.titre}</strong>
              <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{an.auteur} · {new Date(an.date).toLocaleDateString(localeCourante())}</span>
              {!readOnly&&<Btn sm v="danger" onClick={()=>supAnn(an._id)}>🗑</Btn>}
            </div>
            <p style={{margin:0,fontSize:13,color:"#475569",lineHeight:1.7}}>{an.corps}</p>
          </div>
        </Card>
      ))}

      {modal==="add_ann"&&<Modale titre={t("liaison.newAnnouncement")} fermer={()=>setModal(null)}>
        <Input label={t("liaison.fieldTitle")} value={formAnn.titre} onChange={e=>setFormAnn(p=>({...p,titre:e.target.value}))} placeholder={t("liaison.titlePlaceholder")}/>
        <div style={{height:10}}/>
        <Champ label={t("liaison.fieldContent")}>
          <textarea value={formAnn.corps} onChange={e=>setFormAnn(p=>({...p,corps:e.target.value}))}
            rows={4} placeholder={t("liaison.contentPlaceholder")}
            style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
        </Champ>
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" id="imp" checked={formAnn.important} onChange={e=>setFormAnn(p=>({...p,important:e.target.checked}))}/>
          <label htmlFor="imp" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>{t("liaison.markImportant")}</label>
        </div>
        <div style={{marginTop:8,display:"flex",alignItems:"flex-start",gap:8}}>
          <input type="checkbox" id="pub" checked={formAnn.publique} onChange={e=>setFormAnn(p=>({...p,publique:e.target.checked}))} style={{marginTop:2}}/>
          <label htmlFor="pub" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>
            {t("liaison.showPublic")}
            <span style={{display:"block",fontSize:11,color:"#94a3b8",marginTop:2}}>{t("liaison.showPublicHint")}</span>
          </label>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn onClick={publierAnnonce}>{t("liaison.publish")}</Btn>
        </div>
      </Modale>}
    </>
  );
}
