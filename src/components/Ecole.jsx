import React, { useContext, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C, getAnnee, peutModifier } from "../constants";
import { getDefaultPeriode, getPeriodesForSchool } from "../period-utils";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { getActiveNoteForms } from "../evaluation-forms";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../staff-utils";
import { Badge, Card, Modale, Champ, Input, Selec, Textarea, Btn, THead, TR, TD, Stat, Tabs, Vide, Chargement, LectureSeule, UploadFichiers } from "./ui";
import { LivretsTab } from "./LivretsTab";
import { EmploiDuTempsTab } from "./ecole/EmploiDuTempsTab";
import { AttestationsTab } from "./ecole/AttestationsTab";
import { ClassesTab } from "./ecole/ClassesTab";
import { EnseignementsTab } from "./ecole/EnseignementsTab";
import { DisciplineTab } from "./ecole/DisciplineTab";
import { BulletinsTab } from "./ecole/BulletinsTab";
import { MatieresTab } from "./ecole/MatieresTab";
import { ApercuTab } from "./ecole/ApercuTab";
import { EnsTab } from "./ecole/EnsTab";
import { ElevesTab } from "./ecole/ElevesTab";
import { NotesTab } from "./ecole/NotesTab";

function Ecole({titre, couleur, cleClasses, cleEns, cleNotes, cleEleves, avecEns, userRole, annee, classesPredefinies, maxNote=20, matieresPredefinies=[], readOnly=false, verrouOuvert=false}) {
  const isPrimarySection = cleEns === "ensPrimaire";
  const anneeCourante = annee || getAnnee();
  const [anneeConsultee, setAnneeConsultee] = useState(anneeCourante);
  // Vue archive : filtre les notes (les autres collections restent persistantes).
  const enModeArchive = anneeConsultee !== anneeCourante;
  const anneeFiltre = enModeArchive ? anneeConsultee : null;
  const {items:classes,chargement:cC,ajouter:ajC,modifier:modC,supprimer:supC}=useFirestore(cleClasses);
  const {items:ens,chargement:cEns,ajouter:ajEns,modifier:modEns,supprimer:supEns}=useFirestore(cleEns);
  const {items:notes,chargement:cN,ajouter:ajN,supprimer:supN}=useFirestore(cleNotes,{annee:anneeFiltre});
  const {items:eleves,chargement:cE,modifier:modE}=useFirestore(cleEleves);
  const {items:absences,chargement:cAbs,ajouter:ajAbs,supprimer:supAbs}=useFirestore(cleEleves+"_absences");
  const {items:enseignements,chargement:cEng,ajouter:ajEng,modifier:modEng,supprimer:supEng}=useFirestore(cleEns+"_enseignements");
  const {items:matieres,chargement:cMat,ajouter:ajMat,modifier:modMat,supprimer:supMat}=useFirestore(cleClasses+"_matieres");
  const {items:emplois,chargement:cEmp,ajouter:ajEmp,modifier:modEmp,supprimer:supEmp}=useFirestore(cleClasses+"_emplois");
  const cleAppreciations=cleNotes.replace("notes","appreciations");
  const {items:appreciations,ajouter:ajApp,modifier:modApp}=useFirestore(cleAppreciations);
  const getAppreciation=(eleveId,periode)=>appreciations.find(a=>a.eleveId===eleveId&&a.periode===periode);
  const saveAppreciation=async(eleveId,periode,texte)=>{
    const existant=getAppreciation(eleveId,periode);
    const data={eleveId,periode,texte:String(texte||"").trim(),updatedAt:Date.now()};
    if(existant)await modApp({...existant,...data});
    else await ajApp(data);
  };
  const appreciationsParEleveB=(periode)=>Object.fromEntries(
    appreciations.filter(a=>a.periode===periode&&a.texte).map(a=>[a.eleveId,a.texte])
  );

  const [tab,setTab]=useState("apercu");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [filtreClasse,setFiltreClasse]=useState("all");
  // Matières filtrées par classe : si la matière a des classes assignées, on filtre ; sinon elle s'applique à tout
  const matieresForClasse = (classe) => {
    if(!classe||classe==="all") return matieres;
    return matieres.filter(m=>!m.classes||!m.classes.length||m.classes.includes(classe));
  };
  // Périodes scolaires actives (T1/T2/T3 par défaut, ou S1/S2 ou mois selon schoolInfo.periodicite).
  // Calculées dans le composant pour pouvoir initialiser les states ci-dessous.
  const [rechercheMatricule,setRechercheMatricule]=useState("");
  const [ensCompte,setEnsCompte]=useState(null);
  const [formC,setFormC]=useState({});
  const [parentEleve,setParentEleve]=useState(null);
  const [formP,setFormP]=useState({});
  const [importPreview,setImportPreview]=useState(null);
  const [importEnCours,setImportEnCours]=useState(false);
  const [notesVue,setNotesVue]=useState("liste"); // "liste" | "grille"
  const [grilleClasse,setGrilleClasse]=useState("all");
  const [grilleChanges,setGrilleChanges]=useState({}); // {"eleveId|matiere": note}
  const [grilleSaving,setGrilleSaving]=useState(false);
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const {schoolId, schoolInfo, moisAnnee, toast, logAction, envoyerPush} = useContext(SchoolContext);
  const periodes = getPeriodesForSchool(schoolInfo, moisAnnee);
  const defaultPeriode = periodes[0] || getDefaultPeriode(schoolInfo);
  const [periodeB,setPeriodeB]=useState(defaultPeriode);
  const [grillePeriode,setGrillePeriode]=useState(defaultPeriode);
  const noteForms = getActiveNoteForms(schoolInfo, isPrimarySection ? "primaire" : "secondaire");
  const defaultNoteType = noteForms[0]?.value || "Devoir";
  const [grilleType,setGrilleType]=useState(defaultNoteType);
  const canCreate = !readOnly && !enModeArchive;
  const canEdit = !readOnly && !enModeArchive && (peutModifier(userRole) || verrouOuvert);
  const moy=notes.length?(notes.reduce((s,n)=>s+Number(n.note),0)/notes.length).toFixed(1):"—";
  const classesUniq=[...new Set(eleves.map(e=>e.classe))].filter(Boolean);
  const sortAlphaEcole = arr => {
    const tri = schoolInfo.triEleves || "prenom_nom";
    return [...arr].sort((a,b)=>{
      const withClasse = tri==="classe_prenom"||tri==="classe_nom";
      const sa = withClasse
        ? (tri==="classe_nom" ? `${a.classe||""} ${a.nom} ${a.prenom}` : `${a.classe||""} ${a.prenom} ${a.nom}`)
        : (tri==="nom_prenom" ? `${a.nom} ${a.prenom}` : `${a.prenom} ${a.nom}`);
      const sb = withClasse
        ? (tri==="classe_nom" ? `${b.classe||""} ${b.nom} ${b.prenom}` : `${b.classe||""} ${b.prenom} ${b.nom}`)
        : (tri==="nom_prenom" ? `${b.nom} ${b.prenom}` : `${b.prenom} ${b.nom}`);
      return sa.localeCompare(sb,"fr",{sensitivity:"base"});
    });
  };
  const elevesFiltres=sortAlphaEcole(filtreClasse==="all"?eleves:eleves.filter(e=>e.classe===filtreClasse));
  // Effectif réel = nombre d'élèves dont le champ classe correspond
  const effectifReel = (nomClasse) => eleves.filter(e=>e.classe===nomClasse && e.statut!=="Départ").length;

  const tabItems=[
    {id:"apercu",label:"Aperçu"},
    {id:"classes",label:`Classes (${classes.length})`},
    {id:"eleves",label:`Élèves (${eleves.length})`},
    ...(avecEns?[{id:"ens",label:`Enseignants (${ens.length})`}]:[]),
    {id:"notes",label:`Notes (${notes.length})`},
    {id:"enseignements",label:"Enseignements"},
    {id:"discipline",label:"Discipline"},
    {id:"bulletins",label:"Bulletins"},
    {id:"livrets",label:"📋 Livrets"},
    {id:"matieres",label:"Matières"},
    ...(avecEns?[{id:"emploidutemps",label:"Emplois du temps"}]:[]),
    {id:"attestations",label:"Attestations de niveau"},
  ];

  const saveClasse=()=>{
    const row={...form,effectif:Number(form.effectif||0)};
    if(modal==="add_c"){ajC(row);}
    else {
      const ancienNom=classes.find(c=>c._id===form._id)?.nom;
      modC(row);
      if(ancienNom&&ancienNom!==form.nom)
        eleves.filter(e=>e.classe===ancienNom).forEach(e=>modE({...e,classe:form.nom}));
    }
    setModal(null);
  };

  const saveEnseignant = async () => {
    const row = { ...form };
    const doublon = findStaffDuplicate(row, ens, {
      excludeId: modal === "edit_ens" ? row._id : null,
    });
    if (doublon) {
      toast(getStaffDuplicateMessage(doublon, { label: "cet enseignant" }), "warning");
      return;
    }

    if (modal === "add_ens") {
      await ajEns(row);
    } else {
      await modEns(row);
    }

    if (row.classeTitle) {
      const nomEns = `${row.prenom || ""} ${row.nom || ""}`.trim();
      const existante = classes.find((c) => c.nom === row.classeTitle);
      if (!existante) {
        await ajC({ nom: row.classeTitle, effectif: 0, enseignant: nomEns });
      } else if (nomEns && existante.enseignant !== nomEns) {
        await modC({ ...existante, enseignant: nomEns });
      }
    }

    setModal(null);
  };

  const anneeBase = Number(String(anneeCourante).split("-")[0]) || new Date().getFullYear();
  const anneesDispo = Array.from({length:7},(_,i)=>`${anneeBase-i}-${anneeBase-i+1}`);

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div style={{flex:1,minWidth:200}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>{titre}</h2>
          <p style={{margin:0,fontSize:12,color:couleur,fontWeight:700}}>Gestion des classes, élèves, notes et discipline</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:12,color:"#64748b",fontWeight:600}}>Année consultée :</label>
          <select value={anneeConsultee} onChange={e=>setAnneeConsultee(e.target.value)}
            style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${enModeArchive?"#f59e0b":"#cbd5e1"}`,fontSize:13,fontWeight:700,
              background:enModeArchive?"#fef3c7":"#fff",color:enModeArchive?"#92400e":C.blueDark,cursor:"pointer"}}>
            {anneesDispo.map(a=><option key={a} value={a}>{a}{a===anneeCourante?" (courante)":""}</option>)}
          </select>
          {enModeArchive&&<Badge color="orange">📚 Archive — lecture seule</Badge>}
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#92400e",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>🔒</span>
        <span>L'enrôlement et la suppression des élèves se font uniquement dans le module <strong>Comptabilité → Élèves</strong>.</span>
      </div>
      <Tabs items={tabItems} actif={tab} onChange={setTab}/>

      {/* ── APERÇU ── */}
      {tab==="apercu"&&<ApercuTab
        classes={classes}
        eleves={eleves}
        ens={ens}
        notes={notes}
        absences={absences}
        avecEns={avecEns}
        moy={moy}
        maxNote={maxNote}
        cC={cC}
        cE={cE}
        classesUniq={classesUniq}
        effectifReel={effectifReel}
        matieresForClasse={matieresForClasse}
        couleur={couleur}
        schoolInfo={schoolInfo}
      />}


      {/* ── CLASSES ── */}
      {tab==="classes"&&<ClassesTab
        classes={classes}
        eleves={eleves}
        ens={ens}
        cC={cC}
        ajC={ajC}
        modC={modC}
        supC={supC}
        schoolInfo={schoolInfo}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        classesPredefinies={classesPredefinies}
        effectifReel={effectifReel}
        saveClasse={saveClasse}
        toast={toast}
      />}


      {/* ── ÉLÈVES (lecture seule — enrôlement dans Comptabilité) ── */}
      {tab==="eleves"&&<ElevesTab
        eleves={eleves}
        elevesFiltres={elevesFiltres}
        cE={cE}
        cleEleves={cleEleves}
        filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse}
        classesUniq={classesUniq}
        avecEns={avecEns}
        annee={annee}
        schoolInfo={schoolInfo}
        schoolId={schoolId}
        toast={toast}
        logAction={logAction}
        canEdit={canEdit}
        parentEleve={parentEleve}
        setParentEleve={setParentEleve}
        formP={formP}
        setFormP={setFormP}
      />}


      {/* ── ENSEIGNANTS ── */}
      {tab==="ens"&&avecEns&&<EnsTab
        ens={ens}
        cEns={cEns}
        supEns={supEns}
        cleEns={cleEns}
        isPrimarySection={isPrimarySection}
        couleur={couleur}
        schoolId={schoolId}
        toast={toast}
        logAction={logAction}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        ensCompte={ensCompte}
        setEnsCompte={setEnsCompte}
        formC={formC}
        setFormC={setFormC}
        saveEnseignant={saveEnseignant}
      />}


      {/* ── NOTES ── */}
      {tab==="notes"&&<NotesTab
        annee={annee}
        periodes={periodes}
        notes={notes}
        cN={cN}
        ajN={ajN}
        supN={supN}
        eleves={eleves}
        matieres={matieres}
        matieresForClasse={matieresForClasse}
        noteForms={noteForms}
        defaultNoteType={defaultNoteType}
        schoolInfo={schoolInfo}
        isPrimarySection={isPrimarySection}
        avecEns={avecEns}
        maxNote={maxNote}
        readOnly={readOnly}
        canCreate={canCreate}
        canEdit={canEdit}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        notesVue={notesVue}
        setNotesVue={setNotesVue}
        grilleClasse={grilleClasse}
        setGrilleClasse={setGrilleClasse}
        grillePeriode={grillePeriode}
        setGrillePeriode={setGrillePeriode}
        grilleType={grilleType}
        setGrilleType={setGrilleType}
        grilleChanges={grilleChanges}
        setGrilleChanges={setGrilleChanges}
        grilleSaving={grilleSaving}
        setGrilleSaving={setGrilleSaving}
        importPreview={importPreview}
        setImportPreview={setImportPreview}
        importEnCours={importEnCours}
        setImportEnCours={setImportEnCours}
        toast={toast}
      />}


      {/* ── ENSEIGNEMENTS ── */}
      {tab==="enseignements"&&<EnseignementsTab
        enseignements={enseignements}
        cEng={cEng}
        ajEng={ajEng}
        modEng={modEng}
        supEng={supEng}
        classes={classes}
        ens={ens}
        matieres={matieres}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
      />}


      {/* ── DISCIPLINE ── */}
      {tab==="discipline"&&<DisciplineTab
        absences={absences}
        cAbs={cAbs}
        ajAbs={ajAbs}
        supAbs={supAbs}
        eleves={eleves}
        avecEns={avecEns}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        envoyerPush={envoyerPush}
      />}


      {/* ── BULLETINS ── */}
      {tab==="bulletins"&&<BulletinsTab
        periodes={periodes}
        rechercheMatricule={rechercheMatricule}
        setRechercheMatricule={setRechercheMatricule}
        periodeB={periodeB}
        setPeriodeB={setPeriodeB}
        filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse}
        classesUniq={classesUniq}
        elevesFiltres={elevesFiltres}
        eleves={eleves}
        notes={notes}
        matieres={matieres}
        matieresForClasse={matieresForClasse}
        schoolInfo={schoolInfo}
        moisAnnee={moisAnnee}
        maxNote={maxNote}
        avecEns={avecEns}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
        getAppreciation={getAppreciation}
        saveAppreciation={saveAppreciation}
        appreciationsParEleveB={appreciationsParEleveB}
      />}


      {/* ── LIVRETS ── */}
      {tab==="livrets"&&<LivretsTab
        periodes={periodes}
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {tab==="matieres"&&<MatieresTab
        matieres={matieres}
        cMat={cMat}
        ajMat={ajMat}
        modMat={modMat}
        supMat={supMat}
        classes={classes}
        matieresPredefinies={matieresPredefinies}
        form={form}
        setForm={setForm}
        modal={modal}
        setModal={setModal}
        canCreate={canCreate}
        canEdit={canEdit}
      />}


      {tab==="emploidutemps"&&avecEns&&<EmploiDuTempsTab
        maxNote={maxNote}
        canCreate={canCreate}
        canEdit={canEdit}
        isPrimarySection={isPrimarySection}
        form={form}
        setForm={setForm}
        chg={chg}
        filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse}
        classes={classes}
        matieres={matieres}
        ens={ens}
        emplois={emplois}
        cEmp={cEmp}
        ajEmp={ajEmp}
        modEmp={modEmp}
        supEmp={supEmp}
      />}

      {/* ── ATTESTATIONS DE NIVEAU ── */}
      {tab==="attestations"&&<AttestationsTab
        rechercheMatricule={rechercheMatricule}
        setRechercheMatricule={setRechercheMatricule}
        filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse}
        classesUniq={classesUniq}
        elevesFiltres={elevesFiltres}
        schoolInfo={schoolInfo}
        annee={annee}
        avecEns={avecEns}
        cE={cE}
      />}
    </div>
  );
}


export { Ecole };


