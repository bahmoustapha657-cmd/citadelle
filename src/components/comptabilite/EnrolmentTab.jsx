import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, aReinscrire, estReinscrit, estSorti, getAnnee, sectionOuverte } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { DepartsView } from "./enrolment/DepartsView";
import { EnrolModale } from "./enrolment/EnrolModale";
import { RapideEnrolModale } from "./enrolment/RapideEnrolModale";
import { ImportEnrolModale } from "./enrolment/ImportEnrolModale";
import { EnrolPlanAlerte } from "./enrolment/EnrolPlanAlerte";
import { EnrolToolbar } from "./enrolment/EnrolToolbar";
import { EnrolTable } from "./enrolment/EnrolTable";

export function EnrolmentTab({
  form, setForm, modal, setModal, canCreate, canEdit,
  elevesC, elevesL, elevesP, elevesPre = [], cEC, cEL, cEP,
  tousElevesScolarite, ajoutParNiveau, suppressionParNiveau,
  modifParNiveau, ensureClasse, sortAlpha,
  encaisserInscriptions, getTarifInscriptionEleve, tarifsClasses = [],
}) {
  const { t } = useTranslation();
  const { schoolId, schoolInfo, toast, planInfo, moisAnnee } = useContext(SchoolContext);

  const [niveauChoisi, setNiveauChoisi] = useState("college");
  const [classeEnrol, setClasseEnrol] = useState("all");
  const [afficherDeparts, setAfficherDeparts] = useState(false);
  // Filtre de rentrée : « qui n'a pas encore réglé son inscription ? ».
  const [filtreReinscription, setFiltreReinscription] = useState("all");

  // Cycle affiché : le choix s'il est ouvert dans l'école, sinon la première
  // section ouverte — une école sans collège ne s'ouvre pas sur une liste vide.
  const niveauEnrol = sectionOuverte(schoolInfo, niveauChoisi);
  // Changer de cycle réinitialise le filtre classe (les classes diffèrent).
  const setNiveauEnrol = (v) => { setNiveauChoisi(v); setClasseEnrol("all"); };

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP, prescolaire: elevesPre };
  // Liste complète du cycle, élèves partis compris : sert aux matricules (un
  // matricule ne se réattribue pas) et à l'écran Départs.
  const elevesEnrol = sortAlpha(elevesParNiveau[niveauEnrol] || []);
  // Les élèves partis ont leur écran (📤 Départs) : ils ne chargent plus la
  // liste, les compteurs de rentrée ni la liste de classe imprimée.
  const presents = (liste) => liste.filter((e) => !estSorti(e));
  const elevesPresents = presents(elevesEnrol);
  // Classes disponibles dans la vue + liste affichée (filtrée par classe).
  const classesEnrol = [...new Set((afficherDeparts ? elevesEnrol : elevesPresents).map((e) => e.classe).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
  const dansClasse = (e) => classeEnrol === "all" || e.classe === classeEnrol;
  const elevesClasse = elevesPresents.filter(dansClasse);
  const elevesAffiches = filtreReinscription === "all" ? elevesClasse
    : filtreReinscription === "a_reinscrire" ? elevesClasse.filter(aReinscrire)
      : elevesClasse.filter(estReinscrit);
  // Compteurs de la sélection courante (cycle + classe), affichés dans la
  // barre d'outils : c'est l'indicateur de rentrée de la direction.
  const nbAReinscrire = elevesClasse.filter(aReinscrire).length;
  const ajEnrol = ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
  const supEnrol = suppressionParNiveau[niveauEnrol] || suppressionParNiveau.college;
  const modEnrol = modifParNiveau[niveauEnrol] || modifParNiveau.college;

  return (
    <div>
      <EnrolPlanAlerte planInfo={planInfo}/>

      <EnrolToolbar
        t={t} afficherDeparts={afficherDeparts} setAfficherDeparts={setAfficherDeparts}
        planInfo={planInfo} niveauEnrol={niveauEnrol} setNiveauEnrol={setNiveauEnrol}
        classeEnrol={classeEnrol} setClasseEnrol={setClasseEnrol} classesEnrol={classesEnrol}
        elevesC={presents(elevesC)} elevesL={presents(elevesL)} elevesP={presents(elevesP)} elevesPre={presents(elevesPre)} canCreate={canCreate}
        elevesEnrol={elevesEnrol} elevesPresents={elevesPresents} schoolInfo={schoolInfo} setForm={setForm} setModal={setModal}
        filtreReinscription={filtreReinscription} setFiltreReinscription={setFiltreReinscription}
        nbAReinscrire={nbAReinscrire} nbSelection={elevesClasse.length}
        totalAReinscrire={elevesClasse.filter(aReinscrire)
          .reduce((s, e) => s + (getTarifInscriptionEleve ? getTarifInscriptionEleve(e) : 0), 0)}
        onEncaisserInscriptions={() => encaisserInscriptions?.(elevesClasse.filter(aReinscrire))}
      />

      <div style={{background:"#e0ebf8",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:C.blueDark}}>
        🔒 Seul le <strong>Comptable</strong> peut enrôler ou supprimer des élèves.
      </div>

      {!afficherDeparts&&<EnrolTable
        cEC={cEC} cEL={cEL} cEP={cEP} elevesEnrol={elevesAffiches} canEdit={canEdit}
        canCreate={canCreate} planInfo={planInfo} niveauEnrol={niveauEnrol}
        schoolInfo={schoolInfo} setForm={setForm} setModal={setModal} supEnrol={supEnrol}
      />}
      {afficherDeparts&&<DepartsView
        elevesEnrol={elevesEnrol.filter(dansClasse)} canEdit={canEdit} modEnrol={modEnrol} toast={toast}
        setForm={setForm} setModal={setModal} niveauEnrol={niveauEnrol}
        schoolInfo={schoolInfo} moisAnnee={moisAnnee} tarifsClasses={tarifsClasses}
        anneeOfficielle={schoolInfo?.anneeScolaire || getAnnee()}
      />}

      {((modal==="add_enrol"&&canCreate)||(modal==="edit_enrol"&&canEdit))&&<EnrolModale
        modal={modal} setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolId={schoolId} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajEnrol={ajEnrol} modEnrol={modEnrol} ensureClasse={ensureClasse}/>}

      {/* Saisie rapide : chaque élève choisit sa section dans la modale, d'où
          les ajouts et listes de TOUTES les sections. */}
      {modal==="rapide_enrol"&&canCreate&&<RapideEnrolModale
        setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolId={schoolId} schoolInfo={schoolInfo} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajoutParNiveau={ajoutParNiveau} ensureClasse={ensureClasse} elevesParNiveau={elevesParNiveau}/>}

      {modal==="import_enrol"&&canCreate&&<ImportEnrolModale
        setModal={setModal} niveauEnrol={niveauEnrol} schoolInfo={schoolInfo} toast={toast}
        tousElevesScolarite={tousElevesScolarite} ajoutParNiveau={ajoutParNiveau}
        ensureClasse={ensureClasse} elevesEnrol={elevesEnrol}/>}
    </div>
  );
}
