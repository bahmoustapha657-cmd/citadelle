import { C } from "../../../constants";
import { Badge } from "../../ui";
import { LanguageSwitcher } from "../../LanguageSwitcher";

// Avatar + menu profil : paramètres école, raccourcis, langue, déconnexion.
export function ProfilMenu({
  profilOuvert, setProfilOuvert, setNotifOuvert, isMobile,
  utilisateur, utilisateurLabel, schoolInfo, t, setPage, setAideOuverte, setCentreAideOuvert, deconnecter,
}) {
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <button onClick={()=>{setProfilOuvert(v=>!v);setNotifOuvert(false);}}
        title="Mon profil"
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:8}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:C.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>
          {utilisateur.nom[0]}
        </div>
        {!isMobile&&<>
          <span style={{fontSize:12,fontWeight:700,color:C.blueDark}}>{utilisateur.nom}</span>
          <Badge color={utilisateur.role==="admin"?"purple":utilisateur.role==="comptable"?"teal":"blue"}>{utilisateurLabel}</Badge>
        </>}
      </button>
      {profilOuvert&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",insetInlineEnd:0,width:220,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
            <p style={{margin:0,fontSize:13,fontWeight:800,color:"#0f172a"}}>{utilisateur.nom}</p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}>{utilisateurLabel} · {schoolInfo.nom}</p>
          </div>
          {["admin","direction","comptable","superadmin"].includes(utilisateur.role)&&(
            <button onClick={()=>{setProfilOuvert(false);setPage("parametres");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"start",fontWeight:600}}>
              🏫 <span>Paramètres école</span>
            </button>
          )}
          <button onClick={()=>{setProfilOuvert(false);setCentreAideOuvert&&setCentreAideOuvert(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"start",fontWeight:600}}>
            ❓ <span>Centre d'aide</span>
          </button>
          <button onClick={()=>{setProfilOuvert(false);setAideOuverte(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"start",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
            ⌨️ <span>{t("nav.shortcuts")}</span><kbd style={{marginInlineStart:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#94a3b8"}}>?</kbd>
          </button>
          <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:14}}>🌐</span>
            <span style={{fontSize:12,fontWeight:600,color:"#374151",flex:1}}>{t("common.language")}</span>
            <LanguageSwitcher compact />
          </div>
          <button onClick={()=>{setProfilOuvert(false);deconnecter();}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#ef4444",textAlign:"start",fontWeight:700}}>
            ⬅ <span>{t("auth.logout")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
