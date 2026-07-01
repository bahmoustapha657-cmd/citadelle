import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
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
  elevesC, elevesL, elevesP, cEC, cEL, cEP,
  tousElevesScolarite, ajoutParNiveau, suppressionParNiveau,
  modifParNiveau, ensureClasse, sortAlpha,
}) {
  const { t } = useTranslation();
  const { schoolId, schoolInfo, toast, planInfo } = useContext(SchoolContext);

  const [niveauEnrol, setNiveauEnrolRaw] = useState("college");
  const [classeEnrol, setClasseEnrol] = useState("all");
  const [afficherDeparts, setAfficherDeparts] = useState(false);

  // Changer de cycle réinitialise le filtre classe (les classes diffèrent).
  const setNiveauEnrol = (v) => { setNiveauEnrolRaw(v); setClasseEnrol("all"); };

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  // Liste complète du cycle : sert aux matricules et au compteur de plan.
  const elevesEnrol = sortAlpha(elevesParNiveau[niveauEnrol] || []);
  // Classes disponibles dans le cycle + liste affichée (filtrée par classe).
  const classesEnrol = [...new Set(elevesEnrol.map((e) => e.classe).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
  const elevesAffiches = classeEnrol === "all" ? elevesEnrol : elevesEnrol.filter((e) => e.classe === classeEnrol);
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
        elevesC={elevesC} elevesL={elevesL} elevesP={elevesP} canCreate={canCreate}
        elevesEnrol={elevesEnrol} schoolInfo={schoolInfo} setForm={setForm} setModal={setModal}
      />

      <div style={{background:"#e0ebf8",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:C.blueDark}}>
        🔒 Seul le <strong>Comptable</strong> peut enrôler ou supprimer des élèves.
      </div>

      {!afficherDeparts&&<EnrolTable
        cEC={cEC} cEL={cEL} cEP={cEP} elevesEnrol={elevesAffiches} canEdit={canEdit}
        canCreate={canCreate} planInfo={planInfo} niveauEnrol={niveauEnrol}
        schoolInfo={schoolInfo} setForm={setForm} setModal={setModal} supEnrol={supEnrol}
      />}
      {afficherDeparts&&<DepartsView elevesEnrol={elevesAffiches} canEdit={canEdit} modEnrol={modEnrol} toast={toast}/>}

      {((modal==="add_enrol"&&canCreate)||(modal==="edit_enrol"&&canEdit))&&<EnrolModale
        modal={modal} setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolId={schoolId} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajEnrol={ajEnrol} modEnrol={modEnrol} ensureClasse={ensureClasse}/>}

      {modal==="rapide_enrol"&&canCreate&&<RapideEnrolModale
        setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolInfo={schoolInfo} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajEnrol={ajEnrol} ensureClasse={ensureClasse} elevesEnrol={elevesEnrol}/>}

      {modal==="import_enrol"&&canCreate&&<ImportEnrolModale
        setModal={setModal} niveauEnrol={niveauEnrol} schoolInfo={schoolInfo} toast={toast}
        tousElevesScolarite={tousElevesScolarite} ajoutParNiveau={ajoutParNiveau}
        ensureClasse={ensureClasse} elevesEnrol={elevesEnrol}/>}
    </div>
  );
}
