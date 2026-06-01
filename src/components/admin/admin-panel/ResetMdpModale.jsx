import { Btn, Input, Modale } from "../../ui";

// Modale de réinitialisation du mot de passe d'un compte.
export function ResetMdpModale({ form, chg, setModal, sauvegarder }) {
  return (
    <Modale titre={`Modifier le mot de passe — ${form.nom}`} fermer={()=>setModal(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input label="Nouveau mot de passe" type="text" value={form.mdp||""} onChange={chg("mdp")}/>
        <div style={{background:"#fef3e0",padding:"10px 14px",borderRadius:8,fontSize:12,color:"#92400e"}}>
          Attention Communiquez ce mot de passe directement a l'utilisateur concerne.
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={sauvegarder}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
