import { C, fmt, genererMatricule, isSectionActive } from "../../../constants";
import { Btn } from "../../ui";
import { imprimerListeClasse } from "../../../reports";
import { sansNonReinscritsEcartes } from "../../../ecartes-non-reinscrits";
import { TriElevesSelect } from "../../TriElevesSelect";
import { libelleSection } from "../../../i18n/libelles";

// Barre d'outils de l'enrôlement : titre + compteur de plan, sélecteur de
// niveau, filtre classe + impression de la liste de classe, bascule Départs
// et boutons d'ajout (normal/rapide/import Excel).
export function EnrolToolbar({
  t, afficherDeparts, setAfficherDeparts, planInfo,
  niveauEnrol, setNiveauEnrol, elevesC, elevesL, elevesP, elevesPre = [],
  classeEnrol, setClasseEnrol, classesEnrol = [],
  canCreate, elevesEnrol, elevesPresents = elevesEnrol, schoolInfo, setForm, setModal,
  filtreReinscription = "all", setFiltreReinscription = () => {},
  nbAReinscrire = 0, nbSelection = 0, totalAReinscrire = 0, onEncaisserInscriptions,
  tri = "alpha", setTri = () => {}, onSeancePhoto = null,
}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,flex:1,color:C.blueDark}}>
        {afficherDeparts?`📤 ${t("accounting.enrol.departsTitle")}`:t("school.students.title")}
        {!afficherDeparts&&<span style={{marginLeft:10,fontSize:11,fontWeight:600,color:
          planInfo?.peutAjouterEleve?"#16a34a":"#dc2626"}}>
          {t("accounting.enrol.planCount", { active: planInfo?.totalElevesActifs ?? "…", limit: planInfo?.eleveLimit===Infinity?"∞":planInfo?.eleveLimit, plan: planInfo?.planLabel })}
        </span>}
      </strong>
      <select value={niveauEnrol} onChange={e=>setNiveauEnrol(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
        {/* Seules les sections ouvertes dans l'école (Paramètres → Identité). */}
        {[
          ["college", elevesC],
          ["lycee", elevesL],
          ["primaire", elevesP],
          ["prescolaire", elevesPre],
        ].filter(([section]) => isSectionActive(schoolInfo, section)).map(([section, liste]) => (
          <option key={section} value={section}>{t("accounting.enrol.sectionOption", { label: libelleSection(section), count: liste.length })}</option>
        ))}
      </select>
      {classesEnrol.length>0&&(
        <select value={classeEnrol} onChange={e=>setClasseEnrol(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="all">{t("accounting.enrol.allClasses")}</option>
          {classesEnrol.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {/* Filtre de rentrée. Le compteur donne l'état d'avancement de la
          sélection courante sans avoir à ouvrir quoi que ce soit. */}
      {!afficherDeparts&&(
        <select value={filtreReinscription} onChange={e=>setFiltreReinscription(e.target.value)}
          title={t("accounting.enrol.reenrolHint")}
          style={{border:"1px solid "+(nbAReinscrire?"#fbbf24":"#b0c4d8"),borderRadius:7,padding:"6px 10px",fontSize:12,
            background:nbAReinscrire?"#fffbeb":"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="all">{t("accounting.enrol.filterAll", { count: nbSelection })}</option>
          <option value="a_reinscrire">{t("accounting.enrol.filterToReenrol", { count: nbAReinscrire })}</option>
          <option value="reinscrits">{t("accounting.enrol.filterReenrolled", { count: Math.max(0, nbSelection - nbAReinscrire) })}</option>
        </select>
      )}
      {!afficherDeparts&&<TriElevesSelect liste="enrolement" value={tri} onChange={setTri}/>}
      {/* Encaissement groupé. Le libellé annonce le MONTANT : c'est de
          l'argent déclaré reçu, pas une simple case à cocher. */}
      {!afficherDeparts&&canCreate&&nbAReinscrire>0&&onEncaisserInscriptions&&(
        <Btn sm v="success" title={t("accounting.enrol.bulkHint")}
          onClick={onEncaisserInscriptions}>
          💰 {t("accounting.enrol.bulkBtn", { count: nbAReinscrire, amount: totalAReinscrire>0?` — ${fmt(totalAReinscrire)}`:"" })}
        </Btn>
      )}
      {!afficherDeparts&&classeEnrol!=="all"&&(
        <Btn sm v="ghost" title={t("accounting.enrol.printClassHint")}
          onClick={()=>imprimerListeClasse(classeEnrol, sansNonReinscritsEcartes(elevesPresents, schoolInfo), schoolInfo)}>
          🖨️ {t("accounting.enrol.printClass")}
        </Btn>
      )}
      {/* Photos et surnoms à la chaîne, sans rouvrir chaque fiche. */}
      {!afficherDeparts&&onSeancePhoto&&(
        <Btn sm v="ghost" title={t("accounting.enrol.photoHint")}
          onClick={onSeancePhoto}>📸 {t("accounting.enrol.photoSession")}</Btn>
      )}
      <Btn sm v={afficherDeparts?"blue":"ghost"} onClick={()=>setAfficherDeparts(d=>!d)}>
        {afficherDeparts?`👥 ${t("accounting.enrol.activeStudents")}`:`📤 ${t("accounting.enrol.departures")}`}
      </Btn>
      {!afficherDeparts&&canCreate&&(
        planInfo?.peutAjouterEleve
          ? <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Btn onClick={()=>{
                const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                // i18n-ignore
                setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                setModal("add_enrol");
              }}>{t("accounting.enrol.newStudent")}</Btn>
              <Btn v="ghost" title={t("accounting.enrol.quickHint")} onClick={()=>{
                const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                // i18n-ignore
                setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                setModal("rapide_enrol");
              }}>⚡ {t("accounting.enrol.quick")}</Btn>
              <Btn v="ghost" title={t("accounting.enrol.importHint")} onClick={()=>{setModal("import_enrol");}}>📋 {t("accounting.enrol.importExcel")}</Btn>
            </div>
          : <Btn disabled title={t("accounting.enrol.limitHint")}>🔒 {t("accounting.enrol.limitReached")}</Btn>
      )}
    </div>
  );
}
