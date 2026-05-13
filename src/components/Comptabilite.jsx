import React, { useContext, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { doc, updateDoc } from "firebase/firestore";
import {
  C,
  getAnnee,
  today,
  CLASSES_PRIMAIRE,
  CLASSES_COLLEGE,
  CLASSES_LYCEE,
  initMens,
  fmt,
  fmtN,
  peutModifierEleves,
  peutModifier,
} from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { db } from "../firebaseDb";
import { Badge, Card, Modale, Champ, Input, Selec, Btn, THead, TR, TD, Stat, Tabs, Vide, Chargement, LectureSeule } from "./ui";
import { enteteDoc, PRINT_RESET } from "../reports";
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
import { getTeacherMonthlyForfait } from "../teacher-utils";
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
  buildPersonnelSalaryRecord,
  buildPrimarySalaryRecord,
  buildSecondarySalaryRecord,
  getFifthWeekDays,
  getForfaitNet,
  getMissingSalaryProfiles,
  getSalaryExecutionHours,
  getSalaryMontantBrut,
  getSalaryNet,
  mergeSalaryWithManualFields,
  summarizeSalaryTotals,
} from "../salary-utils";

function Comptabilite({readOnly, annee, userRole, verrouOuvert=false}) {
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
    if(modal.startsWith("add"))aj({...r,annee:annee||anneeConsultee});else mod(r);
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
  const impaye = mensualiteOverview.totalDu - mensualiteOverview.totalPercu;
  const pctImpaye = mensualiteOverview.totalDu > 0
    ? ((impaye / mensualiteOverview.totalDu) * 100).toFixed(1)
    : 0;

  const genererPourMois = async (mois, {resync=false}={}) => {
    const jours5eme = getFifthWeekDays(mois);
    const dejaCeMois = salaires.filter(s=>s.mois===mois);
    const trouverExistant = (nom) => dejaCeMois.find(s=>(s.nom||"").toLowerCase().trim()===nom.toLowerCase().trim());
    let nbCree = 0, nbResync = 0;

    const tousEns=[
      ...ensCollege.map(e=>({...e,_emplois:emploisCollege,_eng:engCollege})),
      ...ensLycee.map(e=>({...e,_emplois:emploisLycee,_eng:engLycee})),
    ];
    for(const ens of tousEns){
      const salaireCalcule = buildSecondarySalaryRecord(ens, {
        mois,
        emplois: ens._emplois,
        enseignements: ens._eng,
        jours5eme,
        primeDefaut,
      });
      if(!salaireCalcule) continue;
      const nomComplet=salaireCalcule.nom;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      if(existant){
        await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
        nbResync++;
      } else {
        await ajS({...salaireCalcule,bon:0,revision:0,annee:annee||anneeConsultee});
        nbCree++;
      }
    }

    for(const ens of ensPrimaire){
      const salaireCalcule = buildPrimarySalaryRecord(ens, {
        mois,
        getTeacherMonthlyForfait,
      });
      if(!salaireCalcule) continue;
      const nomComplet=salaireCalcule.nom;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      if(existant){
        await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
        nbResync++;
      } else {
        await ajS({...salaireCalcule,bon:0,revision:0,annee:annee||anneeConsultee});
        nbCree++;
      }
    }

    for(const emp of personnel.filter(e=>(e.statut||"Actif")==="Actif")){
      const salaireCalcule = buildPersonnelSalaryRecord(emp, { mois });
      if(!salaireCalcule) continue;
      const nomComplet=salaireCalcule.nom;
      const existant=trouverExistant(nomComplet);
      if(existant && !resync) continue;
      if(existant){
        await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
        nbResync++;
      } else {
        await ajS({...salaireCalcule,bon:0,revision:0,annee:annee||anneeConsultee});
        nbCree++;
      }
    }
    return {nbCree, nbResync};
  };

  const verifierFichesPaie = () => {
    return getMissingSalaryProfiles({
      ensCollege,
      ensLycee,
      ensPrimaire,
      personnel,
      primeDefaut,
    });
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
    const jours5eme = getFifthWeekDays(moisSel);
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

    const c1 = schoolInfo?.couleur1 || "#0A1628";

    // Couleurs par section (palette cohérente, lisible aussi à l'impression couleur)
    const SEC_COLORS = {
      secondaire: { primary: "#1D4ED8", soft: "#DBEAFE", line: "#BFDBFE" },  // bleu royal
      primaire:   { primary: "#15803D", soft: "#DCFCE7", line: "#BBF7D0" },  // vert
      personnel:  { primary: "#B45309", soft: "#FEF3C7", line: "#FDE68A" },  // ambre
    };

    const totRevSec  = salairesSec.reduce((sum,s)=>sum+Number(s.revision||0),0);
    const totRevPrim = salairesPrim.reduce((sum,s)=>sum+Number(s.revision||0),0);
    const totRevPers = salairesPers.reduce((sum,s)=>sum+Number(s.revision||0),0);

    const sectionHeader = (label, color, count) => `
      <div class="section-header" style="border-left:5px solid ${color.primary};background:linear-gradient(90deg, ${color.soft} 0%, transparent 100%);padding:9px 14px;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center;border-radius:0 6px 6px 0">
        <div style="font-size:12px;font-weight:900;color:${color.primary};letter-spacing:0.06em;text-transform:uppercase">${label}</div>
        <div style="font-size:10px;color:${color.primary};font-weight:700">${count} ${count > 1 ? "personnes" : "personne"}</div>
      </div>`;

    const tableHead = (cols, color) => `
      <thead><tr>${cols.map((c, i) => `<th style="background:linear-gradient(180deg, ${color.primary} 0%, ${color.primary}dd 100%);color:#fff;padding:7px 6px;font-size:9.5px;text-align:${i===1?"left":"center"};border:1px solid ${color.primary};font-weight:800;letter-spacing:0.02em">${c}</th>`).join("")}</tr></thead>`;

    const totalRow = (label, color, montant, bon, rev, net, colspan) => `
      <tr class="total-row">
        <td colspan="${colspan}" style="background:${color.soft};color:${color.primary};font-weight:900;text-align:right;padding:8px 10px;font-size:11px;letter-spacing:0.04em">${label}</td>
        <td style="background:#DBEAFE;color:#1D4ED8;font-weight:900;text-align:center;padding:8px;font-size:11px">${fmtN(montant)}</td>
        <td style="background:#FEE2E2;color:#B91C1C;font-weight:800;text-align:center;padding:8px;font-size:11px">${bon ? "-"+fmtN(bon) : "0"}</td>
        <td style="background:#FEF3C7;color:#B45309;font-weight:800;text-align:center;padding:8px;font-size:11px">${rev ? "+"+fmtN(rev) : "0"}</td>
        <td style="background:#DCFCE7;color:#166534;font-weight:900;text-align:center;padding:8px;font-size:12px">${fmtN(net)}</td>
      </tr>`;

    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>États de Salaires — ${moisSel} ${anneeConsultee}</title>
    <style>
      ${PRINT_RESET}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
      body{font-family:'Inter',Arial,sans-serif;padding:12mm 10mm;font-size:11px;margin:0;color:#1f2937;background:#fff}
      .titre-wrap{text-align:center;margin:6px 0 18px;padding:14px 12px;border-radius:10px;background:linear-gradient(135deg, ${c1} 0%, ${c1}dd 100%);color:#fff}
      .titre-wrap .titre{font-size:16px;font-weight:900;letter-spacing:0.04em}
      .titre-wrap .sous-titre{font-size:11px;opacity:0.9;margin-top:3px;font-weight:600;letter-spacing:0.06em}
      .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}
      .stat-card{padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff}
      .stat-card .lib{font-size:9px;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;color:#6b7280;margin-bottom:3px}
      .stat-card .val{font-size:14px;font-weight:900}
      .stat-card.brut{border-top:3px solid #1D4ED8} .stat-card.brut .val{color:#1D4ED8}
      .stat-card.bons{border-top:3px solid #B91C1C} .stat-card.bons .val{color:#B91C1C}
      .stat-card.rev{border-top:3px solid #B45309} .stat-card.rev .val{color:#B45309}
      .stat-card.net{border-top:3px solid #166534;background:linear-gradient(180deg, #DCFCE7 0%, #fff 100%)} .stat-card.net .val{color:#166534;font-size:15px}
      table{width:100%;border-collapse:collapse;margin:0 0 12px}
      td{padding:5px 6px;border:1px solid #e5e7eb;font-size:10.5px;vertical-align:middle}
      tbody tr:nth-child(odd) td{background:#fafbfc}
      tbody tr:hover td{background:#f1f5f9}
      td.left{text-align:left;font-weight:600;color:#0f172a}
      td.right{text-align:right;font-variant-numeric:tabular-nums}
      td.center{text-align:center}
      td.net{font-weight:900;color:#166534;background:#F0FDF4;font-variant-numeric:tabular-nums}
      td.bon-val{color:#B91C1C;font-weight:600;font-variant-numeric:tabular-nums}
      td.rev-val{color:#B45309;font-weight:600;font-variant-numeric:tabular-nums}
      .global-totaux{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding-top:14px;border-top:2px dashed #cbd5e1}
      .global-total{border-radius:10px;padding:14px 16px;color:#fff;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08)}
      .global-total .lib{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;margin-bottom:5px;font-weight:700}
      .global-total .val{font-size:18px;font-weight:900;letter-spacing:0.02em}
      .global-total.montant{background:linear-gradient(135deg,#1E40AF,#1D4ED8)}
      .global-total.bon{background:linear-gradient(135deg,#991B1B,#B91C1C)}
      .global-total.net{background:linear-gradient(135deg,#15803D,#166534)}
      .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:32px;page-break-inside:avoid}
      .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#475569;font-weight:600}
      .footer-note{text-align:center;margin-top:14px;font-size:9px;color:#94a3b8;font-style:italic}
    </style></head><body>
      ${enteteDoc(schoolInfo, schoolInfo?.logo)}
      <div class="titre-wrap">
        <div class="titre">ÉTATS DE SALAIRES</div>
        <div class="sous-titre">MOIS DE ${moisSel.toUpperCase()} — ANNÉE SCOLAIRE ${anneeConsultee}</div>
      </div>

      <div class="stats-row">
        <div class="stat-card brut"><div class="lib">Total brut</div><div class="val">${fmtN(totMontantGlobal)}</div></div>
        <div class="stat-card bons"><div class="lib">Total bons</div><div class="val">-${fmtN(totBonGlobal)}</div></div>
        <div class="stat-card rev"><div class="lib">Total révisions</div><div class="val">+${fmtN(totRevSec+totRevPrim+totRevPers)}</div></div>
        <div class="stat-card net"><div class="lib">Net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
      </div>

      ${sectionHeader("Section Secondaire", SEC_COLORS.secondaire, salairesSec.length)}
      <table>
        ${tableHead(["N°","Prénoms et Nom","Matière","Niveau","V.H. Hebdo","V.H. Prévu","5è Sem","Non Exé.","Exécuté","Prime/h","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.secondaire)}
        <tbody>
        ${salairesSec.length === 0
          ? `<tr><td colspan="14" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant secondaire pour ce mois</td></tr>`
          : salairesSec.map((s,i)=>`<tr>
            <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
            <td class="left">${s.nom||""}</td>
            <td class="center">${s.matiere||"—"}</td>
            <td class="center">${s.niveau||"—"}</td>
            <td class="center">${s.vhHebdo||0}</td>
            <td class="center">${s.vhPrevu||0}</td>
            <td class="center">${s.cinqSem||0}</td>
            <td class="center">${s.nonExecute||0}</td>
            <td class="center" style="background:#EFF6FF;font-weight:800;color:#1D4ED8">${calcExecute(s)}</td>
            <td class="right">${s.primesVariables?'<span style="color:#9a3412;font-weight:700;font-size:9.5px">Variable</span>':fmtN(s.primeHoraire)}</td>
            <td class="right">${fmtN(calcMontant(s))}</td>
            <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
            <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
            <td class="right net">${fmtN(calcNet(s))}</td>
          </tr>`).join("")}
        ${salairesSec.length > 0 ? totalRow("TOTAL SECONDAIRE", SEC_COLORS.secondaire, totMontantSec, totBonSec, totRevSec, totNetSec, 10) : ""}
        </tbody>
      </table>

      ${sectionHeader("Section Primaire", SEC_COLORS.primaire, salairesPrim.length)}
      <table>
        ${tableHead(["N°","Prénoms et Nom","Classe","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.primaire)}
        <tbody>
        ${salairesPrim.length === 0
          ? `<tr><td colspan="7" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant primaire pour ce mois</td></tr>`
          : salairesPrim.map((s,i)=>`<tr>
            <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
            <td class="left">${s.nom||""}</td>
            <td class="center">${s.niveau||"—"}</td>
            <td class="right">${fmtN(s.montantForfait||0)}</td>
            <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
            <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
            <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
          </tr>`).join("")}
        ${salairesPrim.length > 0 ? totalRow("TOTAL PRIMAIRE", SEC_COLORS.primaire, totMontantPrim, totBonPrim, totRevPrim, totNetPrim, 3) : ""}
        </tbody>
      </table>

      ${sectionHeader("Administration & Personnel", SEC_COLORS.personnel, salairesPers.length)}
      <table>
        ${tableHead(["N°","Prénoms et Nom","Poste","Catégorie","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.personnel)}
        <tbody>
        ${salairesPers.length === 0
          ? `<tr><td colspan="8" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun membre du personnel pour ce mois</td></tr>`
          : salairesPers.map((s,i)=>`<tr>
            <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
            <td class="left">${s.nom||""}</td>
            <td class="center">${s.poste||"—"}</td>
            <td class="center">${s.categorie||"—"}</td>
            <td class="right">${fmtN(s.montantForfait||0)}</td>
            <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
            <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
            <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
          </tr>`).join("")}
        ${salairesPers.length > 0 ? totalRow("TOTAL ADMINISTRATION", SEC_COLORS.personnel, totMontantPers, totBonPers, totRevPers, totNetPers, 4) : ""}
        </tbody>
      </table>

      <div class="global-totaux">
        <div class="global-total montant"><div class="lib">Total brut à payer</div><div class="val">${fmtN(totMontantGlobal)} GNF</div></div>
        <div class="global-total bon"><div class="lib">Total bons</div><div class="val">${fmtN(totBonGlobal)} GNF</div></div>
        <div class="global-total net"><div class="lib">Total net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
      </div>

      <div class="signatures">
        <div class="sig">Le Comptable<br/><br/><br/>Signature</div>
        <div class="sig">Le Directeur<br/><br/><br/>Signature</div>
        <div class="sig">Le Fondateur<br/><br/><br/>Signature</div>
      </div>

      <div class="footer-note">État émis le ${today()} — ${schoolInfo?.nom||"École"} — Tous montants en Francs Guinéens (GNF)</div>

      <script>window.onload=()=>window.print();</script>
    </body></html>`);
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

  const anneeBase = Number(String(anneeCourante).split("-")[0]) || new Date().getFullYear();
  const anneesDispo = Array.from({length:7},(_,i)=>`${anneeBase-i}-${anneeBase-i+1}`);

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div style={{flex:1,minWidth:200}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Comptabilité</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Finances, salaires, versements & mensualités</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:12,color:"#64748b",fontWeight:600}}>Année consultée :</label>
          <select value={anneeConsultee} onChange={e=>setAnneeConsultee(e.target.value)}
            style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${enModeArchive?"#f59e0b":"#cbd5e1"}`,fontSize:13,fontWeight:700,
              background:enModeArchive?"#fef3c7":"#fff",color:enModeArchive?"#92400e":C.blueDark,cursor:"pointer"}}>
            {anneesDispo.map(a=><option key={a} value={a}>{a}{a===anneeCourante?" (courante)":""}</option>)}
          </select>
          {enModeArchive&&<Badge color="orange">📚 Vue archive — lecture seule</Badge>}
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <Tabs items={tabs} actif={tab} onChange={setTab}/>

      {tab==="bilan"&&<BilanTab
        schoolInfo={schoolInfo}
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
