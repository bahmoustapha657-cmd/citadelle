import { C } from "../../../constants";
import { Badge, Btn, Modale, TD, THead, TR } from "../../ui";
import { compteColor } from "../admin-helpers";

// Modale affichant une seule fois les mots de passe des comptes créés
// automatiquement à l'initialisation de l'école.
export function MdpsInitiauxModale({ mdpsInitiaux, setMdpsInitiaux }) {
  return (
    <Modale titre="🔐 Comptes créés — Notez les mots de passe" fermer={null}>
      <p style={{fontSize:13,color:"#b91c1c",fontWeight:700,marginBottom:12}}>
        ⚠️ Ces mots de passe ne seront plus jamais affichés. Notez-les maintenant.
      </p>
      <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{marginBottom:16}}>
        <THead cols={["Login","Rôle","Mot de passe temporaire"]}/>
        <tbody>{mdpsInitiaux.map((compte)=>(
          <TR key={`${compte.role}-${compte.login}`}>
            <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{compte.login}</span></TD>
            <TD><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={compteColor(compte.role)}>{compte.label}</Badge></div></TD>
            <TD><span style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:C.blueDark,letterSpacing:"0.05em"}}>{compte.mdp}</span></TD>
          </TR>
        ))}</tbody>
      </table></div>
      <Btn v="success" onClick={()=>setMdpsInitiaux(null)}>✅ J'ai noté tous les mots de passe</Btn>
    </Modale>
  );
}
