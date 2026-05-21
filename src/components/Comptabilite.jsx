import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { doc, updateDoc } from "firebase/firestore";
import {
  C,
  getAnnee,
  CLASSES_PRIMAIRE,
  CLASSES_COLLEGE,
  CLASSES_LYCEE,
  peutModifierEleves,
  peutModifier,
} from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { db } from "../firebaseDb";
import { Badge, Card, Modale, Champ, Input, Selec, Btn, THead, TR, TD, Stat, Tabs, Vide, Chargement, LectureSeule } from "./ui";
import { imprimerEtatsSalaires } from "../reports";
import { autoGenererSalairesAction, genererSalairesPourMois } from "./comptabilite/salary-actions";
import { appliquerBons as appliquerBonsAction, toggleFraisAnnexe as toggleFraisAnnexeAction, toggleMens as toggleMensAction } from "./comptabilite/payment-actions";
import { ensureClasse as ensureClasseHelper, sortAlphaEleves } from "./comptabilite/eleves-helpers";
import { Fondation } from "./Fondation";
import { TarifsClasses } from "./TarifsClasses";
import { TransfertsPanel } from "./TransfertsPanel";
import { EnrolmentTab } from "./comptabilite/EnrolmentTab";
import { RecettesTab } from "./comptabilite/RecettesTab";
import { DepensesTab } from "./comptabilite/DepensesTab";
import { FondationTab } from "./comptabilite/FondationTab";
import { PersonnelTab } from "./comptabilite/PersonnelTab";
import { BilanTab } from "./comptabilite/BilanTab";
import { MensualitesTab } from "./comptabilite/MensualitesTab";
import { EnseignantsTab } from "./comptabilite/EnseignantsTab";
import { SalairesTab } from "./comptabilite/SalairesTab";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../staff-utils";
import { getPeriodesForSchool } from "../period-utils";
import {
  getMensualiteOverview,
  getTarifAutreForClasse,
  getTarifBaseForClasse,
  getTarifConfigForClasse,
  getTarifInscriptionForClasse,
  getTarifInscriptionForEleve as getTarifInscriptionForEleveValue,
  getTarifMensuelForClasse,
  getTarifReinscriptionForClasse,
  getTarifRevisionForClasse,
} from "../mensualite-utils";
import {
  findSalaryDuplicate,
  getForfaitNet,
  getSalaryExecutionHours,
  getSalaryMontantBrut,
  getSalaryNet,
  summarizeSalaryTotals,
} from "../salary-utils";

function Comptabilite({readOnly, annee, userRole, verrouOuvert=false}) {
  const { t } = useTranslation();
  // readOnly=true → admin/direction : zéro action
  // canEdit → modifier/supprimer des enregistrements existants (verrou admin requis sauf admin lui-même — mais admin est readOnly)
  // canCreate → ajouter de nouveaux enregistrements (toujours permis si !readOnly)
  const anneeCourante = annee || getAnnee();
  const [anneeConsultee, setAnneeConsultee] = useState(anneeCourante);
  // Vue archive : filtre lecture mais désactive la création (les écritures iraient sur l'année courante).
  const enModeArchive = anneeConsultee !== anneeCourante;
  const anneeFiltre = enModeArchive ? anneeConsultee : null;
  const canCreate = !readOnly && !enModeArchive;
  const canEdit = !readOnly && !enModeArchive && (peutModifier(userRole) || verrouOuvert);
  const canEditEleves = !readOnly && !enModeArchive && (peutModifierEleves(userRole) || verrouOuvert);
  const {schoolId, schoolInfo, moisAnnee, moisSalaire, toast, logAction, envoyerPush} = useContext(SchoolContext);
  const {items:recettes,chargement:cR,ajouter:ajR,modifier:modR,supprimer:supR}=useFirestore("recettes",{annee:anneeFiltre});
  const {items:depenses,chargement:cD,ajouter:ajD,modifier:modD,supprimer:supD}=useFirestore("depenses",{annee:anneeFiltre});
  const {items:salaires,chargement:cS,ajouter:ajS,modifier:modS,supprimer:supS}=useFirestore("salaires",{annee:anneeFiltre});
  const {items:bons,ajouter:ajBon,modifier:modBon,supprimer:supBon}=useFirestore("bons",{annee:anneeFiltre});
  const {items:personnel,chargement:cPers,ajouter:ajPers,modifier:modPers,supprimer:supPers}=useFirestore("personnel");
  const {items:versements,chargement:cV,ajouter:ajV,modifier:modV,supprimer:supV}=useFirestore("versements",{annee:anneeFiltre});
  const {items:elevesC,chargement:cEC,ajouter:ajEC,modifier:modEC_full,supprimer:supEC,modifierChamp:modEC}=useFirestore("elevesCollege");
  const {items:elevesP,chargement:cEP,ajouter:ajEP,modifier:modEP_full,supprimer:supEP,modifierChamp:modEP}=useFirestore("elevesPrimaire");
  const {items:elevesL,chargement:cEL,ajouter:ajEL,modifier:modEL_full,supprimer:supEL,modifierChamp:modEL}=useFirestore("elevesLycee");
  const {items:tarifsClasses,ajouter:ajTarif,modifier:modTarif}=useFirestore("tarifs");
  const {items:classesCollegeList,ajouter:ajClasseCollege}=useFirestore("classesCollege");
  const {items:classesPrimaireList,ajouter:ajClassePrimaire}=useFirestore("classesPrimaire");
  const {items:classesLyceeList,ajouter:ajClasseLycee}=useFirestore("classesLycee");
  // Enseignants — création/édition de la paie depuis Compta (vue hybride)
  const {items:ensCollege,ajouter:ajEnsCol,modifier:modEnsCol,supprimer:supEnsCol}=useFirestore("ensCollege");
  const {items:ensLycee,ajouter:ajEnsLyc,modifier:modEnsLyc,supprimer:supEnsLyc}=useFirestore("ensLycee");
  const {items:ensPrimaire,ajouter:ajEnsPrim,modifier:modEnsPrim,supprimer:supEnsPrim}=useFirestore("ensPrimaire");
  const {items:emploisCollege}=useFirestore("classesCollege_emplois");
  const {items:emploisLycee}=useFirestore("classesLycee_emplois");
  const {items:engCollege}=useFirestore("ensCollege_enseignements");
  const {items:engLycee}=useFirestore("ensLycee_enseignements");

  const [tab,setTab]=useState("bilan");
  const [sousTabSal,setSousTabSal]=useState("etats");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [niveau,setNiveau]=useState("college");
  const [filtClasse,setFiltClasse]=useState("all");
  const [moisSel,setMoisSel]=useState(()=>moisSalaire[0]||"Octobre");
  const [primeDefaut,setPrimeDefaut]=useState(0);
  const [filtrePrimNom,setFiltrePrimNom]=useState("");
  const [filtrePrimClasse,setFiltrePrimClasse]=useState("all");

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  const modChampParNiveau = { college: modEC, lycee: modEL, primaire: modEP };
  const ajoutParNiveau = { college: ajEC, lycee: ajEL, primaire: ajEP };
  const suppressionParNiveau = { college: supEC, lycee: supEL, primaire: supEP };
  const modifParNiveau = { college: modEC_full, lycee: modEL_full, primaire: modEP_full };
  // Wrappers : injectent les listes de classes + ajouts Firestore au helper.
  const sortAlpha = (arr) => sortAlphaEleves(arr, schoolInfo.triEleves);
  const ensureClasse = (nom, niveau, dejaCreees) => {
    const cfg = niveau==="primaire" ? { classesList: classesPrimaireList, ajClasse: ajClassePrimaire }
      : niveau==="lycee" ? { classesList: classesLyceeList, ajClasse: ajClasseLycee }
      : { classesList: classesCollegeList, ajClasse: ajClasseCollege };
    return ensureClasseHelper(nom, { ...cfg, dejaCreees });
  };

  const totR=recettes.reduce((s,x)=>s+Number(x.montant),0);
  const totD=depenses.reduce((s,x)=>s+Number(x.montant),0);
  const totVers=versements.reduce((s,x)=>s+Number(x.montant),0);

  const eleves=elevesParNiveau[niveau] || elevesC;
  const modEleves=modChampParNiveau[niveau] || modEC;
  const classesU=[...new Set(eleves.map(e=>e.classe))].filter(Boolean);
  const tousElevesScolarite=[...elevesC,...elevesL,...elevesP];

  const getTarifConfig = (classe) => getTarifConfigForClasse(tarifsClasses, classe);
  const getTarif = (classe) => getTarifMensuelForClasse(tarifsClasses, classe);
  const getTarifBase = (classe) => getTarifBaseForClasse(tarifsClasses, classe);
  const getTarifRevision = (classe) => getTarifRevisionForClasse(tarifsClasses, classe);
  const getTarifAutre = (classe) => getTarifAutreForClasse(tarifsClasses, classe);
  const getTarifIns = (classe) => getTarifInscriptionForClasse(tarifsClasses, classe);
  const getTarifReinsc = (classe) => getTarifReinscriptionForClasse(tarifsClasses, classe);
  const getTarifInscriptionEleve = (eleve = {}) => getTarifInscriptionForEleveValue(eleve, tarifsClasses);
  const saveTarif = async (classe, montant, inscription=null, reinscription=null, revision=null, autre=null) => {
    const existing = getTarifConfig(classe);
    const data = {
      montant:Number(montant)||0,
      ...(inscription!==null?{inscription:Number(inscription)||0}:{}),
      ...(reinscription!==null?{reinscription:Number(reinscription)||0}:{}),
      ...(revision!==null?{revision:Number(revision)||0}:{}),
      ...(autre!==null?{autre:Number(autre)||0}:{})
    };
    if(existing) await modTarif({_id: existing._id, ...data});
    else await ajTarif({classe, ...data});
  };
  const elevesFiltres=sortAlpha(filtClasse==="all"?eleves:eleves.filter(e=>e.classe===filtClasse));

  // Wrappers : injectent les deps (modEleves, readOnly, canEdit, toast,
  // envoyerPush) à chaque appel. Le helper extrait porte la logique métier.
  const toggleFraisAnnexe = (_id, opts) => toggleFraisAnnexeAction(_id, opts, {
    readOnly, canEdit, toast, modEleves,
  });
  const toggleMens = (_id, mois, mensActuels, mensDatesActuels, nomEleve) =>
    toggleMensAction(_id, mois, mensActuels, mensDatesActuels, nomEleve, {
      readOnly, canEdit, toast, modEleves, envoyerPush,
    });

  const enreg=(aj,mod,extra={})=>{
    if(readOnly) return;
    const r={...form,...extra};
    if(modal.startsWith("add"))aj({...r,annee:annee||anneeConsultee});else mod(r);
    setModal(null);
  };

  // Sauvegarde d'une fiche de paie avec garde anti-doublon
  // (nom + mois + section) — évite 2 bulletins pour le même agent
  // le même mois via le formulaire manuel.
  const saveSalaire = async (extra={}) => {
    if(readOnly) return;
    const r = {...form, ...extra};
    const isEdit = modal === "edit_s";
    const doublon = findSalaryDuplicate(r, salaires, { excludeId: isEdit ? r._id : null });
    if(doublon){
      toast(`Une fiche existe déjà pour ${doublon.nom} en ${doublon.mois} (${doublon.section}).`, "warning");
      return;
    }
    if(isEdit) await modS(r);
    else await ajS({...r, annee: annee || anneeConsultee});
    setModal(null);
  };

  const savePersonnel = async () => {
    if(readOnly) return;
    const r={...form,salaireBase:Number(form.salaireBase||0)};
    const doublon = findStaffDuplicate(r, personnel, {
      excludeId: modal==="edit_p" ? r._id : null,
    });
    if(doublon){
      toast(getStaffDuplicateMessage(doublon, { label: "ce membre du personnel" }),"warning");
      return;
    }
    if(modal==="add_p") await ajPers(r); else await modPers(r);
    setModal(null);
  };

  // Salaires du mois sélectionné
  const moisLabel = moisSel==="__TOUS__" ? "Tous les mois (prévision)" : moisSel;
  const moisModale = moisSel==="__TOUS__" ? (moisSalaire[0]||"Octobre") : moisSel;
  const salairesMois = moisSel==="__TOUS__" ? [] : salaires.filter(s=>s.mois===moisSel);
  const salairesSec = salairesMois.filter(s=>s.section==="Secondaire");
  const salairesPrim = salairesMois.filter(s=>s.section==="Primaire");
  const salairesPers = salairesMois.filter(s=>s.section==="Personnel");
  const bonsMois = bons.filter(b=>b.mois===moisSel);

  const appliquerBons = () => appliquerBonsAction({
    moisSel, bonsMois, salairesMois, readOnly, toast, modS,
  });

  const calcExecute = (salary) => getSalaryExecutionHours(salary);
  const calcMontant = (salary) => getSalaryMontantBrut(salary);
  const calcNet = (salary) => getSalaryNet(salary);
  const calcNetF = (salary) => getForfaitNet(salary);
  const totalsSec = summarizeSalaryTotals(salairesSec);
  const totalsPrim = summarizeSalaryTotals(salairesPrim);
  const totalsPers = summarizeSalaryTotals(salairesPers);
  const totNetSec = totalsSec.net;
  const totMontantSec = totalsSec.montant;
  const totBonSec = totalsSec.bon;
  const totNetPrim = totalsPrim.net;
  const totMontantPrim = totalsPrim.montant;
  const totBonPrim = totalsPrim.bon;
  const totNetPers = totalsPers.net;
  const totMontantPers = totalsPers.montant;
  const totBonPers = totalsPers.bon;
  const totMontantGlobal = totalsSec.montant + totalsPrim.montant + totalsPers.montant;
  const totBonGlobal = totalsSec.bon + totalsPrim.bon + totalsPers.bon;
  const totNetGlobal = totalsSec.net + totalsPrim.net + totalsPers.net;
  const mensualiteOverview = getMensualiteOverview(tousElevesScolarite, moisAnnee, tarifsClasses);
  const periodes = getPeriodesForSchool(schoolInfo, moisAnnee);
  const defaultPeriode = periodes[0] || "T1";
  const impaye = mensualiteOverview.totalDu - mensualiteOverview.totalPercu;
  const pctImpaye = mensualiteOverview.totalDu > 0
    ? ((impaye / mensualiteOverview.totalDu) * 100).toFixed(1)
    : 0;

  // Wrapper qui passe l'état React à la fonction pure salary-actions.
  // La logique métier (dédup, génération, resync) vit dans le helper ;
  // ici on injecte juste les datasets + mutators Firestore.
  const genererPourMois = (mois, {resync=false}={}) => genererSalairesPourMois(mois, {
    salaires,
    ensCollege, ensLycee, ensPrimaire, personnel,
    emploisCollege, emploisLycee, engCollege, engLycee,
    primeDefaut,
    annee: annee || anneeConsultee,
    modS, ajS, supS,
    resync,
  });

  // Délègue à autoGenererSalairesAction (UI-coupled mais découplé du
  // parent : il reçoit toast/confirm/logAction par injection).
  const autoGenererSalaires = (opts={}) => {
    if(readOnly) return;
    return autoGenererSalairesAction({
      ...opts,
      moisSel, moisSalaire, genererPourMois,
      ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut,
      toast, confirm, logAction,
    });
  };

  // Wrapper qui rassemble l'état React et délègue le rendu HTML au helper
  // src/reports/etats-salaires.js. La fonction d'impression elle-même
  // (~170 LOC de template) vit avec les autres documents imprimables.
  const imprimerSalaires = () => {
    if(moisSel==="__TOUS__"){toast("Sélectionnez un mois précis pour imprimer.","warning");return;}
    imprimerEtatsSalaires({
      moisSel, anneeConsultee, schoolInfo,
      salairesSec, salairesPrim, salairesPers,
      totals: {
        totMontantGlobal, totBonGlobal, totNetGlobal,
        totMontantSec, totBonSec, totNetSec,
        totMontantPrim, totBonPrim, totNetPrim,
        totMontantPers, totBonPers, totNetPers,
      },
      calcExecute, calcMontant, calcNet,
    });
  };

  const tabs=[{id:"bilan",label:t("accounting.tabs.bilan")},{id:"recettes",label:`${t("accounting.tabs.revenues")} (${recettes.length})`},
    {id:"depenses",label:`${t("accounting.tabs.expenses")} (${depenses.length})`},
    {id:"salaires",label:t("accounting.tabs.salaries")},
    {id:"enseignants",label:`${t("accounting.tabs.teachers")} (${ensPrimaire.length+ensCollege.length+ensLycee.length})`},
    {id:"personnel",label:`${t("accounting.tabs.staff")} (${personnel.length})`},
    {id:"fondation",label:`${t("accounting.tabs.donations")} (${versements.length})`},
    {id:"enrolment",label:`${t("accounting.tabs.students")} (${elevesC.length+elevesL.length+elevesP.length})`},
    {id:"mens",label:t("accounting.tabs.monthlyFees")},
    {id:"transferts",label:`🔄 ${t("accounting.tabs.transfers")}`}];

  const anneeBase = Number(String(anneeCourante).split("-")[0]) || new Date().getFullYear();
  const anneesDispo = Array.from({length:7},(_,i)=>`${anneeBase-i}-${anneeBase-i+1}`);

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div style={{flex:1,minWidth:200}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>{t("accounting.title")}</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>{t("accounting.subtitle")}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:12,color:"#64748b",fontWeight:600}}>{t("common.yearViewed")} :</label>
          <select value={anneeConsultee} onChange={e=>setAnneeConsultee(e.target.value)}
            style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${enModeArchive?"#f59e0b":"#cbd5e1"}`,fontSize:13,fontWeight:700,
              background:enModeArchive?"#fef3c7":"#fff",color:enModeArchive?"#92400e":C.blueDark,cursor:"pointer"}}>
            {anneesDispo.map(a=><option key={a} value={a}>{a}{a===anneeCourante?` (${t("common.current")})`:""}</option>)}
          </select>
          {enModeArchive&&<Badge color="orange">📚 {t("common.archive")} — {t("common.readOnly")}</Badge>}
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <Tabs items={tabs} actif={tab} onChange={setTab}/>

      {tab==="bilan"&&<BilanTab
        schoolInfo={schoolInfo}
        periodes={periodes}
        canCreate={canCreate}
        toggleBlocage={async()=>{
          const blocage=!!schoolInfo.blocageParentImpaye;
          if(!canCreate){toast("Action réservée au comptable ou à l'administrateur.","warning");return;}
          await updateDoc(doc(db,"ecoles",schoolId),{blocageParentImpaye:!blocage});
          toast(blocage?"🔓 Accès parents rétabli":"🔒 Accès parents bloqué pour les impayés","success");
        }}
        recettes={recettes}
        depenses={depenses}
        cR={cR}
        cD={cD}
        totR={totR}
        totD={totD}
        totVers={totVers}
        totNetSec={totNetSec}
        totNetPrim={totNetPrim}
        totNetPers={totNetPers}
        impaye={impaye}
        pctImpaye={pctImpaye}
        salairesMois={salairesMois}
        moisLabel={moisLabel}
        mensualiteOverview={mensualiteOverview}
      />}

      {tab==="recettes"&&<RecettesTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        recettes={recettes}
        cR={cR}
        ajR={ajR}
        modR={modR}
        supR={supR}
        enreg={enreg}
        periodes={periodes}
        defaultPeriode={defaultPeriode}
      />}

      {tab==="depenses"&&<DepensesTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        depenses={depenses}
        cD={cD}
        ajD={ajD}
        modD={modD}
        supD={supD}
        enreg={enreg}
        periodes={periodes}
        defaultPeriode={defaultPeriode}
      />}

      {/* ── ÉTATS DE SALAIRES MODÈLE EXCEL ── */}
      {tab==="salaires"&&<SalairesTab
        sousTabSal={sousTabSal}
        setSousTabSal={setSousTabSal}
        moisSel={moisSel}
        setMoisSel={setMoisSel}
        moisSalaire={moisSalaire}
        moisLabel={moisLabel}
        moisModale={moisModale}
        annee={annee}
        primeDefaut={primeDefaut}
        setPrimeDefaut={setPrimeDefaut}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        readOnly={readOnly}
        salaires={salaires}
        cS={cS}
        ajS={ajS}
        modS={modS}
        supS={supS}
        salairesMois={salairesMois}
        salairesSec={salairesSec}
        salairesPrim={salairesPrim}
        salairesPers={salairesPers}
        totNetSec={totNetSec}
        totNetPrim={totNetPrim}
        totNetPers={totNetPers}
        bonsMois={bonsMois}
        ajBon={ajBon}
        modBon={modBon}
        supBon={supBon}
        ensPrimaire={ensPrimaire}
        ensCollege={ensCollege}
        ensLycee={ensLycee}
        personnel={personnel}
        filtrePrimNom={filtrePrimNom}
        setFiltrePrimNom={setFiltrePrimNom}
        filtrePrimClasse={filtrePrimClasse}
        setFiltrePrimClasse={setFiltrePrimClasse}
        calcExecute={calcExecute}
        calcMontant={calcMontant}
        calcNet={calcNet}
        calcNetF={calcNetF}
        autoGenererSalaires={autoGenererSalaires}
        appliquerBons={appliquerBons}
        imprimerSalaires={imprimerSalaires}
        enreg={enreg}
        saveSalaire={saveSalaire}
      />}

      {/* ══ ONGLET PERSONNEL ENSEIGNANT (vue hybride) ══ */}
      {tab==="enseignants"&&<EnseignantsTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        toast={toast}
        logAction={logAction}
        ensPrimaire={ensPrimaire}
        ensCollege={ensCollege}
        ensLycee={ensLycee}
        ajEnsPrim={ajEnsPrim}
        ajEnsCol={ajEnsCol}
        ajEnsLyc={ajEnsLyc}
        modEnsPrim={modEnsPrim}
        modEnsCol={modEnsCol}
        modEnsLyc={modEnsLyc}
        supEnsPrim={supEnsPrim}
        supEnsCol={supEnsCol}
        supEnsLyc={supEnsLyc}
      />}

      {/* ══ ONGLET PERSONNEL ══ */}
      {tab==="personnel"&&<PersonnelTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        personnel={personnel}
        cPers={cPers}
        supPers={supPers}
        savePersonnel={savePersonnel}
      />}

      {tab==="fondation"&&<FondationTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        versements={versements}
        cV={cV}
        ajV={ajV}
        modV={modV}
        supV={supV}
        enreg={enreg}
      />}

      {tab==="enrolment"&&<EnrolmentTab
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        readOnly={readOnly}
        elevesC={elevesC}
        elevesL={elevesL}
        elevesP={elevesP}
        cEC={cEC}
        cEL={cEL}
        cEP={cEP}
        tousElevesScolarite={tousElevesScolarite}
        ajoutParNiveau={ajoutParNiveau}
        suppressionParNiveau={suppressionParNiveau}
        modifParNiveau={modifParNiveau}
        ensureClasse={ensureClasse}
        sortAlpha={sortAlpha}
      />}

      {tab==="mens"&&<MensualitesTab
        tarifsClasses={tarifsClasses}
        saveTarif={saveTarif}
        getTarifBase={getTarifBase}
        getTarifRevision={getTarifRevision}
        getTarifAutre={getTarifAutre}
        getTarifIns={getTarifIns}
        getTarifReinsc={getTarifReinsc}
        canEditEleves={canEditEleves}
        eleves={eleves}
        elevesFiltres={elevesFiltres}
        classesU={classesU}
        niveau={niveau}
        setNiveau={setNiveau}
        filtClasse={filtClasse}
        setFiltClasse={setFiltClasse}
        moisAnnee={moisAnnee}
        annee={annee}
        readOnly={readOnly}
        canCreate={canCreate}
        canEdit={canEdit}
        schoolInfo={schoolInfo}
        toggleMens={toggleMens}
        toggleFraisAnnexe={toggleFraisAnnexe}
        getTarifInscriptionEleve={getTarifInscriptionEleve}
        getTarif={getTarif}
      />}


      {tab==="transferts"&&<TransfertsPanel userRole={userRole} annee={annee} setTab={setTab}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODULE ÉCOLE — avec Discipline + Bulletins
// ══════════════════════════════════════════════════════════════

export { Comptabilite };
