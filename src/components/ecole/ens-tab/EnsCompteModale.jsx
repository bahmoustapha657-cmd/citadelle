import { genererMdp } from "../../../constants";
import { Btn, Champ, Input, Modale } from "../../ui";

// Modale de création d'un compte de connexion pour un enseignant : login
// suggéré et mot de passe initial régénérable.
export function EnsCompteModale({ ensCompte, setEnsCompte, sectionEns, formC, chgC, setFormC, creerCompteEns }) {
  if (!ensCompte) return null;
  return (
    <Modale titre={`Compte — ${ensCompte.prenom} ${ensCompte.nom}`} fermer={()=>setEnsCompte(null)}>
      <div style={{marginBottom:14,padding:"10px 14px",background:"#f5f3ff",borderRadius:10,fontSize:12,color:"#6d28d9"}}>
        <strong>Section :</strong> {sectionEns} &nbsp;|&nbsp; <strong>Matière :</strong> {ensCompte.matiere||"—"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
        <Input label="Identifiant de connexion" value={formC.login||""} onChange={chgC("login")} placeholder="ex: jean.dupont"/>
        <Champ label="Mot de passe initial">
          <div style={{display:"flex",gap:8}}>
            <input value={formC.mdp||""} onChange={chgC("mdp")}
              style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
            <Btn sm v="ghost" onClick={()=>setFormC(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
          </div>
        </Champ>
      </div>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
        ⚠️ Notez ces identifiants avant de valider — le mot de passe ne sera plus visible ensuite.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setEnsCompte(null)}>Annuler</Btn>
        <Btn v="purple" onClick={creerCompteEns}>✅ Créer le compte</Btn>
      </div>
    </Modale>
  );
}
