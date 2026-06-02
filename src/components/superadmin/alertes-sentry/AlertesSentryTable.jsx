import { C } from "../../../constants";

// Table des issues Sentry (niveau, titre/culprit, occurrences, utilisateurs,
// derniere vue, lien permalink). Affichee uniquement s'il y a des issues.
export function AlertesSentryTable({ sentryIssues, S }) {
  if (sentryIssues.length === 0) return null;
  return (
    <div style={S.card}>
      <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
        <thead>
          <tr>
            {["Niveau","Titre","Occurrences","Utilisateurs","Derniere vue",""].map(h=>(
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sentryIssues.map(is=>{
            const lvlColor = is.level==="fatal"||is.level==="error" ? "#dc2626" : is.level==="warning" ? "#d97706" : "#6b7280";
            return (
              <tr key={is.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                <td style={{...S.td,fontSize:11}}>
                  <span style={{padding:"2px 8px",borderRadius:8,background:`${lvlColor}22`,color:lvlColor,fontWeight:700,textTransform:"uppercase"}}>{is.level||"info"}</span>
                </td>
                <td style={{...S.td,fontWeight:600,maxWidth:480}}>
                  <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.title}</div>
                  {is.culprit && <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.culprit}</div>}
                </td>
                <td style={{...S.td,fontWeight:700}}>{is.count}</td>
                <td style={S.td}>{is.userCount}</td>
                <td style={{...S.td,fontSize:11,color:"#64748b"}}>{is.lastSeen ? new Date(is.lastSeen).toLocaleString("fr-FR") : "—"}</td>
                <td style={S.td}>
                  {is.permalink && <a href={is.permalink} target="_blank" rel="noopener noreferrer" style={{color:C.blue,fontSize:12,fontWeight:700,textDecoration:"none"}}>Voir ↗</a>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}
