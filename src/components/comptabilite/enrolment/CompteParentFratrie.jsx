import { genererMdp } from "../../../constants";
import { Btn, Champ, Input } from "../../ui";

const prenoms = (eleves) => eleves.map((e) => e.prenom).filter(Boolean).join(", ");

// Panneau « compte parent de la fratrie » de la saisie rapide ; état et
// appel serveur dans use-compte-parent-fratrie.js.
export function CompteParentFratrie({ fratrie }) {
  const { login, setLogin, mdp, setMdp, enCours, resultat, enAttente, valider } = fratrie;
  return (
    <div style={{marginTop:12,background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:10,padding:"12px 14px",textAlign:"left"}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#6b21a8",textTransform:"uppercase",letterSpacing:"0.06em"}}>
        🔑 Compte parent de la fratrie (facultatif)
      </p>
      {resultat ? (
        <div style={{fontSize:12.5,color:"#166534",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px",lineHeight:1.6}}>
          {resultat.mdp
            ? <>✅ Compte créé — identifiant <strong>{resultat.login}</strong>, mot de passe <strong style={{fontFamily:"monospace"}}>{resultat.mdp}</strong>. Notez-les et remettez-les au tuteur.</>
            : <>✅ Ce foyer a déjà son compte parent : <strong>{resultat.login}</strong>. Les enfants y sont rattachés ; le mot de passe ne change pas.</>}
        </div>
      ) : (
        <>
          <p style={{margin:"0 0 10px",fontSize:12,color:"#475569",lineHeight:1.5}}>
            Un seul compte pour tous ces enfants, quelle que soit leur section. Si ce tuteur a déjà un compte parent (même nom, et même téléphone ou même filiation), ils y sont ajoutés et son mot de passe ne change pas.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Identifiant" value={login} onChange={(e)=>setLogin(e.target.value)} placeholder="parent.bah"/>
            <Champ label="Mot de passe initial">
              <div style={{display:"flex",gap:6}}>
                <input value={mdp} onChange={(e)=>setMdp(e.target.value)}
                  style={{flex:1,minWidth:0,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,fontFamily:"monospace",boxSizing:"border-box",outline:"none"}}/>
                <Btn sm v="ghost" onClick={()=>setMdp(genererMdp())}>Régénérer</Btn>
              </div>
            </Champ>
          </div>
        </>
      )}
      {!resultat&&enAttente.length>0&&(
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
          <Btn v="purple" onClick={valider} disabled={enCours}>
            {enCours ? "⏳ Enregistrement…" : `Créer le compte parent — ${prenoms(enAttente)}`}
          </Btn>
        </div>
      )}
    </div>
  );
}
