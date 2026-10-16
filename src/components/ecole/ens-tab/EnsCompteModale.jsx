import { genererMdp, getSectionLabel } from "../../../constants";
import { coordonneesEnseignant, modesIdentifiant } from "../../../comptes-enseignants";
import { telephoneLisible } from "../../../comptes-parents";
import { Btn, Champ, Modale } from "../../ui";

// Modale de création d'un compte de connexion pour un enseignant.
// Identifiant : son TÉLÉPHONE ou son E-MAIL (ceux de la fiche), au choix — plus
// d'identifiant inventé à retenir. Mot de passe initial régénérable.
export function EnsCompteModale({ ensCompte, setEnsCompte, sectionEns, formC, chgC, setFormC, creerCompteEns }) {
  if (!ensCompte) return null;
  const { telephone, email } = coordonneesEnseignant(ensCompte);
  const modes = modesIdentifiant(ensCompte);
  const choix = {
    telephone: { titre: "📱 Numéro de téléphone", valeur: telephone && telephoneLisible(telephone) },
    email: { titre: "✉️ Adresse e-mail", valeur: email },
  };
  return (
    <Modale titre={`Compte — ${ensCompte.prenom} ${ensCompte.nom}`} fermer={()=>setEnsCompte(null)}>
      <div style={{marginBottom:14,padding:"10px 14px",background:"#f5f3ff",borderRadius:10,fontSize:12,color:"#6d28d9"}}>
        <strong>Section :</strong> {getSectionLabel(sectionEns)} &nbsp;|&nbsp; <strong>Matière :</strong> {ensCompte.matiere||"—"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
        <Champ label="Identifiant de connexion">
          <div style={{display:"grid",gap:8}}>
            {modes.map((m)=>{
              const actif = formC.mode === m;
              return (
                <label key={m} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",borderRadius:10,
                  border:`2px solid ${actif?"#7c3aed":"#e2e8f0"}`,background:actif?"#f5f3ff":"#fff"}}>
                  <input type="radio" name="mode-identifiant" checked={actif} onChange={()=>setFormC(p=>({...p,mode:m}))}/>
                  <span style={{display:"flex",flexDirection:"column"}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#475569"}}>{choix[m].titre}</span>
                    <span style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{choix[m].valeur}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Champ>
        {modes.length < 2 && (
          <div style={{fontSize:11,color:"#64748b",marginTop:-4}}>
            {telephone ? "Ajoutez son e-mail sur la fiche pour qu'il puisse aussi se connecter par e-mail et récupérer seul un mot de passe oublié."
              : "Ajoutez son téléphone sur la fiche pour qu'il puisse aussi se connecter avec son numéro."}
          </div>
        )}
        {email && formC.mode === "telephone" && (
          <div style={{fontSize:11,color:"#047857",marginTop:-4}}>✓ Il pourra aussi se connecter avec son e-mail ({email}).</div>
        )}
        <Champ label="Mot de passe initial">
          <div style={{display:"flex",gap:8}}>
            <input value={formC.mdp||""} onChange={chgC("mdp")}
              style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
            <Btn sm v="ghost" onClick={()=>setFormC(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
          </div>
        </Champ>
      </div>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
        ⚠️ Notez le mot de passe avant de valider — il ne sera plus visible ensuite.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setEnsCompte(null)}>Annuler</Btn>
        <Btn v="purple" onClick={creerCompteEns}>✅ Créer le compte</Btn>
      </div>
    </Modale>
  );
}
