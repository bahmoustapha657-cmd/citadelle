// ══════════════════════════════════════════════════════════════
//  Boundary d'erreur par page (remonté sur key={page})
// ══════════════════════════════════════════════════════════════
// Distinct du ErrorBoundary racine (plein écran) : celui-ci entoure le
// module courant et propose un « Réessayer » sans recharger toute l'app.
import React from "react";
import i18n from "../../i18n";

export class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  static getDerivedStateFromError(e) { return { erreur: e }; }
  componentDidCatch(e, info) { console.error("ErrorBoundary:", e, info); }
  render() {
    const t = i18n.t.bind(i18n);
    if (this.state.erreur) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        height:"100%",padding:40,fontFamily:"'Segoe UI',system-ui,sans-serif",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}} role="img" aria-label={t("shell.error.attention")}>⚠️</div>
        <h2 style={{color:"#0A1628",marginBottom:8}}>{t("shell.error.title")}</h2>
        <p style={{color:"#6b7280",fontSize:14,marginBottom:24,maxWidth:400}}>
          {this.state.erreur.message||t("shell.error.unexpected")}
        </p>
        <button onClick={()=>this.setState({erreur:null})}
          style={{background:"#0A1628",color:"#fff",border:"none",padding:"10px 24px",
            borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:12}}>
          🔄 {t("shell.error.retry")}
        </button>
        <button onClick={()=>window.location.reload()}
          style={{background:"none",border:"1px solid #d1d5db",color:"#6b7280",
            padding:"8px 20px",borderRadius:8,fontSize:13,cursor:"pointer"}}>
          {t("shell.error.reload")}
        </button>
      </div>
    );
    return this.props.children;
  }
}
