import { C } from "../../../constants";
import { Btn } from "../../ui";

// Tableau d'honneur : visibilité, ajout et cartes des élèves distingués.
export function HonneursSection({ accueil, chgA, honneurs, setFormHonneur, setModalH, supHonneur, sec }) {
  return (
    <div style={sec}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <h3 style={{margin:0,fontSize:14,fontWeight:800,color:C.blueDark}}>🏆 Tableau d'honneur</h3>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>
            <input type="checkbox" checked={accueil.showHonneurs} onChange={chgA("showHonneurs")}/>
            Afficher sur la page
          </label>
          <Btn sm onClick={()=>{setFormHonneur({periode:"",distinction:"Major de promotion"});setModalH("add");}}>+ Ajouter</Btn>
        </div>
      </div>
      {honneurs.length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucun élève distingué</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {honneurs.map(h=>(
          <div key={h._id} style={{background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:"1px solid #fde68a",borderRadius:12,padding:"14px 16px",position:"relative"}}>
            <div style={{fontSize:22,marginBottom:6}}>🏅</div>
            <div style={{fontWeight:800,fontSize:13,color:"#0A1628"}}>{h.prenom} {h.nom}</div>
            <div style={{fontSize:11,color:"#92400e",fontWeight:700,marginTop:2}}>{h.distinction}</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{h.classe} · {h.periode}</div>
            <div style={{display:"flex",gap:4,marginTop:8}}>
              <Btn sm v="ghost" onClick={()=>{setFormHonneur({...h});setModalH("edit");}}>✏️</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supHonneur(h._id);}}>🗑</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
