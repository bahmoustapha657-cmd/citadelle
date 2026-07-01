import { C } from "../../../constants";
import { Btn } from "../../ui";
import { imprimerBulletinsGroupes, imprimerFicheCompositions, PERIODE_ANNEE } from "../../../reports";

// Barre d'outils des bulletins : recherche, sélecteurs période/classe et
// boutons d'impression (résultats d'évaluation, bulletins groupés).
export function BulletinsToolbar({
  t, rechercheMatricule, setRechercheMatricule, periodeB, setPeriodeB, periodes,
  filtreClasse, setFiltreClasse, classesUniq, elevesFiltres, schoolInfo, moisAnnee,
  notes, matieres, maxNote, avecEns, matieresForClasse, appreciationsParEleveB,
  batchAppr, canGenererLot,
}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.bulletins.title")}</strong>
      <input placeholder={t("school.bulletins.searchByMatricule")}
        value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
      <select value={periodeB} onChange={e=>setPeriodeB(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
        {periodes.map(p=><option key={p} value={p}>{p}</option>)}
        <option value={PERIODE_ANNEE}>🏁 {t("reports.annual")}</option>
      </select>
      <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
        <option value="all">{t("common.all")}</option>
        {classesUniq.map(c=><option key={c}>{c}</option>)}
      </select>
      <Btn v="success" onClick={()=>{
        const elevesC=(filtreClasse==="all"?elevesFiltres:elevesFiltres.filter(e=>e.classe===filtreClasse))
          .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
        imprimerFicheCompositions(filtreClasse,periodeB,notes,matieres,elevesC,maxNote,schoolInfo,periodes,matieresForClasse);
      }}>
        {t("school.bulletins.evaluationResults")}
      </Btn>
      <Btn v="vert" onClick={()=>{
        const elevesBtn=elevesFiltres
          .filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()))
          .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
        imprimerBulletinsGroupes(elevesBtn,notes,matieres,periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,filtreClasse==="all"?"Toutes classes":filtreClasse,matieresForClasse,appreciationsParEleveB(periodeB));
      }}>
        {t("school.bulletins.allBulletins")} {filtreClasse!=="all"?`— ${filtreClasse}`:""}
      </Btn>
      {canGenererLot && batchAppr && (
        <Btn v="vert" sm onClick={batchAppr.lancer} disabled={batchAppr.running}
          title="Génère par IA une appréciation pour chaque élève affiché qui n'en a pas encore (période sélectionnée)">
          {batchAppr.running
            ? `✨ Génération… ${batchAppr.progress.done}/${batchAppr.progress.total}`
            : "✨ Générer les appréciations (IA)"}
        </Btn>
      )}
    </div>
  );
}
