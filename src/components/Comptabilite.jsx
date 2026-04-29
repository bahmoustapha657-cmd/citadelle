import React, { useContext, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { doc, updateDoc } from "firebase/firestore";
import {
  C,
  TOUS_MOIS_LONGS,
  getAnnee,
  CLASSES_PRIMAIRE,
  CLASSES_COLLEGE,
  CLASSES_LYCEE,
  initMens,
  genererMatricule,
  fmt,
  fmtN,
  peutModifierEleves,
  peutModifier,
  getClassesForSection,
  getDefaultMensualiteForClasse,
  getSectionLabelForClasse,
  getTarifAutreValue,
  getTarifMensuelTotal,
  getTarifRevisionValue,
} from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { db } from "../firebaseDb";
import { uploadPhotoEleve } from "../storageUtils";
import { Badge, Card, Modale, Champ, Input, Selec, Btn, THead, TR, TD, Stat, Tabs, Vide, Chargement, LectureSeule } from "./ui";
import { imprimerRecu, telechargerExcel, exportExcel } from "../reports";
import { Fondation } from "./Fondation";
import { TarifsClasses } from "./TarifsClasses";
import { CameraCapture } from "./CameraCapture";
import { TransfertsPanel } from "./TransfertsPanel";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../enrollment-utils";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../staff-utils";
import { getTeacherMonthlyForfait } from "../teacher-utils";
import {
  buildTeacherFullName,
  getTeacherAbsenceAmount,
  getTeacherAbsenceHours,
  getTeacherFifthWeekAmount,
  getTeacherFifthWeekHours,
  getTeacherScheduleSlots,
  getScheduleSlotHours,
  getSlotPrimeForTeacher,
  getTeacherWeeklyAmount,
  getWeightedPrimeHoraire,
} from "../salary-utils";

const loadXLSX = () => import("xlsx");

function Comptabilite({readOnly, annee, userRole, verrouOuvert=false}) {
  // readOnly=true → admin/direction : zéro action
  // canEdit → modifier/supprimer des enregistrements existants (verrou admin requis sauf admin lui-même — mais admin est readOnly)
  // canCreate → ajouter de nouveaux enregistrements (toujours permis si !readOnly)
  const canCreate = !readOnly;
  const canEdit = !readOnly && (peutModifier(userRole) || verrouOuvert);
  const canEditEleves = !readOnly && (peutModifierEleves(userRole) || verrouOuvert);
  const {schoolId, schoolInfo, moisAnnee, moisSalaire, toast, logAction, envoyerPush, planInfo} = useContext(SchoolContext);
  const {items:recettes,chargement:cR,ajouter:ajR,modifier:modR,supprimer:supR}=useFirestore("recettes");
  const {items:depenses,chargement:cD,ajouter:ajD,modifier:modD,supprimer:supD}=useFirestore("depenses");
  const {items:salaires,chargement:cS,ajouter:ajS,modifier:modS,supprimer:supS}=useFirestore("salaires");
  const {items:bons,ajouter:ajBon,modifier:modBon,supprimer:supBon}=useFirestore("bons");
  const {items:personnel,chargement:cPers,ajouter:ajPers,modifier:modPers,supprimer:supPers}=useFirestore("personnel");
  const {items:versements,chargement:cV,ajouter:ajV,modifier:modV,supprimer:supV}=useFirestore("versements");
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
  const [afficherDeparts,setAfficherDeparts]=useState(false);
  const [niveau,setNiveau]=useState("college");
  const [filtClasse,setFiltClasse]=useState("all");
  const [moisSel,setMoisSel]=useState(()=>moisSalaire[0]||"Octobre");
  const [primeDefaut,setPrimeDefaut]=useState(0);
  const [filtrePrimNom,setFiltrePrimNom]=useState("");
  const [filtrePrimClasse,setFiltrePrimClasse]=useState("all");
  const [niveauEnrol,setNiveauEnrol]=useState("college");
  const [cameraOuverte,setCameraOuverte]=useState(false);
  const [uploadEnCours,setUploadEnCours]=useState(false);
  const [importEnrolPreview,setImportEnrolPreview]=useState(null);
  const [importEnrolEnCours,setImportEnrolEnCours]=useState(false);
  const [classeDefautImport,setClasseDefautImport]=useState("");
  const [ordreNomImport,setOrdreNomImport]=useState("auto"); // "auto" | "nom_prenom" | "prenom_nom"
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const handlePhotoFichier=e=>{
    const file=e.target.files[0]; if(!file) return;
    if(file.size>2*1024*1024){toast("Image trop grande (max 2 Mo).","warning");return;}
    const reader=new FileReader();
    reader.onload=ev=>setForm(p=>({...p,photo:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  const modChampParNiveau = { college: modEC, lycee: modEL, primaire: modEP };
  const ajoutParNiveau = { college: ajEC, lycee: ajEL, primaire: ajEP };
  const suppressionParNiveau = { college: supEC, lycee: supEL, primaire: supEP };
  const modifParNiveau = { college: modEC_full, lycee: modEL_full, primaire: modEP_full };
  const sortAlpha = arr => {
    const tri = schoolInfo.triEleves || "prenom_nom";
    return [...arr].sort((a,b)=>{
      const ka = tri==="nom_prenom"||tri==="classe_nom" ? `${a.classe||""} ${a.nom} ${a.prenom}` : `${a.classe||""} ${a.prenom} ${a.nom}`;
      const kb = tri==="nom_prenom"||tri==="classe_nom" ? `${b.classe||""} ${b.nom} ${b.prenom}` : `${b.classe||""} ${b.prenom} ${b.nom}`;
      const withClasse = tri==="classe_prenom"||tri==="classe_nom";
      if(withClasse) return ka.localeCompare(kb,"fr",{sensitivity:"base"});
      // sans classe : comparer sans le préfixe classe
      const sa = tri==="nom_prenom" ? `${a.nom} ${a.prenom}` : `${a.prenom} ${a.nom}`;
      const sb = tri==="nom_prenom" ? `${b.nom} ${b.prenom}` : `${b.prenom} ${b.nom}`;
      return sa.localeCompare(sb,"fr",{sensitivity:"base"});
    });
  };
  const elevesEnrol=sortAlpha(elevesParNiveau[niveauEnrol] || []);
  const ajEnrol=ajoutParNiveau[niveauEnrol] || ajEC;

  // Crée la classe dans Firestore si elle n'existe pas encore
  const ensureClasse = async (nom, niveau, dejaCreees) => {
    if(!nom) return;
    const classesConfig = niveau==="primaire"
      ? { list: classesPrimaireList, aj: ajClassePrimaire }
      : niveau==="lycee"
        ? { list: classesLyceeList, aj: ajClasseLycee }
        : { list: classesCollegeList, aj: ajClasseCollege };
    const list = classesConfig.list;
    const aj = classesConfig.aj;
    if(!list.find(c=>c.nom===nom) && !(dejaCreees&&dejaCreees.has(nom))) {
      await aj({nom, effectif:0});
      if(dejaCreees) dejaCreees.add(nom);
    }
  };
  const supEnrol=suppressionParNiveau[niveauEnrol] || supEC;
  const modEnrol=modifParNiveau[niveauEnrol] || modEC_full;

  const totR=recettes.reduce((s,x)=>s+Number(x.montant),0);
  const totD=depenses.reduce((s,x)=>s+Number(x.montant),0);
  const totVers=versements.reduce((s,x)=>s+Number(x.montant),0);

  const eleves=elevesParNiveau[niveau] || elevesC;
  const modEleves=modChampParNiveau[niveau] || modEC;
  const classesU=[...new Set(eleves.map(e=>e.classe))].filter(Boolean);
  const tousElevesScolarite=[...elevesC,...elevesL,...elevesP];

  const getTarifConfig = (classe) => tarifsClasses.find((tarif) => tarif.classe === classe) || null;
  // Tarif mensuel total = mensualite de base + frais de revision
  const getTarif = (classe) => getTarifMensuelTotal(getTarifConfig(classe), classe);
  const getTarifBase = (classe) => {
    const tarif = getTarifConfig(classe);
    if (tarif) return Number(tarif.montant || 0);
    return getDefaultMensualiteForClasse(classe);
  };
  const getTarifRevision = (classe) => getTarifRevisionValue(getTarifConfig(classe));
  const getTarifAutre = (classe) => getTarifAutreValue(getTarifConfig(classe));
  const getTarifIns = (classe) => {
    const t = getTarifConfig(classe);
    return Number(t?.inscription||0);
  };
  const getTarifReinsc = (classe) => {
    const t = getTarifConfig(classe);
    return Number(t?.reinscription||0);
  };
  const getTarifInscriptionForEleve = (eleve = {}) => (
    eleve.typeInscription==="Réinscription" ? getTarifReinsc(eleve.classe) : getTarifIns(eleve.classe)
  );
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
  const nbPayes=e=>moisAnnee.filter(m=>(e.mens||{})[m]==="Payé").length;

  const toggleFraisAnnexe = async (_id, {
    payKey,
    dateKey,
    valeurActuelle=false,
    label,
    montant=0,
    nomEleve="",
  }) => {
    if(readOnly) return;
    if(valeurActuelle && !canEdit){
      toast(`Le retrait de ${label.toLowerCase()} nécessite l'autorisation de l'administrateur (verrou activé).`,"warning");
      return;
    }
    const montantLabel = montant>0 ? ` (${fmt(montant)})` : "";
    const message = valeurActuelle
      ? `Retirer ${label.toLowerCase()}${montantLabel} pour ${nomEleve} ?`
      : `Marquer ${label.toLowerCase()}${montantLabel} comme payé pour ${nomEleve} ?`;
    if(!confirm(message)) return;
    await modEleves(_id,{
      [payKey]:!valeurActuelle,
      [dateKey]:!valeurActuelle ? new Date().toLocaleDateString("fr-FR") : null,
    });
  };

  const toggleMens=async(_id,mois,mensActuels,mensDatesActuels,nomEleve)=>{
    if(readOnly) return;
    const mens={...(mensActuels||initMens())};
    const estPaye=mens[mois]==="Payé";
    // Décocher nécessite le verrou admin (canEdit)
    if(estPaye && !canEdit){
      toast("Le décochage nécessite l'autorisation de l'administrateur (verrou activé).","warning");
      return;
    }
    const msg = estPaye
      ? `Décocher ${mois} et marquer comme impayé pour ${nomEleve||""} ?`
      : `Marquer ${mois} comme payé pour ${nomEleve||""} ?`;
    if(!confirm(msg)) return;
    mens[mois]=estPaye?"Impayé":"Payé";
    const mensDates={...(mensDatesActuels||{})};
    if(!estPaye) mensDates[mois]=new Date().toLocaleDateString("fr-FR");
    else delete mensDates[mois];
    await modEleves(_id,{mens,mensDates});
    // Notifier le parent : rappel si impayé, confirmation si payé
    if(!estPaye){
      envoyerPush(["parent"],"✅ Paiement enregistré",`Mensualité ${mois} de ${nomEleve||"votre enfant"} confirmée.`,"/paiements");
    } else {
      envoyerPush(["parent"],"⚠️ Rappel de paiement",`La mensualité ${mois} de ${nomEleve||"votre enfant"} est marquée impayée.`,"/paiements");
    }
  };

  const enreg=(aj,mod,extra={})=>{
    if(readOnly) return;
    const r={...form,...extra};
    if(modal.startsWith("add"))aj(r);else mod(r);
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
  const getBonTotal = (nomSalaire) => bonsMois
    .filter(b=>(b.nom||"").toLowerCase().trim()===(nomSalaire||"").toLowerCase().trim())
    .reduce((sum,b)=>sum+Number(b.montant||0),0);

  const appliquerBons = async () => {
    if(readOnly) return;
    if(moisSel==="__TOUS__"){toast("Sélectionnez un mois précis pour appliquer les bons.","warning");return;}
    if(!bonsMois.length){toast("Aucun bon enregistré pour ce mois.","warning");return;}
    if(!confirm(`Appliquer les bons du mois de ${moisSel} aux salaires ?\n\nLe champ "Bon" de chaque enseignant sera mis à jour.`)) return;
    let nb=0;
    for(const sal of salairesMois){
      const total=getBonTotal(sal.nom);
      if(total!==Number(sal.bon||0)){await modS({...sal,bon:total});nb++;}
    }
    toast(`${nb} salaire(s) mis à jour.`,"success");
  };

  // ── 5ÈME SEMAINE : détecte les jours qui ont 5 occurrences dans le mois sélectionné ──
  const getJours5emeSemaine = (moisNom) => {
    const idxMois = TOUS_MOIS_LONGS.indexOf(moisNom);
    if(idxMois < 0) return [];
    // Détermination de l'année réelle
    const now = new Date();
    const jsM = now.getMonth(); // 0-11
    const idxActuel = jsM >= 8 ? jsM - 8 : jsM + 4; // index dans TOUS_MOIS_LONGS
    const anneeDebutScolaire = idxActuel < 4 ? now.getFullYear() : now.getFullYear() - 1;
    const anneeReel = idxMois < 4 ? anneeDebutScolaire : anneeDebutScolaire + 1;
    // JS month number (Sep=8,Oct=9,...,Dec=11 → Jan=0,...,Aug=7)
    const jsMoisCible = idxMois < 4 ? idxMois + 8 : idxMois - 4;
    const JOURS_FR = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    const nbJours = new Date(anneeReel, jsMoisCible + 1, 0).getDate();
    const compteur = {};
    for(let j=1;j<=nbJours;j++){
      const nom = JOURS_FR[new Date(anneeReel, jsMoisCible, j).getDay()];
      compteur[nom] = (compteur[nom]||0) + 1;
    }
    return Object.entries(compteur).filter(([n,c])=>c===5&&n!=="Dimanche").map(([n])=>n);
  };
  const calcExecute = (s) => (Number(s.vhPrevu)||0) + (Number(s.cinqSem)||0) - (Number(s.nonExecute)||0);
  const calcMontant = (s) => calcExecute(s) * (Number(s.primeHoraire)||0);
  const calcNet = (s) => calcMontant(s) - (Number(s.bon)||0) + (Number(s.revision)||0);
  const totNetSec = salairesSec.reduce((sum,s)=>sum+calcNet(s),0);
  const totNetPrim = salairesPrim.reduce((sum,s)=>sum+Number(s.montantForfait||0)-(Number(s.bon||0))+(Number(s.revision||0)),0);
  const calcNetF = (s) => Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0);
  const totNetPers = salairesPers.reduce((sum,s)=>sum+calcNetF(s),0);

  const buildSecondaireSalaryObservation = (teacher, slots) => {
    const aRevision = slots.some(s => s.type === "revision");
    const parts = [`Statut: ${teacher.statut || "—"}`];
    if(aRevision) parts.push("Révisions incluses");
    return parts.join(" • ");
  };

  const genererPourMois = async (mois, {resync=false}={}) => {
    const jours5eme = getJours5emeSemaine(mois);
    const dejaCeMois = salaires.filter(s=>s.mois===mois);
    const trouverExistant = (nom) => dejaCeMois.find(s=>(s.nom||"").toLowerCase().trim()===nom.toLowerCase().trim());
    let nbCree = 0, nbResync = 0;

    const tousEns=[
      ...ensCollege.map(e=>({...e,_emplois:emploisCollege,_eng:engCollege})),
      ...ensLycee.map(e=>({...e,_emplois:emploisLycee,_eng:engLycee})),
    ];
    for(const ens of tousEns){
      const nomComplet=buildTeacherFullName(ens);
      if(!nomComplet) continue;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      const creneaux=getTeacherScheduleSlots(ens._emplois, ens);
      const vhHebdo=Math.round(creneaux.reduce((sum, slot)=>sum+getScheduleSlotHours(slot),0)*10)/10;
      const vhPrevu=Math.round(vhHebdo*4*10)/10;
      const hasPPC=(ens.primeParClasse||[]).some(p=>p.classe&&p.prime);
      const cinqSem=getTeacherFifthWeekHours(creneaux, jours5eme);
      const absences=getTeacherAbsenceHours(ens._eng, ens, creneaux);
      const montantHebdo=getTeacherWeeklyAmount(ens, creneaux, primeDefaut);
      const montant5eme=getTeacherFifthWeekAmount(ens, creneaux, jours5eme, primeDefaut);
      const montantAbsences=getTeacherAbsenceAmount(ens._eng, ens, creneaux, primeDefaut);
      const heuresExecutees=Math.max(0, Math.round(((vhPrevu + cinqSem - absences) || 0) * 10) / 10);
      const primeHoraire=heuresExecutees>0
        ? Math.round((((montantHebdo * 4) + montant5eme - montantAbsences) / heuresExecutees))
        : getWeightedPrimeHoraire(ens, creneaux, primeDefaut);
      const obs=buildSecondaireSalaryObservation(ens, creneaux) + (hasPPC ? " • Prime pondérée par classe" : "");
      const champsCalcules = {section:"Secondaire",mois,nom:nomComplet,matiere:ens.matiere||"",niveau:ens.grade||"",vhHebdo,vhPrevu,cinqSem,nonExecute:absences,primeHoraire,observation:obs};
      if(existant){
        // Resync : on garde bon et revision saisis manuellement
        await modS({...existant,...champsCalcules,bon:Number(existant.bon||0),revision:Number(existant.revision||0)});
        nbResync++;
      } else {
        await ajS({...champsCalcules,bon:0,revision:0});
        nbCree++;
      }
    }

    for(const ens of ensPrimaire){
      const nomComplet=`${ens.prenom||""} ${ens.nom||""}`.trim();
      if(!nomComplet) continue;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      const champsCalcules={
        section:"Primaire",mois,nom:nomComplet,
        niveau:ens.grade||ens.classeTitle||ens.classe||"",
        matiere:ens.matiere||"",
        montantForfait:getTeacherMonthlyForfait(ens),
        observation:`Statut: ${ens.statut||"—"}${ens.classeTitle?` · Titulaire ${ens.classeTitle}`:""}`,
      };
      if(existant){
        await modS({...existant,...champsCalcules,bon:Number(existant.bon||0),revision:Number(existant.revision||0)});
        nbResync++;
      } else {
        await ajS({...champsCalcules,bon:0,revision:0});
        nbCree++;
      }
    }

    for(const emp of personnel.filter(e=>(e.statut||"Actif")==="Actif")){
      const nomComplet=`${emp.prenom||""} ${emp.nom||""}`.trim();
      if(!nomComplet) continue;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      const champsCalcules={section:"Personnel",mois,nom:nomComplet,poste:emp.poste||"",categorie:emp.categorie||"",montantForfait:Number(emp.salaireBase||0),observation:emp.observation||""};
      if(existant){
        await modS({...existant,...champsCalcules,bon:Number(existant.bon||0),revision:Number(existant.revision||0)});
        nbResync++;
      } else {
        await ajS({...champsCalcules,bon:0,revision:0});
        nbCree++;
      }
    }
    return {nbCree, nbResync};
  };

  const verifierFichesPaie = () => {
    // Secondaire : si une prime par défaut est saisie, elle s'applique en fallback → pas de manque.
    const defautOK = (Number(primeDefaut)||0) > 0;
    const secMissing = defautOK ? [] : [...ensCollege, ...ensLycee].filter(e => {
      const hasPrime = Number(e.primeHoraire||0) > 0;
      const hasPPC = (e.primeParClasse||[]).some(p=>p.classe&&Number(p.prime)>0);
      return !hasPrime && !hasPPC;
    });
    const primMissing = ensPrimaire.filter(e => Number(e.montantForfait||e.salaireBase||e.forfait||0) <= 0);
    const persMissing = personnel.filter(p => (p.statut||"Actif")==="Actif" && Number(p.salaireBase||0) <= 0);
    return {secMissing, primMissing, persMissing};
  };

  const formatNoms = (liste) => liste.slice(0,3).map(e=>`${e.prenom||""} ${e.nom||""}`.trim()).filter(Boolean).join(", ") + (liste.length>3?` +${liste.length-3}`:"");

  const autoGenererSalaires = async ({resync=false}={}) => {
    if(readOnly) return;
    const {secMissing, primMissing, persMissing} = verifierFichesPaie();
    const totalMissing = secMissing.length + primMissing.length + persMissing.length;
    let warningMissing = "";
    if(totalMissing > 0){
      const lignes = [];
      if(secMissing.length) lignes.push(`• Secondaire sans prime horaire ni prime/classe : ${formatNoms(secMissing)}`);
      if(primMissing.length) lignes.push(`• Primaire sans forfait mensuel : ${formatNoms(primMissing)}`);
      if(persMissing.length) lignes.push(`• Personnel sans salaire de base : ${formatNoms(persMissing)}`);
      warningMissing = `\n\n⚠️ Fiches incomplètes (à compléter dans l'onglet Enseignants / Personnel) :\n${lignes.join("\n")}\n\nLeur ligne sera générée à 0 GNF — vous pourrez la corriger après.`;
    }
    const verbeAction = resync ? "Rafraîchir" : "Générer";
    const detailMode = resync
      ? "Les lignes existantes seront RECALCULÉES depuis la fiche enseignant et l'EDT actuels (V/H, prime horaire, observation). Les bons et révisions saisis manuellement seront conservés."
      : "Seuls les nouveaux enseignants seront ajoutés.";
    if(moisSel==="__TOUS__"){
      if(!confirm(`${verbeAction} les salaires pour les ${moisSalaire.length} mois de l'année scolaire ?\n\n${detailMode}${warningMissing}`)) return;
      let totalCree=0, totalResync=0;
      for(const m of moisSalaire){
        const r = await genererPourMois(m,{resync});
        totalCree += r.nbCree; totalResync += r.nbResync;
      }
      toast(`Prévision annuelle : ${totalCree} créé(s), ${totalResync} rafraîchi(s) sur ${moisSalaire.length} mois.`,"success");
      logAction("Salaires auto-générés (annuel)",`${totalCree} créés · ${totalResync} rafraîchis · ${moisSalaire.join(", ")}`);
      return;
    }
    const jours5eme = getJours5emeSemaine(moisSel);
    const info5eme = jours5eme.length ? `\n📅 5ème semaine détectée : ${jours5eme.join(", ")} → heures supplémentaires calculées automatiquement.` : "";
    if(!confirm(`${verbeAction} automatiquement les salaires pour ${moisSel} ?${info5eme}\n\n${detailMode}${warningMissing}`)) return;
    const {nbCree, nbResync} = await genererPourMois(moisSel,{resync});
    const parts = [];
    if(nbCree) parts.push(`${nbCree} créé(s)`);
    if(nbResync) parts.push(`${nbResync} rafraîchi(s)`);
    if(!parts.length) parts.push("rien à faire");
    const baseMsg = `Salaires : ${parts.join(", ")}.`;
    const msg = totalMissing > 0
      ? `${baseMsg} ${totalMissing} fiche(s) sans paie — complétez-les dans l'onglet Enseignants/Personnel.`
      : baseMsg;
    toast(msg, totalMissing > 0 ? "warning" : "success");
    logAction(resync?"Salaires rafraîchis":"Salaires auto-générés",`Mois : ${moisSel} · ${nbCree} créés · ${nbResync} rafraîchis`);
  };

  const imprimerSalaires = () => {
    if(moisSel==="__TOUS__"){toast("Sélectionnez un mois précis pour imprimer.","warning");return;}
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>États Salaires ${moisSel}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
    .titre{text-align:center;font-size:13px;font-weight:bold;margin-bottom:4px;color:#0A1628}
    .sous-titre{text-align:center;font-size:11px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#0A1628;color:#fff;padding:5px 7px;font-size:10px;text-align:center;border:1px solid #0A1628}
    td{padding:5px 7px;border:1px solid #ccc;text-align:center}td:nth-child(2){text-align:left}
    .section{background:#e8f0e8;font-weight:bold;color:#0A1628;padding:5px;margin:10px 0 4px}
    .total-row{background:#e0ebf8;font-weight:bold}
    @media print{button{display:none}}</style></head><body>
    <div class="titre">ÉTATS DE SALAIRES — G.S. LA CITADELLE — ANNÉE SCOLAIRE ${getAnnee()}</div>
    <div class="sous-titre">MOIS DE ${moisSel.toUpperCase()}</div>
    <div class="section">SECTION SECONDAIRE</div>
    <table><thead><tr>
      <th>N°</th><th>Prénoms et Nom</th><th>Matière</th><th>Niveau</th>
      <th>V.H. Hebdo</th><th>V.H. Mensuel Prévu</th><th>5è Sem</th><th>Non Exécuté</th><th>Exécuté</th>
      <th>Prime Horaire</th><th>Montant</th><th>Bon</th><th>Révision</th><th>Net à Payer</th><th>Observation</th>
    </tr></thead><tbody>
    ${salairesSec.map((s,i)=>`<tr>
      <td>${i+1}</td><td style="text-align:left">${s.nom}</td><td>${s.matiere||""}</td><td>${s.niveau||""}</td>
      <td>${s.vhHebdo||0}</td><td>${s.vhPrevu||0}</td><td>${s.cinqSem||0}</td><td>${s.nonExecute||0}</td>
      <td><strong>${calcExecute(s)}</strong></td><td>${fmtN(s.primeHoraire)}</td>
      <td>${fmtN(calcMontant(s))}</td><td>${fmtN(s.bon||0)}</td><td>${fmtN(s.revision||0)}</td>
      <td><strong>${fmtN(calcNet(s))}</strong></td><td>${s.observation||""}</td>
    </tr>`).join("")}
    <tr class="total-row"><td colspan="13" style="text-align:right">TOTAL NET SECONDAIRE</td><td>${fmtN(totNetSec)}</td><td></td></tr>
    </tbody></table>
    <div class="section">SECTION PRIMAIRE</div>
    <table><thead><tr><th>N°</th><th>Prénoms et Nom</th><th>Classe</th><th>Montant</th><th>Bon</th><th>Révision</th><th>Net à Payer</th><th>Observation</th></tr></thead>
    <tbody>
    ${salairesPrim.map((s,i)=>`<tr><td>${i+1}</td><td style="text-align:left">${s.nom}</td><td>${s.niveau||""}</td>
      <td>${fmtN(s.montantForfait||0)}</td><td>${fmtN(s.bon||0)}</td><td>${fmtN(s.revision||0)}</td>
      <td><strong>${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</strong></td><td>${s.observation||""}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="6" style="text-align:right">TOTAL NET PRIMAIRE</td><td>${fmtN(totNetPrim)}</td><td></td></tr>
    </tbody></table>
    <div style="text-align:right;font-size:12px;font-weight:bold;margin-top:8px;color:#0A1628">
      TOTAL GÉNÉRAL NET : ${fmtN(totNetSec+totNetPrim)} GNF
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px">
      <div style="border-top:2px solid #0A1628;padding-top:6px;text-align:center;font-size:10px">Le Comptable<br/><br/><br/>Signature</div>
      <div style="border-top:2px solid #0A1628;padding-top:6px;text-align:center;font-size:10px">Le Directeur<br/><br/><br/>Signature</div>
      <div style="border-top:2px solid #0A1628;padding-top:6px;text-align:center;font-size:10px">Le Fondateur<br/><br/><br/>Signature</div>
    </div>
    <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  const tabs=[{id:"bilan",label:"Bilan"},{id:"recettes",label:`Recettes (${recettes.length})`},
    {id:"depenses",label:`Dépenses (${depenses.length})`},
    {id:"salaires",label:`Salaires`},
    {id:"enseignants",label:`Enseignants (${ensPrimaire.length+ensCollege.length+ensLycee.length})`},
    {id:"personnel",label:`Personnel admin (${personnel.length})`},
    {id:"fondation",label:`Versements (${versements.length})`},
    {id:"enrolment",label:`Élèves (${elevesC.length+elevesL.length+elevesP.length})`},
    {id:"mens",label:"Mensualités"},
    {id:"transferts",label:"🔄 Transferts"}];

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Comptabilité</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Finances, salaires, versements & mensualités</p>
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <Tabs items={tabs} actif={tab} onChange={setTab}/>

      {tab==="bilan"&&<div>
        {/* Calcul impayés */}
        {(()=>{
          const tousEleves=tousElevesScolarite;
          const totalDu=tousEleves.reduce((s,e)=>s+moisAnnee.length*getTarif(e.classe),0);
          const totalPercu=tousEleves.reduce((s,e)=>{
            const pays=moisAnnee.filter(m=>(e.mens||{})[m]==="Payé").length;
            return s+pays*getTarif(e.classe);
          },0);
          const impaye=totalDu-totalPercu;
          const pctImpaye=totalDu>0?((impaye/totalDu)*100).toFixed(1):0;
          const blocage=!!schoolInfo.blocageParentImpaye;
          const toggleBlocage=async()=>{
            if(!canCreate){toast("Action réservée au comptable ou à l'administrateur.","warning");return;}
            await updateDoc(doc(db,"ecoles",schoolId),{blocageParentImpaye:!blocage});
            toast(blocage?"🔓 Accès parents rétabli":"🔒 Accès parents bloqué pour les impayés","success");
          };
          return (<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
              <Stat label="Recettes" value={`${(totR/1e6).toFixed(2)}M`} sub="GNF" bg="#eaf4e0"/>
              <Stat label="Dépenses" value={`${(totD/1e6).toFixed(2)}M`} sub="GNF" bg="#fce8e8"/>
              <Stat label="Vers. Fondation" value={`${(totVers/1e6).toFixed(2)}M`} sub="GNF" bg="#e6f4ea"/>
              <Stat label="Solde" value={`${((totR-totD)/1e6).toFixed(2)}M`} sub="GNF" bg={(totR-totD)>=0?"#eaf4e0":"#fce8e8"}/>
              <Stat label="Masse salariale" value={`${((totNetSec+totNetPrim+totNetPers)/1e6).toFixed(3)}M`} sub={`GNF — ${moisLabel} (${salairesMois.length})`} bg="#fef3e0"/>
              <Stat label="Mensualités impayées" value={`${(impaye/1e6).toFixed(2)}M`} sub={`GNF — ${pctImpaye}% du total dû`} bg="#fce8e8"/>
              <Stat label="Mensualités perçues" value={`${(totalPercu/1e6).toFixed(2)}M`} sub={`${totalDu>0?(100-Number(pctImpaye)).toFixed(1):0}% du total`} bg="#eaf4e0"/>
            </div>
            {/* ── Contrôle accès parent ── */}
            <div style={{background:blocage?"#fff0f0":"#f0fdf4",border:`2px solid ${blocage?"#f87171":"#4ade80"}`,borderRadius:14,padding:"18px 20px",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <span style={{fontSize:34,lineHeight:1}}>{blocage?"🔒":"🔓"}</span>
                <div style={{flex:1,minWidth:180}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <span style={{fontWeight:900,fontSize:14,color:"#1e293b"}}>Portail parents — Notes & Bulletins</span>
                    <span style={{
                      display:"inline-block",padding:"3px 12px",borderRadius:20,fontWeight:900,fontSize:12,letterSpacing:.5,
                      background:blocage?"#b91c1c":"#15803d",color:"#fff",
                    }}>{blocage?"🔴 BLOQUÉ":"🟢 OUVERT"}</span>
                  </div>
                  <div style={{fontSize:12,color:"#6b7280"}}>
                    {blocage
                      ? "Les parents d'élèves avec mensualités impayées ne peuvent pas consulter ni imprimer les notes et bulletins."
                      : "Tous les parents peuvent consulter et imprimer les notes et bulletins."}
                  </div>
                </div>
                {canCreate&&(
                  <button onClick={toggleBlocage} style={{
                    background:blocage?"#15803d":"#b91c1c",color:"#fff",
                    border:"none",padding:"10px 22px",borderRadius:10,cursor:"pointer",fontWeight:900,fontSize:13,
                    whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(0,0,0,.15)",
                  }}>
                    {blocage?"🔓 Débloquer":"🔒 Bloquer"}
                  </button>
                )}
              </div>
            </div>
          </>);
        })()}
        {(cR||cD)?<Chargement/>:totR===0&&totD===0?<Vide icone="📊" msg="Aucune donnée financière"/>
          :<>
            <Card><div style={{padding:"16px 18px"}}>
              {[{l:"Recettes",v:totR,c:C.green},{l:"Dépenses",v:totD,c:"#b91c1c"}].map(b=>(
                <div key={b.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:700,color:b.c}}>{b.l}</span>
                    <span style={{fontSize:12,fontWeight:600}}>{fmt(b.v)}</span>
                  </div>
                  <div style={{background:"#e8f0e8",borderRadius:6,height:8}}>
                    <div style={{background:b.c,borderRadius:6,height:8,width:`${(b.v/Math.max(totR,totD,1)*100).toFixed(0)}%`}}/>
                  </div>
                </div>
              ))}
              <div style={{marginTop:14,padding:"10px 14px",background:(totR-totD)>=0?"#eaf4e0":"#fce8e8",borderRadius:7,display:"flex",justifyContent:"space-between"}}>
                <strong style={{color:(totR-totD)>=0?C.greenDk:"#b91c1c"}}>Solde</strong>
                <strong style={{color:(totR-totD)>=0?C.greenDk:"#b91c1c"}}>{fmt(totR-totD)}</strong>
              </div>
            </div></Card>

            {/* ── Graphiques ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
              {/* Recettes vs Dépenses par période */}
              <Card><div style={{padding:"14px 16px"}}>
                <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Recettes vs Dépenses par période</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={["T1","T2","T3"].map(p=>({
                    periode:p,
                    Recettes:recettes.filter(r=>r.periode===p).reduce((s,r)=>s+Number(r.montant||0),0),
                    "Dépenses":depenses.filter(d=>d.periode===p).reduce((s,d)=>s+Number(d.montant||0),0),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                    <XAxis dataKey="periode" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:10}} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/>
                    <Tooltip formatter={v=>fmt(v)}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="Recettes" fill={C.green} radius={[4,4,0,0]}/>
                    <Bar dataKey="Dépenses" fill="#ef4444" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div></Card>

              {/* Mensualités payées vs impayées */}
              <Card><div style={{padding:"14px 16px"}}>
                <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Mensualités — état des paiements</p>
                {(()=>{
                  const tousEleves=tousElevesScolarite;
                  const totalMois=tousEleves.reduce(s=>s+moisAnnee.length,0);
                  const totalPayes=tousEleves.reduce((s,e)=>s+moisAnnee.filter(m=>(e.mens||{})[m]==="Payé").length,0);
                  const totalImpay=totalMois-totalPayes;
                  const data=[{name:"Payés",value:totalPayes},{name:"Impayés",value:totalImpay}];
                  return <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        <Cell fill={C.green}/><Cell fill="#ef4444"/>
                      </Pie>
                      <Tooltip formatter={v=>`${v} mois`}/>
                    </PieChart>
                  </ResponsiveContainer>;
                })()}
              </div></Card>
            </div>

            {/* Évolution mensuelle des recettes */}
            {recettes.length>0&&<Card style={{marginTop:14}}><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Évolution des recettes par catégorie</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={(()=>{
                  const cats=[...new Set(recettes.map(r=>r.categorie))].filter(Boolean);
                  return ["T1","T2","T3"].map(p=>{
                    const row={periode:p};
                    cats.forEach(c=>row[c]=recettes.filter(r=>r.periode===p&&r.categorie===c).reduce((s,r)=>s+Number(r.montant||0),0));
                    return row;
                  });
                })()} >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="periode" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  {[...new Set(recettes.map(r=>r.categorie))].filter(Boolean).map((cat,i)=>(
                    <Bar key={cat} dataKey={cat} stackId="a" fill={["#0A1628","#00C48C","#f59e0b","#00A876","#ef4444","#06b6d4"][i%6]} radius={i===0?[0,0,4,4]:[0,0,0,0]}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div></Card>}
          </>}
      </div>}

      {tab==="recettes"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Recettes ({recettes.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({periode:"T1"});setModal("add_r");}}>+ Nouvelle recette</Btn>}
        </div>
        {cR?<Chargement/>:recettes.length===0?<Vide icone="💰" msg="Aucune recette"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Libellé","Catégorie","Période","Montant","Date",canEdit?"Actions":""]}/>
            <tbody>{recettes.map(r=><TR key={r._id}>
              <TD bold>{r.libelle}</TD><TD><Badge color="vert">{r.categorie}</Badge></TD>
              <TD>{r.periode}</TD><TD bold>{fmt(r.montant)}</TD><TD>{r.date}</TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...r});setModal("edit_r");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supR(r._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {(modal==="add_r"&&canCreate||(modal==="edit_r"&&canEdit))&&<Modale titre={modal==="add_r"?"Nouvelle recette":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
            <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}><option>Scolarité</option><option>Inscription</option><option>Examens</option><option>Activités</option><option>Don</option></Selec>
            <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}><option>T1</option><option>T2</option><option>T3</option></Selec>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="success" onClick={()=>enreg(ajR,modR,{montant:Number(form.montant)})}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {tab==="depenses"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Dépenses ({depenses.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({periode:"T1"});setModal("add_d");}}>+ Nouvelle dépense</Btn>}
        </div>
        {cD?<Chargement/>:depenses.length===0?<Vide icone="💸" msg="Aucune dépense"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Libellé","Catégorie","Période","Montant","Date",canEdit?"Actions":""]}/>
            <tbody>{depenses.map(d=><TR key={d._id}>
              <TD bold>{d.libelle}</TD><TD><Badge color="red">{d.categorie}</Badge></TD>
              <TD>{d.periode}</TD><TD bold>{fmt(d.montant)}</TD><TD>{d.date}</TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d2");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supD(d._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {(modal==="add_d"&&canCreate||(modal==="edit_d2"&&canEdit))&&<Modale titre={modal==="add_d"?"Nouvelle dépense":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
            <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}><option>Salaires</option><option>Matériel</option><option>Infrastructure</option><option>Charges</option><option>Divers</option></Selec>
            <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}><option>T1</option><option>T2</option><option>T3</option></Selec>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="danger" onClick={()=>enreg(ajD,modD,{montant:Number(form.montant)})}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ÉTATS DE SALAIRES MODÈLE EXCEL ── */}
      {tab==="salaires"&&<div>
        {/* Barre de navigation interne */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[{id:"etats",label:"États de salaires"},{id:"bons",label:`Bons (${bonsMois.length})`}].map(t=>(
            <button key={t.id} onClick={()=>setSousTabSal(t.id)} style={{
              padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
              background:sousTabSal===t.id?C.blueDark:"#e0ebf8",
              color:sousTabSal===t.id?"#fff":C.blueDark,
            }}>{t.label}</button>
          ))}
          <div style={{flex:1}}/>
          <select value={moisSel} onChange={e=>setMoisSel(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",color:C.blueDark,fontWeight:700}}>
            <option value="__TOUS__">Tous les mois (prévision)</option>
            {moisSalaire.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          {sousTabSal==="etats"&&<>
            {canCreate&&<label title="Appliquée uniquement aux enseignants sans prime définie sur leur fiche" style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.blueDark,background:"#f0f7ff",border:"1px solid #b0c4d8",borderRadius:7,padding:"4px 10px",cursor:"help"}}>
              Prime/h par défaut
              <input type="number" min="0" value={primeDefaut||""} placeholder="0"
                onChange={e=>setPrimeDefaut(Number(e.target.value))}
                style={{width:80,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:C.blueDark,outline:"none"}}/>
              GNF
            </label>}
            {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires()}>⚡ Auto-générer</Btn>}
            {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires({resync:true})} title="Recalcule V/H et prime horaire des lignes existantes à partir de la fiche enseignant et de l'EDT actuels (bons et révisions préservés)">🔄 Rafraîchir</Btn>}
            {canCreate&&bonsMois.length>0&&<Btn v="amber" onClick={appliquerBons}>✔ Appliquer les bons</Btn>}
            {canCreate&&<Btn onClick={()=>{setForm({section:"Secondaire",mois:moisModale,nonExecute:0,cinqSem:0,bon:0,revision:0});setModal("add_s");}}>+ Ajouter</Btn>}
            <Btn v="vert" onClick={imprimerSalaires}>🖨️ Imprimer</Btn>
          </>}
          {(()=>{const j5=getJours5emeSemaine(moisSel);return j5.length>0&&(
            <div style={{width:"100%",marginTop:6,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:8,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:15}}>📅</span>
              <strong style={{color:"#92400e"}}>{moisSel} — 5ème semaine :</strong>
              {j5.map(j=><span key={j} style={{background:"#f59e0b",color:"#fff",fontWeight:700,padding:"2px 9px",borderRadius:10,fontSize:11}}>{j}</span>)}
              <span style={{color:"#92400e",fontSize:11}}>→ Les enseignants qui ont cours ces jours ont des heures supplémentaires. Cliquez sur ⚡ Auto-générer pour les calculer automatiquement.</span>
            </div>
          );})()}
          {sousTabSal==="bons"&&canCreate&&<Btn onClick={()=>{setForm({mois:moisModale,section:"Secondaire"});setModal("add_b");}}>+ Nouveau bon</Btn>}
        </div>

        {/* ── SOUS-ONGLET BONS ── */}
        {sousTabSal==="bons"&&<>
          {bonsMois.length===0
            ?<Vide icone="📋" msg={`Aucun bon enregistré pour ${moisLabel}`}/>
            :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Enseignant","Section","Mois","Montant (GNF)","Motif",canEdit?"Actions":""]}/>
              <tbody>{bonsMois.map(b=><TR key={b._id}>
                <TD bold>{b.nom}</TD>
                <TD><Badge color={b.section==="Primaire"?"vert":"blue"}>{b.section}</Badge></TD>
                <TD>{b.mois}</TD>
                <TD center style={{color:"#b91c1c",fontWeight:700}}>{fmtN(b.montant||0)}</TD>
                <TD>{b.motif||"—"}</TD>
                {canEdit&&<TD center>
                  <Btn sm v="ghost" onClick={()=>{setForm({...b});setModal("edit_b");}}>✏️</Btn>
                  <Btn sm v="red" onClick={()=>confirm("Supprimer ce bon ?")&&supBon(b._id)}>🗑</Btn>
                </TD>}
              </TR>)}
              <tr style={{background:"#fce8e8",fontWeight:800}}>
                <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#9b2020"}}>TOTAL BONS — {moisLabel}</td>
                <td style={{padding:"8px 12px",textAlign:"center",color:"#9b2020",fontSize:14}}>{fmtN(bonsMois.reduce((s,b)=>s+Number(b.montant||0),0))}</td>
                <td colSpan={2}></td>
              </tr>
              </tbody>
            </table></Card>
          }
          <div style={{marginTop:12,padding:"12px 16px",background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,fontSize:13,color:"#92400e"}}>
            <strong>Comment ça marche :</strong> Enregistrez ici les bons de chaque enseignant pour ce mois.
            Ensuite, dans <em>États de salaires</em>, cliquez sur <strong>✔ Appliquer les bons</strong> pour reporter automatiquement les montants dans la colonne "Bon" de chaque enseignant.
          </div>
        </>}

        {/* ── SOUS-ONGLET ÉTATS ── */}
        {sousTabSal==="etats"&&<>

        {/* ── BILAN SALAIRES ── */}
        {!cS&&(()=>{
          const totGen=totNetSec+totNetPrim+totNetPers;
          const nbEns=salairesMois.length;
          const dataEvol=moisSalaire.map(m=>{
            const ms=salaires.filter(s=>s.mois===m);
            const sec=ms.filter(s=>s.section==="Secondaire").reduce((sum,s)=>sum+calcNet(s),0);
            const prim=ms.filter(s=>s.section==="Primaire").reduce((sum,s)=>sum+Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0),0);
            const pers=ms.filter(s=>s.section==="Personnel").reduce((sum,s)=>sum+Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0),0);
            return {mois:m.slice(0,4),Secondaire:sec,Primaire:prim,Personnel:pers,Total:sec+prim+pers};
          });
          return <>
            {/* Cartes récap */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
              <div style={{background:"linear-gradient(135deg,#0A1628,#1d4ed8)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Masse salariale</div>
                <div style={{fontSize:18,fontWeight:900}}>{(totGen/1e6).toFixed(3)}M</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF — {moisLabel}</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#0A1628,#1a6baa)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Secondaire</div>
                <div style={{fontSize:18,fontWeight:900}}>{(totNetSec/1e6).toFixed(3)}M</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesSec.length} enseignant(s)</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#00A876,#00C48C)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Primaire</div>
                <div style={{fontSize:18,fontWeight:900}}>{(totNetPrim/1e6).toFixed(3)}M</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesPrim.length} enseignant(s)</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Personnel</div>
                <div style={{fontSize:18,fontWeight:900}}>{(totNetPers/1e6).toFixed(3)}M</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesPers.length} employé(s)</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#0A1628,#1565c0)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Total agents</div>
                <div style={{fontSize:28,fontWeight:900}}>{nbEns}</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>ce mois</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#b45309,#f59e0b)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Moy. par agent</div>
                <div style={{fontSize:18,fontWeight:900}}>{nbEns>0?Math.round(totGen/nbEns).toLocaleString("fr-FR"):0}</div>
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF</div>
              </div>
            </div>
            {/* Barre de répartition */}
            {totGen>0&&<div style={{marginBottom:16,background:"#f0f4f8",borderRadius:10,padding:"12px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:6,flexWrap:"wrap",gap:4}}>
                <span style={{color:C.blue}}>Secondaire : {totNetSec>0?((totNetSec/totGen)*100).toFixed(1):0}%</span>
                <span style={{color:C.green}}>Primaire : {totNetPrim>0?((totNetPrim/totGen)*100).toFixed(1):0}%</span>
                <span style={{color:"#7c3aed"}}>Personnel : {totNetPers>0?((totNetPers/totGen)*100).toFixed(1):0}%</span>
              </div>
              <div style={{display:"flex",borderRadius:6,overflow:"hidden",height:12}}>
                <div style={{background:C.blue,width:`${totGen>0?(totNetSec/totGen*100):0}%`,transition:"width .4s"}}/>
                <div style={{background:C.green,width:`${totGen>0?(totNetPrim/totGen*100):0}%`,transition:"width .4s"}}/>
                <div style={{background:"#a855f7",flex:1}}/>
              </div>
            </div>}
            {/* Graphique évolution annuelle */}
            {salaires.length>0&&<Card style={{marginBottom:16}}><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Évolution de la masse salariale — Année {annee||getAnnee()}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataEvol} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="mois" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>v===0?"0":`${(v/1e6).toFixed(1)}M`}/>
                  <Tooltip formatter={(v,n)=>[fmtN(v)+" GNF",n]}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="Secondaire" fill={C.blue} radius={[3,3,0,0]}/>
                  <Bar dataKey="Primaire" fill={C.green} radius={[3,3,0,0]}/>
                  <Bar dataKey="Personnel" fill="#a855f7" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>}
          </>;
        })()}

        {cS?<Chargement/>:<>
          {moisSel==="__TOUS__"&&<div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#92400e"}}>
            <strong>📊 Mode prévision annuelle</strong> — Sélectionnez un mois précis pour consulter ou modifier ses salaires.
            Cliquez sur <strong>⚡ Auto-générer</strong> pour remplir d'un coup les {moisSalaire.length} mois de l'année scolaire.
          </div>}

          {/* Section Secondaire */}
          <div style={{background:C.blue,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13}}>
            SECTION SECONDAIRE — {moisLabel} {annee||getAnnee()}
          </div>
          <div style={{overflowX:"auto",marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
              <thead>
                <tr style={{background:"#e0ebf8"}}>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>N°</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Prénoms et Nom</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Matière</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Niveau</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>V.H.<br/>Hebdo</th>
                  <th colSpan={4} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>V.H. Mensuel</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Prime<br/>Horaire</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Montant</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Bon</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center",background:"#fef3e0"}}>Révision</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center",background:"#eaf4e0"}}>Net à<br/>Payer</th>
                  <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Obs.</th>
                  {canEdit&&<th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Act.</th>}
                </tr>
                <tr style={{background:"#e0ebf8"}}>
                  {["Prévu","5è Sem","Non Exé.","Exécuté"].map(h=><th key={h} style={{padding:"5px 8px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {salairesSec.length===0?
                  <tr><td colSpan={canEdit?15:14} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>Aucun enseignant secondaire pour ce mois</td></tr>
                  :salairesSec.map((s,i)=>(
                    <tr key={s._id} style={{borderBottom:"1px solid #e8f0e8",background:i%2===0?"#fff":"#f9fbf9"}}>
                      <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{i+1}</td>
                      <td style={{padding:"7px 10px",fontWeight:700,fontSize:12,color:C.blueDark,border:"1px solid #e8f0e8"}}>{s.nom}</td>
                      <td style={{padding:"7px 10px",fontSize:12,border:"1px solid #e8f0e8"}}>{s.matiere}</td>
                      <td style={{padding:"7px 10px",fontSize:12,border:"1px solid #e8f0e8"}}>{s.niveau}</td>
                      <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.vhHebdo||0}</td>
                      <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.vhPrevu||0}</td>
                      <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.cinqSem||0}</td>
                      <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.nonExecute||0}</td>
                      <td style={{padding:"7px 10px",textAlign:"center",fontWeight:700,fontSize:12,border:"1px solid #e8f0e8",background:"#f0f8ff"}}>{calcExecute(s)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,border:"1px solid #e8f0e8"}}>{fmtN(s.primeHoraire)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,border:"1px solid #e8f0e8"}}>{fmtN(calcMontant(s))}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,color:"#b91c1c",border:"1px solid #e8f0e8"}}>{fmtN(s.bon||0)}</td>
                      <td style={{padding:"4px 6px",textAlign:"center",border:"1px solid #e8f0e8",background:"#fffbeb"}}>
                        {canEdit
                          ?<input type="number" value={s.revision||0} onChange={e=>modS({...s,revision:Number(e.target.value)})}
                            style={{width:80,border:"1px solid #fbbf24",borderRadius:5,padding:"3px 5px",fontSize:11,textAlign:"right"}}/>
                          :<span style={{fontSize:12}}>{fmtN(s.revision||0)}</span>}
                      </td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:800,fontSize:13,color:C.greenDk,background:"#eaf4e0",border:"1px solid #b0c4d8"}}>{fmtN(calcNet(s))}</td>
                      <td
                        title={s.observation||""}
                        style={{padding:"7px 10px",fontSize:11,color:"#6b7280",border:"1px solid #e8f0e8",maxWidth:280,whiteSpace:"normal",lineHeight:1.4}}
                      >
                        {s.observation}
                      </td>
                      {canEdit&&<td style={{padding:"7px 6px",border:"1px solid #e8f0e8"}}>
                        <div style={{display:"flex",gap:4}}>
                          <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                          <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supS(s._id);}}>×</Btn>
                        </div>
                      </td>}
                    </tr>
                ))}
                <tr style={{background:"#e0ebf8",fontWeight:800}}>
                  <td colSpan={13} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark,border:"1px solid #b0c4d8"}}>TOTAL NET SECONDAIRE</td>
                  <td style={{padding:"8px 12px",textAlign:"right",color:C.greenDk,fontSize:14,border:"1px solid #b0c4d8"}}>{fmtN(totNetSec)}</td>
                  <td colSpan={readOnly?1:2} style={{border:"1px solid #b0c4d8"}}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section Primaire */}
          <div style={{background:C.green,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{flex:1}}>SECTION PRIMAIRE — {moisLabel} {annee||getAnnee()}</span>
            <input
              placeholder="🔍 Recherche par nom..."
              value={filtrePrimNom} onChange={e=>setFiltrePrimNom(e.target.value)}
              style={{border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#0A1628",width:160,outline:"none"}}/>
            <select value={filtrePrimClasse} onChange={e=>setFiltrePrimClasse(e.target.value)}
              style={{border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,color:"#0A1628",background:"#fff"}}>
              <option value="all">Toutes les classes</option>
              {CLASSES_PRIMAIRE.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{overflowX:"auto",marginBottom:8}}>
            {(()=>{
            const salairesPrimFiltres = salairesPrim
              .filter(s=>!filtrePrimNom||(s.nom||"").toLowerCase().includes(filtrePrimNom.toLowerCase()))
              .filter(s=>filtrePrimClasse==="all"||(s.niveau||"")===filtrePrimClasse);
            return <table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["N°","Prénoms et Nom","Classe","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
              <tbody>
                {salairesPrimFiltres.length===0?
                  <tr><td colSpan={canEdit?8:7} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>{salairesPrim.length===0?"Aucun enseignant primaire pour ce mois":"Aucun résultat pour ce filtre"}</td></tr>
                  :salairesPrimFiltres.map((s,i)=>(
                    <TR key={s._id}>
                      <TD center>{i+1}</TD>
                      <TD bold>{s.nom}</TD>
                      <TD>{s.niveau}</TD>
                      <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                      <TD center style={{background:"#fffbeb"}}>
                        {canEdit
                          ?<input type="number" value={s.revision||0} onChange={e=>modS({...s,revision:Number(e.target.value)})}
                            style={{width:80,border:"1px solid #fbbf24",borderRadius:5,padding:"3px 5px",fontSize:11,textAlign:"right"}}/>
                          :<span style={{fontSize:12}}>{fmtN(s.revision||0)}</span>}
                      </TD>
                      <TD center style={{fontWeight:800,color:C.greenDk,background:"#eaf4e0"}}>{fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</TD>
                      <TD>{s.observation}</TD>
                      {canEdit&&<TD><div style={{display:"flex",gap:4}}>
                        <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                        <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supS(s._id);}}>×</Btn>
                      </div></TD>}
                    </TR>
                ))}
                <tr style={{background:"#e0ebf8",fontWeight:800}}>
                  <td colSpan={5} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark}}>
                    TOTAL NET PRIMAIRE {filtrePrimClasse!=="all"||filtrePrimNom?`(filtre : ${salairesPrimFiltres.length}/${salairesPrim.length})` : ""}
                  </td>
                  <td style={{padding:"8px 12px",textAlign:"center",color:C.greenDk,fontSize:14}}>
                    {fmtN(salairesPrimFiltres.reduce((s,e)=>s+Number(e.montantForfait||0)-Number(e.bon||0)+Number(e.revision||0),0))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>;
            })()}
          </div>

          {/* Section Personnel */}
          <div style={{background:"#7c3aed",color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10}}>
            <span style={{flex:1}}>SECTION PERSONNEL — {moisLabel} {annee||getAnnee()}</span>
          </div>
          <div style={{overflowX:"auto",marginBottom:8}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["N°","Prénoms et Nom","Poste","Catégorie","Salaire de base","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
              <tbody>
                {salairesPers.length===0
                  ?<tr><td colSpan={canEdit?10:9} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>Aucun employé pour ce mois</td></tr>
                  :salairesPers.map((s,i)=>(
                    <TR key={s._id}>
                      <TD center>{i+1}</TD>
                      <TD bold>{s.nom}</TD>
                      <TD>{s.poste||"—"}</TD>
                      <TD><Badge color="purple">{s.categorie||"—"}</Badge></TD>
                      <TD center>{fmtN(s.montantForfait||0)}</TD>
                      <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                      <TD center style={{color:C.greenDk}}>{fmtN(s.revision||0)}</TD>
                      <TD center><strong style={{color:C.greenDk}}>{fmtN(calcNetF(s))}</strong></TD>
                      <TD>{s.observation||""}</TD>
                      {canEdit&&<TD center>
                        <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                        <Btn sm v="red" onClick={()=>confirm("Supprimer ?")&&supS(s._id)}>🗑</Btn>
                      </TD>}
                    </TR>
                  ))
                }
                <tr style={{background:"#ede9fe",fontWeight:800}}>
                  <td colSpan={7} style={{padding:"8px 12px",textAlign:"right",color:"#7c3aed"}}>TOTAL NET PERSONNEL</td>
                  <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>{fmtN(totNetPers)}</td>
                  <td colSpan={canEdit?2:1}></td>
                </tr>
                <tr style={{background:C.blue,color:"#fff",fontWeight:900}}>
                  <td colSpan={7} style={{padding:"10px 12px",textAlign:"right",fontSize:14,letterSpacing:".4px"}}>TOTAL GÉNÉRAL NET À PAYER</td>
                  <td style={{padding:"10px 12px",textAlign:"center",fontSize:16,fontWeight:900}}>{fmtN(totNetSec+totNetPrim+totNetPers)} GNF</td>
                  <td colSpan={canEdit?2:1}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

        </>}

        {/* MODAL AJOUT/MODIF SALAIRE */}
        {(modal==="add_s"&&canCreate||(modal==="edit_s"&&canEdit))&&<Modale large titre={modal==="add_s"?"Nouveau salaire":"Modifier le salaire"} fermer={()=>setModal(null)}>
          <div style={{marginBottom:14}}>
            <Selec label="Section" value={form.section||"Secondaire"} onChange={chg("section")}>
              <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
            </Selec>
          </div>
          <Selec label="Mois" value={form.mois||moisModale} onChange={chg("mois")}>
            {moisSalaire.map(m=><option key={m}>{m}</option>)}
          </Selec>
          <div style={{height:12}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Prénoms et Nom" value={form.nom||""} onChange={chg("nom")}/></div>
            {form.section==="Secondaire"?<>
              <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
              <Input label="Niveau" value={form.niveau||""} onChange={chg("niveau")}/>
              <Input label="V.H. Hebdomadaire" type="number" value={form.vhHebdo||""} onChange={e=>{const v=Number(e.target.value);setForm(p=>({...p,vhHebdo:v,vhPrevu:v*4}));}}/>
              <Input label="V.H. Mensuel Prévu" type="number" value={form.vhPrevu||""} onChange={chg("vhPrevu")}/>
              <Input label="5ème Semaine" type="number" value={form.cinqSem||0} onChange={chg("cinqSem")}/>
              <Input label="Non Exécuté" type="number" value={form.nonExecute||0} onChange={chg("nonExecute")}/>
              <Input label="Prime Horaire (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")}/>
              <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
              <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
            </>:form.section==="Personnel"?<>
              <Input label="Poste" value={form.poste||""} onChange={chg("poste")} placeholder="Ex : Gardien, Secrétaire…"/>
              <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}>
                <option value="">— Catégorie —</option>
                {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(c=><option key={c}>{c}</option>)}
              </Selec>
              <Input label="Salaire de base (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
              <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
              <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
            </>:<>
              <Input label="Classe" value={form.niveau||""} onChange={chg("niveau")}/>
              <Input label="Montant Forfaitaire (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
              <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
              <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
            </>}
            <div style={{gridColumn:"1/-1"}}><Input label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
          </div>
          {form.section==="Secondaire"&&<div style={{marginTop:12,padding:"10px 14px",background:"#e0ebf8",borderRadius:8,fontSize:13}}>
            <strong>Aperçu :</strong> Exécuté = {calcExecute(form)} h &nbsp;|&nbsp;
            Montant = {fmtN(calcMontant(form))} GNF &nbsp;|&nbsp;
            Bon = -{fmtN(form.bon||0)} &nbsp;|&nbsp;
            Révision = +{fmtN(form.revision||0)} &nbsp;|&nbsp;
            <strong style={{color:C.greenDk}}>Net = {fmtN(calcNet(form))} GNF</strong>
          </div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>enreg(ajS,modS,{vhHebdo:Number(form.vhHebdo||0),vhPrevu:Number(form.vhPrevu||0),cinqSem:Number(form.cinqSem||0),nonExecute:Number(form.nonExecute||0),primeHoraire:Number(form.primeHoraire||0),bon:Number(form.bon||0),revision:Number(form.revision||0),montantForfait:Number(form.montantForfait||0)})}>Enregistrer</Btn>
          </div>
        </Modale>}

        {/* MODAL AJOUT/MODIF BON */}
        {(modal==="add_b"&&canCreate||(modal==="edit_b"&&canEdit))&&(()=>{
          const moisBon = form.mois||moisModale;
          const secBon = form.section||"Secondaire";
          const ensDisponibles = salaires
            .filter(s=>s.mois===moisBon && s.section===secBon)
            .map(s=>s.nom||"")
            .filter(Boolean)
            .sort();
          return <Modale titre={modal==="add_b"?"Nouveau bon":"Modifier le bon"} fermer={()=>setModal(null)}>
            <Selec label="Mois" value={moisBon} onChange={chg("mois")}>
              {moisSalaire.map(m=><option key={m}>{m}</option>)}
            </Selec>
            <div style={{height:10}}/>
            <Selec label="Section" value={secBon} onChange={e=>{chg("section")(e);setForm(p=>({...p,nom:""}));}}>
              <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
            </Selec>
            <div style={{height:10}}/>
            <Selec label="Enseignant" value={form.nom||""} onChange={chg("nom")}>
              <option value="">— Sélectionner un enseignant —</option>
              {ensDisponibles.map(n=><option key={n} value={n}>{n}</option>)}
              {ensDisponibles.length===0&&<option disabled>Aucun enseignant pour ce mois/section</option>}
            </Selec>
            {ensDisponibles.length===0&&<div style={{fontSize:11,color:"#b45309",marginTop:4}}>
              Générez d'abord les salaires pour ce mois avant d'ajouter des bons.
            </div>}
            <div style={{height:10}}/>
            <Input label="Montant du bon (GNF)" type="number" value={form.montant||""} onChange={chg("montant")} placeholder="Ex : 50000"/>
            <div style={{height:10}}/>
            <Input label="Motif" value={form.motif||""} onChange={chg("motif")} placeholder="Ex : Retard, Absence injustifiée…"/>
            <div style={{marginTop:12,padding:"10px 14px",background:"#fce8e8",borderRadius:8,fontSize:12,color:"#9b2020"}}>
              Le bon sera déduit du salaire net de l'enseignant lors de l'application.
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn onClick={()=>enreg(ajBon,modBon,{montant:Number(form.montant||0)})}>Enregistrer</Btn>
            </div>
          </Modale>;
        })()}
      </div>}

      {/* ══ ONGLET PERSONNEL ENSEIGNANT (vue hybride) ══ */}
      {tab==="enseignants"&&(()=>{
        const ensTous=[
          ...ensPrimaire.map(e=>({...e,_section:"Primaire"})),
          ...ensCollege.map(e=>({...e,_section:"Collège"})),
          ...ensLycee.map(e=>({...e,_section:"Lycée"})),
        ];
        const ajEnsForSection=(sec)=>sec==="Primaire"?ajEnsPrim:sec==="Collège"?ajEnsCol:ajEnsLyc;
        const modEnsForSection=(sec)=>sec==="Primaire"?modEnsPrim:sec==="Collège"?modEnsCol:modEnsLyc;
        const supEnsForSection=(sec)=>sec==="Primaire"?supEnsPrim:sec==="Collège"?supEnsCol:supEnsLyc;
        const saveEns=async()=>{
          const sec=form._section||"Primaire";
          const isPrim=sec==="Primaire";
          const payload={
            nom:form.nom||"",prenom:form.prenom||"",
            telephone:form.telephone||"",
            grade:form.grade||"",
            statut:form.statut||(isPrim?"Titulaire":"Titulaire"),
          };
          if(isPrim){
            payload.montantForfait=Number(form.montantForfait||0);
            if(form.classeTitle) payload.classeTitle=form.classeTitle;
          } else {
            payload.primeHoraire=Number(form.primeHoraire||0);
            payload.primeParClasse=(form.primeParClasse||[]).filter(p=>p.classe&&Number(p.prime)>0).map(p=>({classe:p.classe,prime:Number(p.prime)}));
          }
          if(modal==="edit_ens_compta"){
            await modEnsForSection(sec)({...payload,_id:form._id});
            toast("Enseignant mis à jour.","success");
            logAction("Enseignant modifié (Compta)",`${payload.prenom} ${payload.nom} · ${sec}`);
          } else {
            await ajEnsForSection(sec)(payload);
            toast("Enseignant créé. Affectations pédagogiques à compléter dans Primaire/Secondaire.","success");
            logAction("Enseignant créé (Compta)",`${payload.prenom} ${payload.nom} · ${sec}`);
          }
          setModal(null);setForm({});
        };
        return <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Registre des enseignants ({ensTous.length})</strong>
            {canCreate&&<Btn onClick={()=>{setForm({_section:"Primaire",statut:"Titulaire"});setModal("add_ens_compta");}}>+ Ajouter un enseignant</Btn>}
          </div>

          <div style={{padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af",marginBottom:14}}>
            <strong>Vue hybride :</strong> identité et paie modifiables ici. Les affectations pédagogiques (matière, classes titulaires, primes par classe, EDT) se gèrent dans <em>Primaire</em> ou <em>Secondaire</em>.
          </div>

          {/* Stats par section */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
            {[
              {sec:"Primaire",n:ensPrimaire.length,col:"#0ea5e9",bg:"#e0f2fe"},
              {sec:"Collège",n:ensCollege.length,col:"#7c3aed",bg:"#f3e8ff"},
              {sec:"Lycée",n:ensLycee.length,col:"#db2777",bg:"#fce7f3"},
            ].map(s=>(
              <div key={s.sec} style={{background:s.bg,borderRadius:10,padding:"12px 14px",textAlign:"center",border:`1px solid ${s.col}33`}}>
                <div style={{fontSize:11,color:s.col,fontWeight:700,marginBottom:4}}>{s.sec}</div>
                <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{s.n}</div>
              </div>
            ))}
          </div>

          {ensTous.length===0?<Vide icone="🎓" msg="Aucun enseignant enregistré"/>
            :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Prénoms et Nom","Section","Matière","Classe titulaire","Statut","Paie",canEdit?"Actions":""]}/>
              <tbody>{ensTous.map(e=>{
                const isPrim=e._section==="Primaire";
                const paie=isPrim?"—":fmtN(e.primeHoraire||0)+" /h";
                const couleurSec=e._section==="Primaire"?"bleu":e._section==="Collège"?"violet":"rose";
                return <TR key={`${e._section}-${e._id}`}>
                  <TD bold>{e.prenom||""} {e.nom||""}</TD>
                  <TD><Badge color={couleurSec}>{e._section}</Badge></TD>
                  <TD>{e.matiere||"—"}</TD>
                  <TD>{e.classeTitle||"—"}</TD>
                  <TD><Badge color={(e.statut||"Titulaire")==="Titulaire"?"vert":"gray"}>{e.statut||"Titulaire"}</Badge></TD>
                  <TD center>{paie}</TD>
                  {canEdit&&<TD center>
                    <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens_compta");}}>✏️ Paie</Btn>
                    <Btn sm v="red" onClick={()=>confirm(`Supprimer ${e.prenom} ${e.nom} ?`)&&supEnsForSection(e._section)(e._id)}>🗑</Btn>
                  </TD>}
                </TR>;
              })}</tbody>
            </table></Card>
          }

          {/* MODAL création / édition paie */}
          {(modal==="add_ens_compta"&&canCreate||(modal==="edit_ens_compta"&&canEdit))&&(()=>{
            const isEdit=modal==="edit_ens_compta";
            const isPrim=(form._section||"Primaire")==="Primaire";
            return <Modale large titre={isEdit?"Modifier la paie":"Nouvel enseignant"} fermer={()=>{setModal(null);setForm({});}}>
              {!isEdit&&<div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:6}}>Section</div>
                <div style={{display:"flex",gap:8}}>
                  {["Primaire","Collège","Lycée"].map(s=>(
                    <button key={s} type="button" onClick={()=>setForm(p=>({...p,_section:s}))}
                      style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${form._section===s?C.blue:"#e2e8f0"}`,background:form._section===s?C.blue:"#fff",color:form._section===s?"#fff":"#475569",cursor:"pointer",fontWeight:700,fontSize:13}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Input label="Nom" value={form.nom||""} onChange={chg("nom")} disabled={isEdit}/>
                <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")} disabled={isEdit}/>
                <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
                <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
                <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
                  <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
                </Selec>
                {isPrim?<>
                  <Input label="Forfait mensuel (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")} placeholder="Ex : 1500000"/>
                  <div style={{gridColumn:"1/-1"}}>
                    <Input label="Classe titulaire (optionnel)" value={form.classeTitle||""} onChange={chg("classeTitle")} placeholder="Ex : 3ème Année A"/>
                  </div>
                </>:<>
                  <Input label="Prime horaire (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")} placeholder="Ex : 15000"/>
                </>}
              </div>
              {!isPrim&&(()=>{
                const sec=form._section||"Collège";
                const classesDispo=sec==="Lycée"?CLASSES_LYCEE:CLASSES_COLLEGE;
                return <div style={{marginTop:14,borderTop:"1px solid #e2e8f0",paddingTop:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:8}}>
                    Primes par classe <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>(si la prime varie selon la classe enseignée — sinon laissez vide)</span>
                  </div>
                  {(form.primeParClasse||[]).map((entry,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                      <select value={entry.classe||""}
                        onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],classe:e.target.value};return{...p,primeParClasse:arr};})}
                        style={{flex:2,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12,background:"#fff"}}>
                        <option value="">— Choisir une classe —</option>
                        {classesDispo.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" value={entry.prime||""} placeholder="Prime GNF"
                        onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],prime:Number(e.target.value)};return{...p,primeParClasse:arr};})}
                        style={{flex:1,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12}}/>
                      <Btn sm v="danger" onClick={()=>setForm(p=>({...p,primeParClasse:(p.primeParClasse||[]).filter((_,j)=>j!==i)}))}>×</Btn>
                    </div>
                  ))}
                  <Btn sm v="ghost" onClick={()=>setForm(p=>({...p,primeParClasse:[...(p.primeParClasse||[]),{classe:"",prime:0}]}))}>+ Ajouter une classe</Btn>
                  <div style={{fontSize:11,color:"#64748b",marginTop:6,fontStyle:"italic"}}>
                    💡 Choisissez parmi les classes officielles — un libellé exact garantit que la prime soit prise en compte lors du calcul du salaire.
                  </div>
                </div>;
              })()}
              <div style={{marginTop:12,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#854d0e"}}>
                {isPrim
                  ? "Le forfait sera repris automatiquement lors de la génération mensuelle des salaires."
                  : "Lors de la génération des salaires : la prime utilisée pour chaque classe enseignée est celle saisie ci-dessus si renseignée, sinon la prime horaire unique. Le total = somme(prime classe × heures EDT de cette classe) × 4 semaines."
                }
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
                <Btn v="ghost" onClick={()=>{setModal(null);setForm({});}}>Annuler</Btn>
                <Btn onClick={saveEns}>Enregistrer</Btn>
              </div>
            </Modale>;
          })()}
        </div>;
      })()}

      {/* ══ ONGLET PERSONNEL ══ */}
      {tab==="personnel"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Registre du Personnel ({personnel.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({statut:"Actif"});setModal("add_p");}}>+ Ajouter un employé</Btn>}
        </div>

        {/* Cartes résumé */}
        {personnel.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
          {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(cat=>{
            const n=personnel.filter(p=>p.categorie===cat).length;
            if(!n) return null;
            return <div key={cat} style={{background:"#f5f3ff",borderRadius:10,padding:"12px 14px",textAlign:"center",border:"1px solid #ddd6fe"}}>
              <div style={{fontSize:11,color:"#7c3aed",fontWeight:700,marginBottom:4}}>{cat}</div>
              <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{n}</div>
            </div>;
          })}
          <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"12px 14px",textAlign:"center",color:"#fff"}}>
            <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Masse mensuelle</div>
            <div style={{fontSize:16,fontWeight:900}}>{(personnel.reduce((s,p)=>s+Number(p.salaireBase||0),0)/1e6).toFixed(3)}M</div>
            <div style={{fontSize:10,opacity:.75}}>GNF</div>
          </div>
        </div>}

        {cPers?<Chargement/>:personnel.length===0?<Vide icone="👥" msg="Aucun employé enregistré"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Prénoms et Nom","Poste","Catégorie","Salaire de base","Statut","Observation",canEdit?"Actions":""]}/>
            <tbody>{personnel.map(p=><TR key={p._id}>
              <TD bold>{p.prenom||""} {p.nom||""}</TD>
              <TD>{p.poste||"—"}</TD>
              <TD><Badge color="purple">{p.categorie||"—"}</Badge></TD>
              <TD center>{fmtN(p.salaireBase||0)}</TD>
              <TD><Badge color={p.statut==="Actif"?"vert":"gray"}>{p.statut||"Actif"}</Badge></TD>
              <TD>{p.observation||"—"}</TD>
              {canEdit&&<TD center>
                <Btn sm v="ghost" onClick={()=>{setForm({...p});setModal("edit_p");}}>✏️</Btn>
                <Btn sm v="red" onClick={()=>confirm("Supprimer cet employé ?")&&supPers(p._id)}>🗑</Btn>
              </TD>}
            </TR>)}
            <tr style={{background:"#ede9fe",fontWeight:800}}>
              <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#7c3aed"}}>TOTAL MASSE MENSUELLE</td>
              <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>
                {fmtN(personnel.filter(p=>(p.statut||"Actif")==="Actif").reduce((s,p)=>s+Number(p.salaireBase||0),0))}
              </td>
              <td colSpan={canEdit?3:2}></td>
            </tr>
            </tbody>
          </table></Card>
        }

        {/* MODAL PERSONNEL */}
        {(modal==="add_p"&&canCreate||(modal==="edit_p"&&canEdit))&&<Modale large titre={modal==="add_p"?"Nouvel employé":"Modifier l'employé"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
            <Input label="Poste" value={form.poste||""} onChange={chg("poste")} placeholder="Ex : Gardien, Secrétaire…"/>
            <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}>
              <option value="">— Catégorie —</option>
              {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(c=><option key={c}>{c}</option>)}
            </Selec>
            <Input label="Salaire mensuel de base (GNF)" type="number" value={form.salaireBase||""} onChange={chg("salaireBase")} placeholder="Ex : 500000"/>
            <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
              <option>Actif</option><option>Inactif</option>
            </Selec>
            <div style={{gridColumn:"1/-1"}}><Input label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
          </div>
          <div style={{marginTop:12,padding:"10px 14px",background:"#f5f3ff",borderRadius:8,fontSize:12,color:"#7c3aed"}}>
            Le salaire de base sera repris automatiquement lors de la génération mensuelle des salaires.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={savePersonnel}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {tab==="fondation"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Versements à la Fondation ({versements.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_v");}}>+ Nouveau versement</Btn>}
        </div>
        {cV?<Chargement/>:versements.length===0?<Vide icone="🏛️" msg="Aucun versement"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Libellé","Description","Montant","Date",canEdit?"Actions":""]}/>
            <tbody>{versements.map(v=><TR key={v._id}>
              <TD bold>{v.libelle}</TD><TD>{v.description}</TD>
              <TD><span style={{color:C.blue,fontWeight:700}}>{fmt(v.montant)}</span></TD><TD>{v.date}</TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...v});setModal("edit_v");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supV(v._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {(modal==="add_v"&&canCreate||(modal==="edit_v"&&canEdit))&&<Modale titre={modal==="add_v"?"Nouveau versement":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Libellé" value={form.libelle||""} onChange={chg("libelle")}/></div>
            <div style={{gridColumn:"1/-1"}}><Input label="Description" value={form.description||""} onChange={chg("description")}/></div>
            <Input label="Montant (GNF)" type="number" value={form.montant||""} onChange={chg("montant")}/>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="vert" onClick={()=>enreg(ajV,modV,{montant:Number(form.montant)})}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ENRÔLEMENT ÉLÈVES (Comptabilité uniquement) ── */}
      {tab==="enrolment"&&<div>
        {/* ── Alerte plan : limite atteinte ── */}
        {planInfo && !planInfo.peutAjouterEleve && (
          <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center"}}>
            <span style={{fontSize:28}}>🔒</span>
            <div style={{flex:1}}>
              <p style={{margin:"0 0 4px",fontWeight:900,fontSize:14,color:"#92400e"}}>
                Limite d'élèves atteinte — Plan {planInfo.planLabel}
              </p>
              <p style={{margin:0,fontSize:12,color:"#78350f"}}>
                Vous avez <strong>{planInfo.totalElevesActifs}</strong> élèves actifs
                sur <strong>{planInfo.eleveLimit === Infinity ? "∞" : planInfo.eleveLimit}</strong> autorisés.
                {planInfo.planCourant==="gratuit"
                  ? " Contactez le Super-Admin pour activer un abonnement et inscrire plus d'élèves."
                  : " Contactez le Super-Admin pour passer à un plan supérieur."}
              </p>
            </div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,flex:1,color:C.blueDark}}>
            {afficherDeparts?"📤 Départs & Statistiques":"Enrôlement des Élèves"}
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
          </select>
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
                  <Btn v="ghost" title="Importer depuis un fichier Excel ou CSV" onClick={()=>{setImportEnrolPreview(null);setModal("import_enrol");}}>📋 Import Excel</Btn>
                </div>
              : <Btn disabled title="Limite du plan atteinte — Contactez le Super-Admin">🔒 Limite atteinte</Btn>
          )}
        </div>
        <div style={{background:"#e0ebf8",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:C.blueDark}}>
          🔒 Seul le <strong>Comptable</strong> peut enrôler ou supprimer des élèves.
        </div>
        {!afficherDeparts&&(
          (cEC||cEL||cEP)?<Chargement/>:elevesEnrol.length===0?<Vide icone="🎓" msg="Aucun élève enregistré"/>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
              <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Filiation","Tuteur","Contact","Domicile","Statut","Actions"]}/>
              <tbody>{elevesEnrol.map(e=><TR key={e._id}>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
                <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
                <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
                <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
                <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
                {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                  <Btn sm v="ghost" onClick={()=>{setForm({...e,niveau:niveauEnrol});setModal("edit_enrol");}}>Modifier</Btn>
                  {canCreate&&planInfo?.peutAjouterEleve&&<Btn sm v="ghost" title="Dupliquer — même tuteur/contact (frère/sœur)" onClick={()=>{
                    const mat=genererMatricule(elevesEnrol,niveauEnrol,schoolInfo);
                    setForm({statut:"Actif",sexe:e.sexe||"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription",
                      classe:e.classe,filiation:e.filiation,tuteur:e.tuteur,contactTuteur:e.contactTuteur,domicile:e.domicile});
                    setModal("add_enrol");
                  }}>👥</Btn>}
                  {e.statut==="Actif"&&<Btn sm v="amber" onClick={()=>{
                    setForm({...e,niveau:niveauEnrol,statut:"Transféré",dateDepart:new Date().toISOString().slice(0,10)});
                    setModal("edit_enrol");
                  }} title="Déclarer un départ">📤</Btn>}
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer définitivement cet élève ?"))supEnrol(e._id);}}>Suppr.</Btn>
                </div></TD>}
              </TR>)}</tbody>
            </table>
          </div>
        )}
        {afficherDeparts&&(()=>{
          const MOTIFS_DEPART = ["Transféré","Exclu","Abandonné","Décédé","Inactif"];
          const partis = elevesEnrol.filter(e=>MOTIFS_DEPART.includes(e.statut));
          const actifs = elevesEnrol.filter(e=>e.statut==="Actif");
          const total  = elevesEnrol.length;
          const tauxRetention = total>0 ? ((actifs.length/total)*100).toFixed(1) : "100";
          const parMotif = MOTIFS_DEPART.map(m=>({motif:m, count:partis.filter(e=>e.statut===m).length})).filter(x=>x.count>0);
          const parClasse = [...new Set(partis.map(e=>e.classe))].filter(Boolean).map(cl=>({
            classe:cl, count:partis.filter(e=>e.classe===cl).length
          })).sort((a,b)=>b.count-a.count);
          return (<>
            {/* ── Stats cards ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
              <Stat label="Élèves actifs" value={actifs.length} bg="#dcfce7" sub={`${tauxRetention}% de rétention`}/>
              <Stat label="Total départs" value={partis.length} bg="#fee2e2" sub="cette année scolaire"/>
              {parMotif.map(x=>(
                <Stat key={x.motif} label={x.motif} value={x.count} bg={
                  x.motif==="Transféré"?"#dbeafe":x.motif==="Exclu"?"#fef9c3":x.motif==="Abandonné"?"#ffe4e6":x.motif==="Décédé"?"#f3f4f6":"#f0fdf4"
                }/>
              ))}
            </div>
            {parClasse.length>0&&<Card style={{marginBottom:14}}>
              <div style={{padding:"12px 16px"}}>
                <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>Départs par classe</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {parClasse.map(x=>(
                    <span key={x.classe} style={{background:"#fee2e2",color:"#b91c1c",fontWeight:800,fontSize:12,padding:"4px 12px",borderRadius:20}}>
                      {x.classe} : {x.count}
                    </span>
                  ))}
                </div>
              </div>
            </Card>}
            {/* ── Liste des partis ── */}
            {partis.length===0?<Vide icone="✅" msg="Aucun départ enregistré pour cette section"/>
            :<div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                <THead cols={["Matricule","Nom & Prénom","Classe","Motif","Date départ","Destination / Détail","Actions"]}/>
                <tbody>{partis.map(e=>(
                  <TR key={e._id}>
                    <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                    <TD bold>{e.nom} {e.prenom}</TD>
                    <TD><Badge color="blue">{e.classe}</Badge></TD>
                    <TD><Badge color={e.statut==="Exclu"?"red":e.statut==="Décédé"?"gray":"amber"}>{e.statut}</Badge></TD>
                    <TD>{e.dateDepart||"—"}</TD>
                    <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||e.motifDepart||"—"}</span></TD>
                    {canEdit&&<TD>
                      <Btn sm v="vert" onClick={async()=>{
                        if(confirm(`Réintégrer ${e.nom} ${e.prenom} comme élève Actif ?`)){
                          await modEnrol({_id:e._id,statut:"Actif",dateDepart:null,motifDepart:null,destinationDepart:null});
                          toast("Élève réintégré","success");
                        }
                      }}>↩ Réintégrer</Btn>
                    </TD>}
                  </TR>
                ))}</tbody>
              </table>
            </div>}
          </>);
        })()}

        {(modal==="add_enrol"&&canCreate||(modal==="edit_enrol"&&canEdit))&&<Modale large titre={modal==="add_enrol"?"Nouvel élève":"Modifier l'élève"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
            <Champ label="Matricule (auto-généré)">
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input value={form.matricule||""} onChange={chg("matricule")}
                  style={{flex:1,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
                <span style={{fontSize:10,color:"#9ca3af",whiteSpace:"nowrap"}}>Modifiable si besoin</span>
              </div>
            </Champ>
            <Champ label="Identifiant National (IEN)">
              <div style={{position:"relative"}}>
                <input value={form.ien||""} onChange={chg("ien")}
                  placeholder="Ex : GN-2024-000123"
                  style={{width:"100%",border:"1.5px solid #c7d2fe",borderRadius:8,padding:"7px 10px 7px 30px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#eef2ff",fontFamily:"monospace",fontWeight:700,color:"#3730a3"}}/>
                <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🪪</span>
              </div>
            </Champ>
            <Champ label="Classe">
              <select value={form.classe||""} onChange={chg("classe")}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
                <option value="">— Sélectionner —</option>
                {getClassesForSection(niveauEnrol).map(c=><option key={c}>{c}</option>)}
              </select>
            </Champ>
            <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
              <option value="M">Masculin</option><option value="F">Féminin</option>
            </Selec>
            <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
              <option>Actif</option><option>Inactif</option><option>Transféré</option><option>Exclu</option><option>Abandonné</option><option>Décédé</option>
            </Selec>
            <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
              <option>Première inscription</option><option>Réinscription</option>
            </Selec>
            {["Transféré","Exclu","Abandonné","Décédé"].includes(form.statut)&&<>
              <Input label="Date de départ" type="date" value={form.dateDepart||""} onChange={chg("dateDepart")}/>
              <div style={{gridColumn:"1/-1"}}>
                <Input label="Motif du départ" value={form.motifDepart||""} onChange={chg("motifDepart")} placeholder="Ex: Transfert vers Lycée Donka, fin d'année..."/>
              </div>
              {form.statut==="Transféré"&&<div style={{gridColumn:"1/-1"}}>
                <Input label="École de destination" value={form.destinationDepart||""} onChange={chg("destinationDepart")} placeholder="Nom de l'école d'accueil"/>
              </div>}
            </>}
            <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")}/></div>
            <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")}/>
            <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")}/>
            <Input label="Domicile Tuteur" value={form.domicile||""} onChange={chg("domicile")}/>
            <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
            <Input label="Lieu de naissance" value={form.lieuNaissance||""} onChange={chg("lieuNaissance")}/>
            {form.typeInscription==="Réinscription"&&
              <Input label="Établissement d'origine (si transféré)" value={form.etablissementOrigine||""} onChange={chg("etablissementOrigine")} placeholder="Nom de l'ancienne école"/>
            }
          </div>
          {/* Photo de l'élève */}
          <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:14}}>
            <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 10px",letterSpacing:"0.07em"}}>📷 Photo de l'élève (optionnel)</p>
            <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              {/* Aperçu */}
              <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",border:`2px solid ${C.blue}`,background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {form.photo
                  ? <img src={form.photo} alt="photo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontSize:32}}>👤</span>}
              </div>
              {/* Boutons */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <Btn v="blue" onClick={()=>setCameraOuverte(true)}>📸 Prendre une photo</Btn>
                <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.blue}`,background:"#fff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  📁 Importer depuis la galerie
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoFichier}/>
                </label>
                {form.photo&&<Btn sm v="danger" onClick={()=>setForm(p=>({...p,photo:""}))}>✕ Supprimer</Btn>}
              </div>
            </div>
          </div>
          {cameraOuverte&&<CameraCapture onCapture={photo=>{setForm(p=>({...p,photo}));setCameraOuverte(false);}} onClose={()=>setCameraOuverte(false)}/>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)} disabled={uploadEnCours}>Annuler</Btn>
            <Btn disabled={uploadEnCours} onClick={async()=>{
              setUploadEnCours(true);
              try{
                let photoUrl = form.photo || "";
                if(photoUrl.startsWith("data:")){
                  photoUrl = await uploadPhotoEleve(photoUrl, schoolId);
                }
                const r={...form, photo:photoUrl, mens:form.mens||initMens()};
                const doublon = findEnrollmentDuplicate(r, tousElevesScolarite, {
                  excludeId: modal==="edit_enrol" ? r._id : null,
                });
                if(doublon){
                  toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
                  return;
                }
                if(modal==="add_enrol") {
                  await ajEnrol(r);
                  await ensureClasse(r.classe, niveauEnrol);
                } else {
                  await modEnrol(r);
                }
                setModal(null);
              }catch(e){
                toast("Erreur upload photo : "+e.message,"error");
              }finally{
                setUploadEnCours(false);
              }
            }}>{uploadEnCours?"⏳ Upload photo...":"Enregistrer"}</Btn>
          </div>
        </Modale>}

        {/* ── SAISIE RAPIDE (fratrie / même tuteur) ── */}
        {modal==="rapide_enrol"&&canCreate&&<Modale titre="⚡ Saisie rapide — Fratrie / même tuteur" fermer={()=>setModal(null)}>
          {/* Section commune — reste figée entre chaque élève */}
          <div style={{background:"#f0f6ff",border:`1.5px solid ${C.blue}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              👨‍👩‍👧‍👦 Informations communes (conservées pour chaque élève)
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")} placeholder="Bah Mamadou"/>
              <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")} placeholder="622 000 000"/>
              <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")} placeholder="Père: … / Mère: …"/></div>
              <div style={{gridColumn:"1/-1"}}><Input label="Domicile" value={form.domicile||""} onChange={chg("domicile")} placeholder="Quartier, commune…"/></div>
            </div>
          </div>
          {/* Section élève — réinitialisée après chaque ajout */}
          <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px"}}>
            <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>
              🎓 Élève à inscrire
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Input label="Nom *" value={form.nom||""} onChange={chg("nom")} placeholder="Bah"/>
              <Input label="Prénom *" value={form.prenom||""} onChange={chg("prenom")} placeholder="Aminata"/>
              <Champ label="Classe *">
                <select value={form.classe||""} onChange={chg("classe")}
                  style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
                  <option value="">— Sélectionner —</option>
              {getClassesForSection(niveauEnrol).map(c=><option key={c}>{c}</option>)}
                </select>
              </Champ>
              <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
                <option value="M">Masculin</option><option value="F">Féminin</option>
              </Selec>
              <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
              <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
                <option>Première inscription</option><option>Réinscription</option>
              </Selec>
              <Champ label="Matricule (auto)">
                <input value={form.matricule||""} onChange={chg("matricule")}
                  style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
              </Champ>
            </div>
          </div>
          {(()=>{
            const sauvegarderRapide = async (fermer) => {
              if(!form.nom||!form.prenom){toast("Nom et prénom obligatoires","warning");return false;}
              if(!form.classe){toast("Classe obligatoire","warning");return false;}
              const r={...form,statut:"Actif",mens:initMens()};
              const doublon = findEnrollmentDuplicate(r, tousElevesScolarite);
              if(doublon){
                toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
                return false;
              }
              await ajEnrol(r);
              await ensureClasse(r.classe, niveauEnrol);
              toast(`${r.prenom} ${r.nom} ajoute(e)`,"success");
              if(!fermer){
                const mat=genererMatricule([...elevesEnrol,r],niveauEnrol,schoolInfo);
                // Conserve tuteur/filiation/domicile, réinitialise les champs élève
                setForm(p=>({tuteur:p.tuteur,contactTuteur:p.contactTuteur,filiation:p.filiation,domicile:p.domicile,
                  statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"}));
              }
              return true;
            };
            return (
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
                <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
                <Btn v="ghost" onClick={async()=>{ await sauvegarderRapide(false); }}>➕ Élève suivant</Btn>
                <Btn onClick={async()=>{ if(await sauvegarderRapide(true)) setModal(null); }}>✅ Terminer</Btn>
              </div>
            );
          })()}
        </Modale>}

        {/* ── IMPORT EXCEL (adaptatif) ── */}
        {modal==="import_enrol"&&canCreate&&<Modale titre="📋 Importer des élèves depuis Excel" fermer={()=>{setModal(null);setImportEnrolPreview(null);}} large>
          <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,fontSize:12,color:"#0369a1"}}>
            <strong>📌 Détection automatique des colonnes</strong> — Peu importe l'ordre ou le nom exact des colonnes dans votre fichier, le système les reconnaît automatiquement.<br/>
            Seuls <strong>Nom</strong>, <strong>Prénom</strong> et <strong>Classe</strong> sont obligatoires. Tous les autres champs sont optionnels.
          </div>
          <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
            <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px dashed ${C.blue}`,background:"#f0f6ff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              📂 Choisir un fichier Excel / CSV
              <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={async e=>{
                const file=e.target.files[0]; if(!file) return;
                const ab=await file.arrayBuffer();
                const XLSX = await loadXLSX();
                const wb=XLSX.read(ab,{cellDates:true});
                const ws=wb.Sheets[wb.SheetNames[0]];
                const allRows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
                if(allRows.length<2){toast("Fichier vide ou sans données","warning");return;}

                const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g," ").trim();

                // ── Auto-détection de la ligne d'en-tête ──────────────────
                // Certains fichiers ont un titre fusionné en ligne 1 (ex: "LISTE DES ÉLÈVES - 4ème A")
                // On cherche parmi les 5 premières lignes celle qui ressemble le plus à des en-têtes
                const HDR_KW=["nom","prenom","eleve","classe","sexe","date","lieu","pere","mere","telephone","matricule","naissance","contact","n°","numero"];
                const scoreHdr=row=>row.reduce((s,c)=>{
                  const hn=norm(String(c||""));
                  return s+(HDR_KW.some(k=>hn===k||hn.startsWith(k+' ')||hn.endsWith(' '+k)||(' '+hn+' ').includes(' '+k+' '))?1:0);
                },0);
                let headerRowIdx=0, bestScore=scoreHdr(allRows[0]);
                for(let ri=1;ri<Math.min(5,allRows.length-1);ri++){
                  const sc=scoreHdr(allRows[ri]);
                  if(sc>bestScore){bestScore=sc;headerRowIdx=ri;}
                }

                // ── Détection des colonnes par leur en-tête ──────────────
                const headers=allRows[headerRowIdx].map(h=>String(h||""));

                // Correspondance par mots entiers (avec pluriel toléré)
                // Ex: "nom" matche "Noms", "Noms et Prénoms" ; "prenom" matche "Prénoms"
                // Mais "nom" ne matche PAS "Prénom" (mot différent)
                const wordMatch=(hn,v)=>{
                  if(hn===v) return true;
                  const hnW=hn.split(/\s+/), vW=v.split(/\s+/);
                  return vW.every(vw=>hnW.some(hw=>{
                    if(hw===vw) return true;
                    // startsWith toléré pour gérer pluriels (nom→noms, prenom→prenoms)
                    // seulement pour mots de 3+ caractères (évite que "n" matche "no", "ne", etc.)
                    if(hw.length>=3&&vw.length>=3&&(hw.startsWith(vw)||vw.startsWith(hw))) return true;
                    return false;
                  }));
                };
                const findCol=(variants)=>{
                  for(const v of variants){
                    const idx=headers.findIndex(h=>{
                      const hn=norm(h);
                      return hn&&wordMatch(hn,v);
                    });
                    if(idx>=0) return idx;
                  }
                  return -1;
                };
                const cols={
                  num:       findCol(["n","no","num","numero"]),
                  matricule: findCol(["matricule","mat","numero eleve","id eleve"]),
                  eleveComplet: findCol(["eleve","noms et prenoms","nom et prenom","nom complet","prenom et nom","nomcomplet","nom prenom","full name"]),
                  nom:       findCol(["nom eleve","nom de l eleve","nom famille","last name","surname","noms","nom"]),
                  prenom:    findCol(["prenom eleve","prenom de l eleve","prenoms","first name","given name","forename","prenom"]),
                  classe:    findCol(["classe","class","niveau","section","group"]),
                  sexe:      findCol(["sexe","genre","sex","gender","masculin","feminin"]),
                  date:      findCol(["date naissance","date de naissance","date naiss","ne le","dob","birth"]),
                  lieuNaiss: findCol(["lieu naissance","lieu de naissance","lieu naiss","ville naissance","birthplace","born in","ne a"]),
                  pere:      findCol(["pere","father","papa","nom pere"]),
                  mere:      findCol(["mere","mother","maman","nom mere"]),
                  filiation: findCol(["pere et mere","filiation","parents","famille"]),
                  tuteur:    findCol(["tuteur","responsable","gardien","tuteur legal"]),
                  contact:   findCol(["telephone","tel","phone","mobile","gsm","numero telephone","contact"]),
                  domicile:  findCol(["domicile","adresse","quartier","residence","localite"]),
                  typeInsc:  findCol(["type inscription","type inscript","reinscription","premiere inscription"]),
                  ien:       findCol(["ien","identifiant national","id national","matricule national","identifiant"]),
                };
                // Si nom et prénom pointent sur la même colonne → colonne combinée (ex: "Noms et Prénoms")
                if(cols.nom>=0&&cols.nom===cols.prenom){
                  if(cols.eleveComplet<0) cols.eleveComplet=cols.nom;
                  cols.nom=-1; cols.prenom=-1;
                }

                // ── Normaliser une date quelle que soit son format ────────
                const parseDate=val=>{
                  if(!val) return "";
                  const s=String(val).trim();
                  // AAAA-MM-JJ (déjà bon)
                  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                  // JJ/MM/AAAA ou JJ-MM-AAAA
                  const m1=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
                  if(m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
                  // MM/JJ/AAAA (anglais)
                  const m2=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                  if(m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
                  return s;
                };

                const get=(row,idx)=>idx>=0?String(row[idx]||"").trim():"";
                // Classes connues pour avertissement (pas bloquant)
                const classesConnues=[...CLASSES_COLLEGE,...CLASSES_PRIMAIRE,...CLASSES_LYCEE].map(c=>c.toLowerCase());
                // Classes déjà utilisées dans l'école (acceptées sans avertissement)
                const classesEcole=[...new Set(tousElevesScolarite.map(e=>e.classe||"").filter(Boolean))].map(c=>c.toLowerCase());

                const rows=allRows.slice(headerRowIdx+1).filter(r=>r.some(c=>String(c||"").trim()));
                const lignes=[];
                const candidatsImport=[];
                for(const [i, r] of rows.entries()){
                  let nom=get(r,cols.nom);
                  let prenom=get(r,cols.prenom);
                  if((!nom||!prenom) && cols.eleveComplet>=0){
                    const complet=get(r,cols.eleveComplet);
                    if(complet){
                      const parts=complet.trim().split(/\s+/);
                      const premier=parts[0]||"";
                      const premierEstMaj=premier.length>1&&premier===premier.toUpperCase()&&/[A-Z]/.test(premier);
                      const nomEnPremier = ordreNomImport==="nom_prenom"
                        || (ordreNomImport==="auto" && premierEstMaj);
                      if(nomEnPremier){
                        if(!nom) nom=parts[0]||"";
                        if(!prenom) prenom=parts.slice(1).join(" ")||"";
                      } else {
                        if(!nom) nom=parts[parts.length-1]||"";
                        if(!prenom) prenom=parts.slice(0,-1).join(" ")||"";
                      }
                    }
                  }
                  const classe=get(r,cols.classe)||classeDefautImport;
                  const sexeRaw=get(r,cols.sexe).toUpperCase();
                  const sexe=sexeRaw==="F"||sexeRaw.startsWith("F")?"F":"M";
                  const dateNaissance=parseDate(get(r,cols.date));
                  const lieuNaissance=get(r,cols.lieuNaiss);
                  const pereVal=get(r,cols.pere);
                  const mereVal=get(r,cols.mere);
                  const filiation=pereVal||mereVal
                    ? [pereVal?"Pere: "+pereVal:"", mereVal?"Mere: "+mereVal:""] .filter(Boolean).join(" / ")
                    : get(r,cols.filiation);
                  const tuteur=get(r,cols.tuteur)||pereVal||mereVal;
                  const contactTuteur=get(r,cols.contact);
                  const domicile=get(r,cols.domicile);
                  const ti=get(r,cols.typeInsc);
                  const typeInscription=ti||"Premiere inscription";
                  const matriculeFichier=get(r,cols.matricule);
                  const ien=get(r,cols.ien)||(cols.ien<0?matriculeFichier:"");
                  const ligneCandidate={nom,prenom,classe,sexe,dateNaissance,lieuNaissance,ien,tuteur,contactTuteur,filiation,domicile,typeInscription};
                  const erreurs=[];
                  const avertissements=[];
                  if(!nom) erreurs.push("Nom manquant");
                  if(!prenom) erreurs.push("Prenom manquant");
                  if(!classe) avertissements.push("Classe non definie - selectionner une classe par defaut");
                  else if(!classesEcole.includes(classe.toLowerCase())&&!classesConnues.includes(classe.toLowerCase())){
                    avertissements.push(`Classe "${classe}" non reconnue`);
                  }
                  if(!erreurs.length){
                    const doublonExistant = findEnrollmentDuplicate(ligneCandidate, tousElevesScolarite);
                    if(doublonExistant){
                      erreurs.push(getEnrollmentDuplicateMessage(doublonExistant, ligneCandidate, { scope: "deja dans l'ecole" }));
                    } else {
                      const doublonImport = findEnrollmentDuplicate(ligneCandidate, candidatsImport);
                      if(doublonImport){
                        erreurs.push(getEnrollmentDuplicateMessage(doublonImport, ligneCandidate, { scope: "deja dans ce fichier" }));
                      } else {
                        candidatsImport.push(ligneCandidate);
                      }
                    }
                  }
                  lignes.push({
                    ...ligneCandidate,
                    erreurs,
                    avertissements,
                    ligne:i+2,
                  });
                }

                const champLabels={num:"N°(ignoré)",matricule:"Matricule→IEN",eleveComplet:"Élève",nom:"Nom",prenom:"Prénom",classe:"Classe",sexe:"Sexe",date:"Date naissance",lieuNaiss:"Lieu naissance",pere:"Père",mere:"Mère",filiation:"Père et Mère (combiné)",tuteur:"Tuteur",contact:"Téléphone",domicile:"Domicile",typeInsc:"Type inscription",ien:"IEN"};
                const mapping=Object.entries(cols).map(([k,idx])=>({champ:champLabels[k],colonne:idx>=0?headers[idx]:null,idx}));

                setImportEnrolPreview({lignes,valides:lignes.filter(l=>!l.erreurs.length),mapping,nbAvert:lignes.filter(l=>!l.erreurs.length&&l.avertissements?.length).length});
                e.target.value="";
              }}/>
            </label>
            <Btn v="ghost" onClick={async()=>{
              const XLSX = await loadXLSX();
              const wb=XLSX.utils.book_new();
              const ws=XLSX.utils.aoa_to_sheet([
                ["N°","Matricule","Élève","Sexe","Date de naissance","Lieu de naissance","Père","Mère","Téléphone"],
                [1,"","BAH Aminata","F","2012-03-15","Conakry","Mamadou Bah","Fatoumata Diallo","622000001"],
                [2,"","DIALLO Ibrahima Sékou","M","2013-07-22","Kindia","Boubacar Diallo","Mariama Bah","628000002"],
              ]);
              XLSX.utils.book_append_sheet(wb,ws,"Eleves");
              await telechargerExcel(wb,"modele_import_eleves.xlsx");
            }}>⬇️ Modèle Excel</Btn>
          </div>

          {/* Sélecteur classe par défaut (quand pas de colonne Classe dans le fichier) */}
          <div style={{marginBottom:8,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde047",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>📚 Classe à affecter</span>
            <span style={{fontSize:12,color:"#713f12",flex:1}}>Si votre fichier n'a pas de colonne Classe, sélectionnez-en une ici.</span>
            <select value={classeDefautImport} onChange={e=>setClasseDefautImport(e.target.value)}
              style={{border:"1.5px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",fontWeight:700,color:"#0A1628"}}>
              <option value="">— Classe du fichier —</option>
              {getClassesForSection(niveauEnrol).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Ordre Nom / Prénom dans la colonne nom complet */}
          <div style={{marginBottom:12,padding:"10px 14px",background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:"#5b21b6"}}>🔤 Ordre du nom complet</span>
            <span style={{fontSize:12,color:"#6d28d9",flex:1}}>Quand le nom et le prénom sont dans une seule colonne, dans quel ordre ?</span>
            {[
              {val:"nom_prenom", label:"NOM Prénom",  ex:"DIALLO Mamadou"},
              {val:"prenom_nom", label:"Prénom NOM",  ex:"Mamadou DIALLO"},
              {val:"auto",       label:"Auto-detect", ex:"Majuscules = NOM"},
            ].map(({val,label,ex})=>(
              <label key={val} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,fontWeight:ordreNomImport===val?700:400}}>
                <input type="radio" name="ordreNom" value={val} checked={ordreNomImport===val} onChange={()=>setOrdreNomImport(val)}/>
                <span>{label}</span>
                <span style={{color:"#7c3aed",fontSize:11,fontStyle:"italic"}}>({ex})</span>
              </label>
            ))}
          </div>

          {importEnrolPreview&&<>
            {/* Mapping détecté */}
            <div style={{marginBottom:12,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#f8fafc",padding:"8px 14px",fontSize:11,fontWeight:800,color:"#475569",borderBottom:"1px solid #e2e8f0"}}>
                🗺️ Colonnes détectées dans votre fichier
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 14px"}}>
                {importEnrolPreview.mapping.map(({champ,colonne})=>(
                  <span key={champ} style={{
                    padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                    background:colonne?"#dcfce7":"#fef9c3",
                    color:colonne?"#15803d":"#92400e",
                    border:`1px solid ${colonne?"#86efac":"#fde68a"}`
                  }}>
                    {champ} {colonne?`→ "${colonne}"` :"— non trouvé"}
                  </span>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:14,marginBottom:10,fontSize:12,flexWrap:"wrap"}}>
              <span style={{color:"#059669",fontWeight:700}}>✅ {importEnrolPreview.valides.length} prêts à importer</span>
              {importEnrolPreview.nbAvert>0&&<span style={{color:"#d97706",fontWeight:700}}>⚠️ {importEnrolPreview.nbAvert} avec avertissement</span>}
              <span style={{color:"#dc2626",fontWeight:700}}>❌ {importEnrolPreview.lignes.length-importEnrolPreview.valides.length} bloqués (champs obligatoires manquants)</span>
            </div>
            <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8,marginBottom:12}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                  {["L.","Nom","Prénom","Classe","Sexe","Date naiss.","Tuteur","Statut"].map(h=>(
                    <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>{h}</th>
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
          </>}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <Btn v="ghost" onClick={()=>{setModal(null);setImportEnrolPreview(null);}}>Annuler</Btn>
            {importEnrolPreview?.valides.length>0&&<Btn v="vert" disabled={importEnrolEnCours} onClick={async()=>{
              setImportEnrolEnCours(true);
              let count=0;
              const existants=tousElevesScolarite;
              const matsGeneres=[];
              const classesImportCreees=new Set();
              const ajFn=ajoutParNiveau[niveauEnrol] || ajEC;
              const lotImporte=[];
              for(const l of importEnrolPreview.valides){
                const doublon = findEnrollmentDuplicate(l, [...existants, ...lotImporte]);
                if(doublon) continue;
                const mat=genererMatricule([...elevesEnrol,...matsGeneres],niveauEnrol,schoolInfo);
                const eleveAImporter={
                  nom:l.nom,prenom:l.prenom,classe:l.classe,sexe:l.sexe,
                  dateNaissance:l.dateNaissance,lieuNaissance:l.lieuNaissance,ien:l.ien,
                  tuteur:l.tuteur,contactTuteur:l.contactTuteur,
                  filiation:l.filiation,domicile:l.domicile,
                  typeInscription:l.typeInscription,
                  matricule:mat,statut:"Actif",mens:initMens(),
                };
                matsGeneres.push({matricule:mat});
                await ajFn(eleveAImporter);
                lotImporte.push(eleveAImporter);
                await ensureClasse(l.classe, niveauEnrol, classesImportCreees);
                count++;
              }
              setImportEnrolEnCours(false);
              setModal(null);
              setImportEnrolPreview(null);
              toast(`${count} élève(s) importé(s) avec succès`,"success");
            }}>
              {importEnrolEnCours?`⏳ Import en cours…`:`⬆️ Importer ${importEnrolPreview.valides.length} élève(s)`}
            </Btn>}
          </div>
        </Modale>}
      </div>}

      {tab==="mens"&&<div>
        {/* ── Tarifs par classe ── */}
        <TarifsClasses
          tarifsClasses={tarifsClasses}
          saveTarif={saveTarif}
          getTarifBase={getTarifBase}
          getTarifRevision={getTarifRevision}
          getTarifAutre={getTarifAutre}
          getTarifIns={getTarifIns}
          getTarifReinsc={getTarifReinsc}
          canEdit={canEditEleves}
        />

        {(()=>{
          const elevesCritiques=eleves.filter(e=>{
            const mens=e.mens||{};
            const impayesConsec=moisAnnee.slice().reverse().findIndex(m=>mens[m]==="Payé");
            const nbImp=impayesConsec===-1?moisAnnee.length:impayesConsec;
            return nbImp>=3;
          });
          return elevesCritiques.length>0?(
            <div style={{background:"#fce8e8",border:"1px solid #f5c1c1",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>🚨</span>
                <strong style={{fontSize:13,color:"#9b2020"}}>Alertes mensualités — {elevesCritiques.length} élève(s) avec 3 mois ou plus impayés</strong>
                <Btn sm v="ghost" style={{marginLeft:"auto"}} onClick={()=>exportExcel(
                  "Alertes_Mensualites",
                  ["Matricule","Nom","Prénom","Classe","Niveau","Mois impayés","Tuteur","Contact"],
                  elevesCritiques.map(e=>{
                    const mens=e.mens||{};
                    const niv=getSectionLabelForClasse(e.classe);
                    const nbImp=moisAnnee.filter(m=>mens[m]!=="Payé").length;
  return [e.matricule||"",e.nom,e.prenom,e.classe,niv,nbImp,e.tuteur||"",e.contactTuteur||""];
                  })
                )}>📥 Exporter</Btn>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {elevesCritiques.map(e=>{
                  const mens=e.mens||{};
                  const nbImp=moisAnnee.filter(m=>mens[m]!=="Payé").length;
                  return <div key={e._id} style={{background:"#fff",border:"1px solid #f5c1c1",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                    <span style={{fontWeight:800,color:"#9b2020"}}>{e.nom} {e.prenom}</span>
                    <span style={{color:"#6b7280"}}> · {e.classe} · </span>
                    <Badge color="red">{nbImp} impayés</Badge>
                  </div>;
                })}
              </div>
            </div>
          ):null;
        })()}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,flex:1,color:C.blueDark}}>Mensualités — {annee||getAnnee()}</strong>
          <select value={niveau} onChange={e=>{setNiveau(e.target.value);setFiltClasse("all");}}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
            <option value="college">Collège</option>
            <option value="lycee">Lycée</option>
            <option value="primaire">Primaire</option>
          </select>
          {classesU.length>0&&<select value={filtClasse} onChange={e=>setFiltClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
            <option value="all">Toutes les classes</option>
            {classesU.map(c=><option key={c}>{c}</option>)}
          </select>}
        </div>
          {eleves.length===0?<Vide icone="🎓" msg="Aucun élève"/>
            :<>
              <div style={{marginBottom:12,padding:"9px 14px",background:"#e0ebf8",borderRadius:8,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.greenDk,fontWeight:700}}>✓ {elevesFiltres.reduce((s,e)=>s+nbPayes(e),0)} payés</span>
                <span style={{fontSize:12,color:"#b91c1c",fontWeight:700}}>✗ {elevesFiltres.reduce((s,e)=>s+(moisAnnee.length-nbPayes(e)),0)} impayés</span>
                <span style={{fontSize:12,color:C.blue,fontWeight:700}}>💰 {fmt(elevesFiltres.reduce((s,e)=>s+nbPayes(e)*getTarif(e.classe),0))}</span>
                <Badge color="purple">{fmt(elevesFiltres.reduce((s,e)=>s+(e.inscriptionPayee?getTarifInscriptionForEleve(e):0),0))} inscriptions perçues</Badge>
                <Badge color="gray">{fmt(elevesFiltres.reduce((s,e)=>s+(e.autrePayee?getTarifAutre(e.classe):0),0))} autres frais perçus</Badge>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:1080}}>
                  <THead cols={["Matricule","Nom & Prénom","Classe","Tuteur","Contact",...moisAnnee,"Payés","Ins.","Autre","Reçu"]}/>
                  <tbody>{elevesFiltres.map(e=>{
                    const mens=e.mens||initMens();
                    const montantInscription = getTarifInscriptionForEleve(e);
                    const montantAutre = getTarifAutre(e.classe);
                    return <TR key={e._id}>
                      <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 6px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                      <TD bold>{e.nom} {e.prenom}</TD>
                      <TD><Badge color="blue">{e.classe}</Badge></TD>
                      <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
                      {moisAnnee.map(m=>{
                        const paye=mens[m]==="Payé";
                        const datePaie=(e.mensDates||{})[m]||"";
                        const peutCliquer=paye?(canCreate&&canEdit):canCreate;
                        return <td key={m} style={{padding:"4px 2px",textAlign:"center"}}>
                          <button onClick={()=>peutCliquer&&toggleMens(e._id,m,mens,e.mensDates||{},`${e.nom} ${e.prenom}`)}
                            title={`${m} — ${mens[m]||"Impayé"}${datePaie?" ("+datePaie+")":""}`}
                            style={{width:26,height:26,borderRadius:5,border:"none",cursor:peutCliquer?"pointer":"default",fontSize:12,
                              background:paye?C.green:"#e8f0e8",color:paye?"#fff":"#9ca3af",fontWeight:700,opacity:(readOnly||(!peutCliquer&&!paye))?0.6:1}}>
                            {paye?"✓":"·"}
                          </button>
                        </td>;
                      })}
                      <td style={{padding:"4px 8px",textAlign:"center"}}>
                        <span style={{fontWeight:800,fontSize:13,color:nbPayes(e)===moisAnnee.length?C.greenDk:nbPayes(e)>0?"#d97706":"#b91c1c"}}>
                          {nbPayes(e)}/{moisAnnee.length}
                        </span>
                      </td>
                      <td style={{padding:"4px 4px",textAlign:"center"}}>
                        <button onClick={()=>toggleFraisAnnexe(e._id,{
                          payKey:"inscriptionPayee",
                          dateKey:"inscriptionDate",
                          valeurActuelle:e.inscriptionPayee,
                          label:e.typeInscription==="Réinscription"?"Réinscription":"Inscription",
                          montant:montantInscription,
                          nomEleve:`${e.nom} ${e.prenom}`,
                        })} title={`${e.typeInscription==="Réinscription"?"Réinscription":"Inscription"}${e.inscriptionDate?` (${e.inscriptionDate})`:""}`}
                          style={{width:26,height:26,borderRadius:5,border:"none",cursor:readOnly?"default":"pointer",fontSize:11,
                            background:e.inscriptionPayee?C.blue:"#f1f3f4",color:e.inscriptionPayee?"#fff":"#9ca3af",fontWeight:700}}>
                          {e.inscriptionPayee?"✓":"I"}
                        </button>
                      </td>
                      <td style={{padding:"4px 4px",textAlign:"center"}}>
                        <button onClick={()=>toggleFraisAnnexe(e._id,{
                          payKey:"autrePayee",
                          dateKey:"autreDate",
                          valeurActuelle:e.autrePayee,
                          label:"Autre frais",
                          montant:montantAutre,
                          nomEleve:`${e.nom} ${e.prenom}`,
                        })} title={`Autre frais${e.autreDate?` (${e.autreDate})`:""}`}
                          style={{width:26,height:26,borderRadius:5,border:"none",cursor:readOnly?"default":"pointer",fontSize:11,
                            background:e.autrePayee?"#475569":"#f1f3f4",color:e.autrePayee?"#fff":"#9ca3af",fontWeight:700}}>
                          {e.autrePayee?"✓":"A"}
                        </button>
                      </td>
                      <td style={{padding:"4px 6px",textAlign:"center"}}>
                        <Btn sm v="amber" onClick={()=>imprimerRecu(e,getTarif(e.classe),schoolInfo,moisAnnee,{
                          inscription: montantInscription,
                          autre: montantAutre,
                        })}>🖨️</Btn>
                      </td>
                    </TR>;
                  })}</tbody>
                </table>
              </div>
            </>}
      </div>}

      {tab==="transferts"&&<TransfertsPanel userRole={userRole} annee={annee} setTab={setTab}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODULE ÉCOLE — avec Discipline + Bulletins
// ══════════════════════════════════════════════════════════════

export { Comptabilite };
