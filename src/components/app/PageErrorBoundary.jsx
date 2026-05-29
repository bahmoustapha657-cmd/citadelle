// ══════════════════════════════════════════════════════════════
//  Boundary d'erreur par page (remonté sur key={page})
// ══════════════════════════════════════════════════════════════
// Distinct du ErrorBoundary racine (plein écran) : celui-ci entoure le
// module courant et propose un « Réessayer » sans recharger toute l'app.
import React from "react";

export class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  static getDerivedStateFromError(e) { return { erreur: e }; }
  componentDidCatch(e, info) { console.error("ErrorBoundary:", e, info); }
  render() {
    if (this.state.erreur) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        height:"100%",padding:40,fontFamily:"'Segoe UI',system-ui,sans-serif",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>Attention</div>
        <h2 style={{color:"#0A1628",marginBottom:8}}>Une erreur est survenue</h2>
        <p style={{color:"#6b7280",fontSize:14,marginBottom:24,maxWidth:400}}>
          {this.state.erreur.message||"Erreur inattendue dans ce module."}
        </p>
        <button onClick={()=>this.setState({erreur:null})}
          style={{background:"#0A1628",color:"#fff",border:"none",padding:"10px 24px",
            borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:12}}>
          ðŸ”„ Reessayer
        </button>
        <button onClick={()=>window.location.reload()}
          style={{background:"none",border:"1px solid #d1d5db",color:"#6b7280",
            padding:"8px 20px",borderRadius:8,fontSize:13,cursor:"pointer"}}>
          Recharger la page
        </button>
      </div>
    );
    return this.props.children;
  }
}
