import { C } from "../../../constants";
import { Badge, Btn, Card, Chargement, TD, THead, TR } from "../../ui";
import { compteColor } from "../admin-helpers";

// Tableau des comptes de l'école avec action de réinitialisation du mot
// de passe (selon les droits de l'utilisateur courant).
export function ComptesTable({ comptes, chargement, initEnCours, peutResetCompte, setForm, setModal }) {
  if (chargement || initEnCours) return <Chargement/>;
  return (
    <Card>
      <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
        <THead cols={["Utilisateur","Login","Rôle","Mot de passe","Action"]}/>
        <tbody>
          {comptes.map((c,i)=>{
            const reserve = !peutResetCompte(c.role);
            return (
            <TR key={c._id||i}>
              <TD bold>{c.nom}</TD>
              <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{c.login}</span></TD>
              <TD><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={compteColor(c.role)}>{c.label}</Badge>{c.statut && c.statut!=="Actif" && <Badge color="gray">Inactif</Badge>}</div></TD>
              <TD>
                <Badge color="vert">🔒 Sécurisé</Badge>
              </TD>
              <TD>
                {c._id && (reserve
                  ? <span title="Seule la Direction Générale peut réinitialiser ce compte" style={{fontSize:11,color:"#6b7280",fontStyle:"italic"}}>🛡️ Réservé Direction</span>
                  : <Btn sm onClick={()=>{setForm({...c,mdp:""});setModal("mdp");}}>✏️ Modifier</Btn>
                )}
              </TD>
            </TR>
            );
          })}
        </tbody>
      </table></div>
    </Card>
  );
}
