import { Badge, Btn } from "../../ui";
import { exportExcel } from "../../../reports";

// Bandeau d'alerte : élèves avec ≥ 3 absences non justifiées (masqué si aucun).
export function DisciplineAlertes({ eleves, absences, t }) {
  const elevesAlerte = eleves.map(e=>({
    ...e,
    nbAbs:absences.filter(a=>a.eleveNom===`${e.nom} ${e.prenom}`&&a.type==="Absence"&&a.justifie==="Non").length,
  })).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs);

  if (elevesAlerte.length === 0) return null;

  return (
    <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:18}}>⚠️</span>
        <strong style={{fontSize:13,color:"#92400e"}}>Alertes absences — {elevesAlerte.length} élève(s) avec 3 absences non justifiées ou plus</strong>
        <Btn sm v="ghost" style={{marginInlineStart:"auto"}} onClick={()=>exportExcel(
          t("reports.excel.files.attendanceAlerts"),
          [t("reports.excel.headers.lastName"),t("reports.excel.headers.firstName"),t("reports.excel.headers.class"),t("reports.excel.headers.countUnjustified"),t("reports.excel.headers.guardian"),t("reports.excel.headers.contact")],
          elevesAlerte.map(e=>[e.nom,e.prenom,e.classe,e.nbAbs,e.tuteur||"",e.contactTuteur||""])
        )}>📥 {t("common.export")}</Btn>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {elevesAlerte.map(e=>(
          <div key={e._id} style={{background:"#fff",border:"1px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12}}>
            <span style={{fontWeight:800,color:"#92400e"}}>{e.nom} {e.prenom}</span>
            <span style={{color:"#6b7280"}}> · {e.classe} · </span>
            <Badge color="amber">{e.nbAbs} absences</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
