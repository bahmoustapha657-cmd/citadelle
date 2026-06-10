import { Btn, Card, Champ, Input, Modale, Vide } from "../ui";

// Onglet "Annonces" : liste des annonces publiées et modale de création.
export function AnnoncesPane({ c1, annonces, supAnn, formAnn, setFormAnn, modal, setModal, publierAnnonce, readOnly }) {
  return (
    <>
      {!readOnly&&<div style={{marginBottom:16,display:"flex",justifyContent:"flex-end"}}>
        <Btn onClick={()=>setModal("add_ann")}>+ Nouvelle annonce</Btn>
      </div>}
      {annonces.length===0&&<Vide icone="📌" msg="Aucune annonce publiée"/>}
      {annonces.sort((a,b)=>b.date-a.date).map((an,i)=>(
        <Card key={i} style={{marginBottom:10,borderLeft:`4px solid ${an.important?"#f59e0b":c1}`}}>
          <div style={{padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              {an.important&&<span style={{background:"#fef3c7",color:"#d97706",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>📌 Important</span>}
              {an.publique
                ? <span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>🌍 Site public</span>
                : <span style={{background:"#f1f5f9",color:"#475569",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>🔒 Parents</span>}
              <strong style={{fontSize:14,color:"#0A1628"}}>{an.titre}</strong>
              <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{an.auteur} · {new Date(an.date).toLocaleDateString("fr-FR")}</span>
              {!readOnly&&<Btn sm v="danger" onClick={()=>supAnn(an._id)}>🗑</Btn>}
            </div>
            <p style={{margin:0,fontSize:13,color:"#475569",lineHeight:1.7}}>{an.corps}</p>
          </div>
        </Card>
      ))}

      {modal==="add_ann"&&<Modale titre="Nouvelle annonce" fermer={()=>setModal(null)}>
        <Input label="Titre" value={formAnn.titre} onChange={e=>setFormAnn(p=>({...p,titre:e.target.value}))} placeholder="Ex: Réunion parents - vendredi 18h"/>
        <div style={{height:10}}/>
        <Champ label="Contenu">
          <textarea value={formAnn.corps} onChange={e=>setFormAnn(p=>({...p,corps:e.target.value}))}
            rows={4} placeholder="Détails de l'annonce..."
            style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
        </Champ>
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" id="imp" checked={formAnn.important} onChange={e=>setFormAnn(p=>({...p,important:e.target.checked}))}/>
          <label htmlFor="imp" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>Marquer comme importante 📌</label>
        </div>
        <div style={{marginTop:8,display:"flex",alignItems:"flex-start",gap:8}}>
          <input type="checkbox" id="pub" checked={formAnn.publique} onChange={e=>setFormAnn(p=>({...p,publique:e.target.checked}))} style={{marginTop:2}}/>
          <label htmlFor="pub" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>
            Afficher aussi sur la page publique de l'école 🌍
            <span style={{display:"block",fontSize:11,color:"#94a3b8",marginTop:2}}>Décoché : visible uniquement par les parents dans leur portail.</span>
          </label>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={publierAnnonce}>Publier</Btn>
        </div>
      </Modale>}
    </>
  );
}
