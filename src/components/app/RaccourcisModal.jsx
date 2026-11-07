// ══════════════════════════════════════════════════════════════
//  Modal « Raccourcis clavier » (aide ?)
// ══════════════════════════════════════════════════════════════
import { useTranslation } from "react-i18next";
import { C } from "../../constants";

export function RaccourcisModal({ onClose }) {
  const { t } = useTranslation();
  const groupes = [
    {groupe:t("shell.shortcuts.navigation"),items:[
      {keys:["Ctrl","K"],desc:t("shell.shortcuts.openSearch")},
      {keys:["?"],desc:t("shell.shortcuts.showHelp")},
      {keys:["Escape"],desc:t("shell.shortcuts.closePanel")},
    ]},
    {groupe:t("shell.shortcuts.everywhere"),items:[
      {keys:["Tab"],desc:t("shell.shortcuts.nextField")},
      {keys:["Shift","Tab"],desc:t("shell.shortcuts.prevField")},
      {keys:["Enter"],desc:t("shell.shortcuts.validate")},
    ]},
    {groupe:t("shell.shortcuts.globalSearch"),items:[
      {keys:["↑","↓"],desc:t("shell.shortcuts.browseResults")},
      {keys:["Enter"],desc:t("shell.shortcuts.openResult")},
      {keys:["Escape"],desc:t("shell.shortcuts.closeSearch")},
    ]},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,padding:"28px",maxWidth:480,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>⌨️</span>
            <div>
              <h2 style={{margin:0,fontSize:16,fontWeight:900,color:C.blue}}>{t("nav.shortcuts")}</h2>
              <p style={{margin:"2px 0 0",fontSize:11,color:"#6b7280"}}>{t("shell.shortcuts.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#94a3b8"}}>✕</button>
        </div>
        {groupes.map(({groupe,items})=>(
          <div key={groupe} style={{marginBottom:18}}>
            <p style={{margin:"0 0 8px",fontSize:10,fontWeight:900,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1}}>{groupe}</p>
            {items.map(({keys,desc})=>(
              <div key={desc} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f8fafc"}}>
                <span style={{fontSize:12,color:"#374151"}}>{desc}</span>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {keys.map((k,i)=>(
                    <kbd key={i} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderBottomWidth:3,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,color:"#475569",fontFamily:"monospace"}}>{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div style={{marginTop:16,textAlign:"center"}}>
          <button onClick={onClose} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
