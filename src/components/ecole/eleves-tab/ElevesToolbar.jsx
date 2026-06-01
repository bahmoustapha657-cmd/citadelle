import { useTranslation } from "react-i18next";
import { C } from "../../../constants";
import { Btn } from "../../ui";
import { imprimerCartesEleves, imprimerListeClasse, exportExcel } from "../../../reports";

// Barre d'outils de l'onglet Élèves : titre, filtre par classe, impression
// liste/cartes et export Excel.
export function ElevesToolbar({
  eleves, elevesFiltres, filtreClasse, setFiltreClasse, classesUniq,
  avecEns, annee, schoolInfo,
}) {
  const { t } = useTranslation();
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.students.title")} ({eleves.length})</strong>
      <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
        <option value="all">{t("common.all")}</option>
        {classesUniq.map(c=><option key={c}>{c}</option>)}
      </select>
      {filtreClasse!=="all"&&<Btn sm v="ghost" onClick={()=>imprimerListeClasse(filtreClasse,eleves,schoolInfo)}>🖨️ {t("common.print")}</Btn>}
      <Btn sm v="blue" onClick={()=>imprimerCartesEleves(elevesFiltres,schoolInfo,annee)}>🪪 {t("reports.card.title")}</Btn>
      <Btn sm v="ghost" onClick={()=>exportExcel(
        `${t("reports.excel.files.students")}_${avecEns?"College":"Primaire"}`,
        [t("reports.excel.headers.matricule"),t("reports.excel.headers.ien"),t("reports.excel.headers.lastName"),t("reports.excel.headers.firstName"),t("reports.excel.headers.class"),t("reports.excel.headers.sex"),t("reports.excel.headers.dateOfBirth"),t("reports.excel.headers.birthPlace"),t("reports.excel.headers.filiation"),t("reports.excel.headers.guardian"),t("reports.excel.headers.contact"),t("reports.excel.headers.domicile"),t("reports.excel.headers.status")],
        elevesFiltres.map(e=>[e.matricule||"",e.ien||"",e.nom,e.prenom,e.classe,e.sexe||"",e.dateNaissance||"",e.lieuNaissance||"",e.filiation||"",e.tuteur||"",e.contactTuteur||"",e.domicile||"",e.statut||t("school.students.active")])
      )}>📥 {t("common.export")} Excel</Btn>
    </div>
  );
}
