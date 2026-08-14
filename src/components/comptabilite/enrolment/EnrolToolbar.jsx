import { C, fmt, genererMatricule } from "../../../constants";
import { Btn } from "../../ui";
import { imprimerListeClasse } from "../../../reports";

// Barre d'outils de l'enrôlement : titre + compteur de plan, sélecteur de
// niveau, filtre classe + impression de la liste de classe, bascule Départs
// et boutons d'ajout (normal/rapide/import Excel).
export function EnrolToolbar({
  t, afficherDeparts, setAfficherDeparts, planInfo,
  niveauEnrol, setNiveauEnrol, elevesC, elevesL, elevesP, elevesPre = [],
  classeEnrol, setClasseEnrol, classesEnrol = [],
  canCreate, elevesEnrol, schoolInfo, setForm, setModal,
  filtreReinscription = "all", setFiltreReinscription = () => {},
  nbAReinscrire = 0, nbSelection = 0, totalAReinscrire = 0, onEncaisserInscriptions,
}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,flex:1,color:C.blueDark}}>
        {afficherDeparts?"📤 Départs & Statistiques":t("school.students.title")}
        {!afficherDeparts&&<span style={{marginLeft:10,fontSize:11,fontWeight:600,color:
          planInfo?.peutAjouterEleve?"#16a34a":"#dc2626"}}>
          ({planInfo?.totalElevesActifs ?? "…"}/{planInfo?.eleveLimit===Infinity?"∞":planInfo?.eleveLimit} élèves — Plan {planInfo?.planLabel})
        </span>}
      </strong>
      <select value={niveauEnrol} onChange={e=>setNiveauEnrol(e.target.value)}
        style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
        <option value="college">Collège ({elevesC.length} élèves)</option>
        <option value="lycee">Lycée ({elevesL.length} élèves)</option>
        <option value="primaire">Primaire ({elevesP.length} élèves)</option>
        <option value="prescolaire">Préscolaire ({elevesPre.length} élèves)</option>
      </select>
      {classesEnrol.length>0&&(
        <select value={classeEnrol} onChange={e=>setClasseEnrol(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="all">Toutes les classes</option>
          {classesEnrol.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {/* Filtre de rentrée. Le compteur donne l'état d'avancement de la
          sélection courante sans avoir à ouvrir quoi que ce soit. */}
      {!afficherDeparts&&(
        <select value={filtreReinscription} onChange={e=>setFiltreReinscription(e.target.value)}
          title="Réinscription = inscription encaissée pour l'année en cours"
          style={{border:"1px solid "+(nbAReinscrire?"#fbbf24":"#b0c4d8"),borderRadius:7,padding:"6px 10px",fontSize:12,
            background:nbAReinscrire?"#fffbeb":"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="all">Tous ({nbSelection})</option>
          <option value="a_reinscrire">À réinscrire ({nbAReinscrire})</option>
          <option value="reinscrits">Réinscrits ({Math.max(0, nbSelection - nbAReinscrire)})</option>
        </select>
      )}
      {/* Encaissement groupé. Le libellé annonce le MONTANT : c'est de
          l'argent déclaré reçu, pas une simple case à cocher. */}
      {!afficherDeparts&&canCreate&&nbAReinscrire>0&&onEncaisserInscriptions&&(
        <Btn sm v="success" title="Marque l'inscription comme encaissée pour les élèves à réinscrire de la sélection"
          onClick={onEncaisserInscriptions}>
          💰 Réinscrire {nbAReinscrire} élève(s){totalAReinscrire>0?` — ${fmt(totalAReinscrire)}`:""}
        </Btn>
      )}
      {!afficherDeparts&&classeEnrol!=="all"&&(
        <Btn sm v="ghost" title="Imprimer la liste des élèves de la classe sélectionnée"
          onClick={()=>imprimerListeClasse(classeEnrol, elevesEnrol, schoolInfo)}>
          🖨️ Liste de la classe
        </Btn>
      )}
      <Btn sm v={afficherDeparts?"blue":"ghost"} onClick={()=>setAfficherDeparts(d=>!d)}>
        {afficherDeparts?"👥 Élèves actifs":"📤 Départs"}
      </Btn>
      {!afficherDeparts&&canCreate&&(
        planInfo?.peutAjouterEleve
          ? <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Btn onClick={()=>{
                const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                setModal("add_enrol");
              }}>+ Nouvel élève</Btn>
              <Btn v="ghost" title="Saisie rapide : formulaire minimal, enchaîner plusieurs élèves" onClick={()=>{
                const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                setModal("rapide_enrol");
              }}>⚡ Rapide</Btn>
              <Btn v="ghost" title="Importer depuis un fichier Excel ou CSV" onClick={()=>{setModal("import_enrol");}}>📋 Import Excel</Btn>
            </div>
          : <Btn disabled title="Limite du plan atteinte — Contactez le Super-Admin">🔒 Limite atteinte</Btn>
      )}
    </div>
  );
}
