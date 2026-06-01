import { genererMdp } from "../../../constants";
import { Btn, Champ, Input, Modale } from "../../ui";

// Modale de création d'un compte parent pour un élève donné : login suggéré,
// mot de passe initial (régénérable) et validation.
export function ParentCompteModale({ parentEleve, setParentEleve, formP, setFormP, chgP, creerCompteParent }) {
  if (!parentEleve) return null;
  return (
    <Modale titre={`Compte parent - ${parentEleve.prenom} ${parentEleve.nom}`} fermer={()=>setParentEleve(null)}>
      <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534",display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:18}}>Tuteur</span>
        <span><strong>{parentEleve.prenom} {parentEleve.nom}</strong> - Classe {parentEleve.classe} - Tuteur : {parentEleve.tuteur||"-"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
        <Input label="Identifiant de connexion" value={formP.login||""} onChange={chgP("login")} placeholder="ex: parent.dupont"/>
        <Champ label="Mot de passe initial">
          <div style={{display:"flex",gap:8}}>
            <input value={formP.mdp||""} onChange={chgP("mdp")}
              style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
            <Btn sm v="ghost" onClick={()=>setFormP(p=>({...p,mdp:genererMdp()}))}>Regenerer</Btn>
          </div>
        </Champ>
      </div>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
        Notez ces identifiants avant de valider. Si un compte parent existe deja pour le meme tuteur et la meme filiation, l'eleve sera rattache a ce compte.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setParentEleve(null)}>Annuler</Btn>
        <Btn v="purple" onClick={()=>creerCompteParent(formP)}>Creer le compte</Btn>
      </div>
    </Modale>
  );
}
