// Aperçu d'un fichier d'import : colonnes détectées (mapping), compteurs
// valides/avertissements/bloqués et tableau ligne par ligne.
import { useTranslation } from "react-i18next";

export function ImportEnrolPreview({ importEnrolPreview }) {
  const { t } = useTranslation();
  const entetes = [t("accounting.import.colLine"), t("accounting.import.field.nom"), t("accounting.import.field.prenom"),
    t("accounting.import.field.classe"), t("accounting.import.field.sexe"), t("accounting.import.colBirth"),
    t("accounting.import.field.tuteur"), t("accounting.cols.status")];
  return (
    <>
      <div style={{marginBottom:12,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
        <div style={{background:"#f8fafc",padding:"8px 14px",fontSize:11,fontWeight:800,color:"#475569",borderBottom:"1px solid #e2e8f0"}}>
          🗺️ {t("accounting.import.detected")}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 14px"}}>
          {importEnrolPreview.mapping.map(({champ,colonne})=>(
            <span key={champ} style={{
              padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
              background:colonne?"#dcfce7":"#fef9c3",
              color:colonne?"#15803d":"#92400e",
              border:`1px solid ${colonne?"#86efac":"#fde68a"}`
            }}>
              {champ} {colonne?`→ "${colonne}"` :t("accounting.import.notFound")}
            </span>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:14,marginBottom:10,fontSize:12,flexWrap:"wrap"}}>
        <span style={{color:"#059669",fontWeight:700}}>✅ {t("accounting.import.ready", { count: importEnrolPreview.valides.length })}</span>
        {importEnrolPreview.nbAvert>0&&<span style={{color:"#d97706",fontWeight:700}}>⚠️ {t("accounting.import.withWarning", { count: importEnrolPreview.nbAvert })}</span>}
        <span style={{color:"#dc2626",fontWeight:700}}>❌ {t("accounting.import.blocked", { count: importEnrolPreview.lignes.length-importEnrolPreview.valides.length })}</span>
      </div>
      <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8,marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
            {entetes.map(h=>(
              <th key={h} style={{padding:"6px 8px",textAlign:"start",fontSize:10,color:"#64748b"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{importEnrolPreview.lignes.map((l,i)=>(
            <tr key={i} style={{background:l.erreurs.length?"#fef2f2":l.avertissements?.length?"#fffbeb":"#f0fdf4",borderBottom:"1px solid #f1f5f9"}}>
              <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10}}>{l.ligne}</td>
              <td style={{padding:"4px 8px",fontWeight:600}}>{l.nom||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.prenom||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.classe||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.sexe}</td>
              <td style={{padding:"4px 8px"}}>{l.dateNaissance||"—"}</td>
              <td style={{padding:"4px 8px"}}>{l.tuteur||"—"}</td>
              <td style={{padding:"4px 8px"}}>
                {l.erreurs.length
                  ?<span style={{color:"#dc2626",fontSize:10}}>❌ {l.erreurs.join(", ")}</span>
                  :l.avertissements?.length
                    ?<span style={{color:"#d97706",fontSize:10}}>⚠️ {l.avertissements.join(", ")}</span>
                    :<span style={{color:"#059669",fontSize:10}}>✅</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
