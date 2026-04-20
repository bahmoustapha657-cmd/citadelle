import Inscription from "./Inscription";
import ToastContainerView from "./components/ToastContainer";
import Logo from "./Logo";
import { getAuthHeaders } from "./apiClient";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import { useFirestore } from "./hooks/useFirestore";
import React, { useState, useEffect, useRef, useContext } from "react";
import ReactDOM from "react-dom";
import { db, auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import {
  collection, collectionGroup, onSnapshot, addDoc, updateDoc, doc, setDoc, getDoc, getDocs, query, orderBy, limit
} from "firebase/firestore";
import LOGO from "./assets/defaultLogo";
import {
  C,
  TOUS_MOIS_COURTS, TOUS_MOIS_LONGS, MOIS_ANNEE, MOIS_SALAIRE,
  calcMoisAnnee, calcMoisSalaire, getAnnee,
  CLASSES_PRIMAIRE, CLASSES_COLLEGE, CLASSES_LYCEE,
  MATIERES_PRIMAIRE, TOUTES_ANNEES, MENSUALITE, initMens, genererMatricule,
  today, fmt, fmtN,
  COMPTES_DEFAUT, genererMdp, PLANS, PLAN_DUREES, ACCES,
  peutModifierEleves, peutModifier, MODULES,
} from "./constants";
import { GlobalStyles } from "./styles";
import { uploadPhotoEleve } from "./storageUtils";
import {
  Badge, Card, Modale, Champ, Input, Selec, Textarea, Btn,
  THead, TR, TD, Stat, Tabs, Vide,
  Sk, SkeletonTable, SkeletonKPI, SkeletonListe, Chargement,
  LectureSeule, UploadFichiers,
} from "./components/ui";
import {
  enteteDoc, imprimerRecu, imprimerCartesEleves,
  imprimerListeClasse, imprimerAttestation, imprimerBulletin,
  imprimerBulletinsGroupes, imprimerFicheCompositions,
  telechargerExcel, exportExcel,
} from "./reports";
import { AdminPanel } from "./components/AdminPanel";
import { Fondation } from "./components/Fondation";
import { TarifsClasses } from "./components/TarifsClasses";
import { CameraCapture } from "./components/CameraCapture";
import { Calendrier } from "./components/Calendrier";
import { HistoriqueActions } from "./components/HistoriqueActions";
import { Connexion } from "./components/Connexion";
import { TransfertsPanel } from "./components/TransfertsPanel";
import { MatriculeSettings } from "./components/MatriculeSettings";
import { AffichageSettings } from "./components/AffichageSettings";
import { GestionExamens } from "./components/GestionExamens";
import { RechercheGlobale } from "./components/RechercheGlobale";
import { MessagesParents } from "./components/MessagesParents";
import { PortailPublic } from "./components/PortailPublic";
import { ChangerMotDePasseModal } from "./components/ChangerMotDePasseModal";
import { Secondaire } from "./components/Secondaire";
import { TableauDeBord } from "./components/TableauDeBord";
import { LivretsTab } from "./components/LivretsTab";
import { PortailEnseignant } from "./components/PortailEnseignant";
import { PortailParent } from "./components/PortailParent";
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
  const {items:tarifsClasses,ajouter:ajTarif,modifier:modTarif}=useFirestore("tarifs");
  // Pour auto-génération salaires
  const {items:ensCollege}=useFirestore("ensCollege");
  const {items:ensLycee}=useFirestore("ensLycee");
  const {items:ensPrimaire}=useFirestore("ensPrimaire");
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
  const [fraisInscription,setFraisInscription]=useState(()=>Number(localStorage.getItem("LC_fraisInscription")||50000));
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const handlePhotoFichier=e=>{
    const file=e.target.files[0]; if(!file) return;
    if(file.size>2*1024*1024){toast("Image trop grande (max 2 Mo).","warning");return;}
    const reader=new FileReader();
    reader.onload=ev=>setForm(p=>({...p,photo:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const classesPrimaire=CLASSES_PRIMAIRE;
  const classesCollege=CLASSES_COLLEGE;
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
  const elevesEnrol=sortAlpha(niveauEnrol==="college"?elevesC:elevesP);
  const ajEnrol=niveauEnrol==="college"?ajEC:ajEP;
  const supEnrol=niveauEnrol==="college"?supEC:supEP;
  const modEnrol=niveauEnrol==="college"?modEC_full:modEP_full;

  const totR=recettes.reduce((s,x)=>s+Number(x.montant),0);
  const totD=depenses.reduce((s,x)=>s+Number(x.montant),0);
  const totVers=versements.reduce((s,x)=>s+Number(x.montant),0);

  const eleves=niveau==="college"?elevesC:elevesP;
  const modEleves=niveau==="college"?modEC:modEP;
  const classesU=[...new Set(eleves.map(e=>e.classe))].filter(Boolean);

  // Tarif par classe : cherche dans Firestore, sinon fallback MENSUALITE
  const getTarif = (classe) => {
    const t = tarifsClasses.find(t=>t.classe===classe);
    if(t) return Number(t.montant)||0;
    return CLASSES_PRIMAIRE.includes(classe) ? MENSUALITE.primaire : MENSUALITE.college;
  };
  const getTarifIns = (classe) => {
    const t = tarifsClasses.find(t=>t.classe===classe);
    return Number(t?.inscription||0);
  };
  const getTarifReinsc = (classe) => {
    const t = tarifsClasses.find(t=>t.classe===classe);
    return Number(t?.reinscription||0);
  };
  const saveTarif = async (classe, montant, inscription=null, reinscription=null) => {
    const existing = tarifsClasses.find(t=>t.classe===classe);
    const data = {
      montant:Number(montant)||0,
      ...(inscription!==null?{inscription:Number(inscription)||0}:{}),
      ...(reinscription!==null?{reinscription:Number(reinscription)||0}:{})
    };
    if(existing) await modTarif(existing._id, data);
    else await ajTarif({classe, ...data});
  };
  const elevesFiltres=sortAlpha(filtClasse==="all"?eleves:eleves.filter(e=>e.classe===filtClasse));
  const nbPayes=e=>moisAnnee.filter(m=>(e.mens||{})[m]==="Payé").length;

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

  // Salaires du mois sélectionné
  const salairesMois = salaires.filter(s=>s.mois===moisSel);
  const salairesSec = salairesMois.filter(s=>s.section==="Secondaire");
  const salairesPrim = salairesMois.filter(s=>s.section==="Primaire");
  const salairesPers = salairesMois.filter(s=>s.section==="Personnel");
  const bonsMois = bons.filter(b=>b.mois===moisSel);
  const getBonTotal = (nomSalaire) => bonsMois
    .filter(b=>(b.nom||"").toLowerCase().trim()===(nomSalaire||"").toLowerCase().trim())
    .reduce((sum,b)=>sum+Number(b.montant||0),0);

  const appliquerBons = async () => {
    if(readOnly) return;
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
  // Calcule les heures de 5ème semaine d'un enseignant selon son EDT
  const calcCinqSemEns = (nomEns, emploisEns, jours5eme) => {
    if(!jours5eme.length) return 0;
    const creneaux = emploisEns.filter(emp =>
      (emp.enseignant||"").toLowerCase().includes((nomEns||"").toLowerCase()) &&
      jours5eme.includes(emp.jour)
    );
    return creneaux.reduce((acc, emp) => {
      if(!emp.heureDebut||!emp.heureFin) return acc + 2;
      const [hd,md]=(emp.heureDebut).split(":").map(Number);
      const [hf,mf]=(emp.heureFin).split(":").map(Number);
      return acc + Math.round((hf*60+mf - hd*60-md)/60*10)/10;
    }, 0);
  };

  const calcExecute = (s) => (Number(s.vhPrevu)||0) + (Number(s.cinqSem)||0) - (Number(s.nonExecute)||0);
  const calcMontant = (s) => calcExecute(s) * (Number(s.primeHoraire)||0);
  const calcNet = (s) => calcMontant(s) - (Number(s.bon)||0) + (Number(s.revision)||0);
  const totNetSec = salairesSec.reduce((sum,s)=>sum+calcNet(s),0);
  const totNetPrim = salairesPrim.reduce((sum,s)=>sum+Number(s.montantForfait||0)-(Number(s.bon||0))+(Number(s.revision||0)),0);
  const calcNetF = (s) => Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0);
  const totNetPers = salairesPers.reduce((sum,s)=>sum+calcNetF(s),0);

  const autoGenererSalaires = async () => {
    if(readOnly) return;
    const jours5eme = getJours5emeSemaine(moisSel);
    const info5eme = jours5eme.length ? `\n📅 5ème semaine détectée : ${jours5eme.join(", ")} → heures supplémentaires calculées automatiquement.` : "";
    if(!confirm(`Générer automatiquement les salaires pour ${moisSel} ?${info5eme}\n\nSeuls les nouveaux enseignants seront ajoutés.`)) return;
    const nomsExistants=salairesMois.map(s=>(s.nom||"").toLowerCase().trim());

    // Secondaire (college + lycée) — modèle horaire
    const tousEns=[
      ...ensCollege.map(e=>({...e,_emplois:emploisCollege,_eng:engCollege})),
      ...ensLycee.map(e=>({...e,_emplois:emploisLycee,_eng:engLycee})),
    ];
    for(const ens of tousEns){
      const nomComplet=`${ens.prenom||""} ${ens.nom||""}`.trim();
      if(!nomComplet) continue;
      if(nomsExistants.includes(nomComplet.toLowerCase())) continue;
      const creneaux=ens._emplois.filter(emp=>(emp.enseignant||"").toLowerCase().includes((ens.nom||"").toLowerCase()));
      // Calcule les heures et la prime pour chaque créneau (prime par classe si définie)
      const getSlotPrime=(slot)=>{
        // Révision : prime spécifique au créneau (prioritaire)
        if(slot.type==="revision" && slot.primeRevision) return Number(slot.primeRevision);
        const ppc=ens.primeParClasse||[];
        if(ppc.length){
          const match=ppc.find(p=>p.classe&&slot.classe&&slot.classe.toLowerCase().includes(p.classe.toLowerCase()));
          if(match)return Number(match.prime||0);
        }
        return Number(ens.primeHoraire||primeDefaut||0);
      };
      const getSlotH=(emp)=>{
        if(!emp.heureDebut||!emp.heureFin)return 2;
        const [hd,md]=(emp.heureDebut).split(":").map(Number);
        const [hf,mf]=(emp.heureFin).split(":").map(Number);
        return Math.round((hf*60+mf-hd*60-md)/60*10)/10;
      };
      const vhHebdo=Math.round(creneaux.reduce((a,e)=>a+getSlotH(e),0)*10)/10;
      const vhPrevu=Math.round(vhHebdo*4*10)/10;
      // Prime pondérée = Σ(heures_i × prime_i) / Σ(heures_i)
      const totalSalSem=creneaux.reduce((a,e)=>a+getSlotH(e)*getSlotPrime(e),0);
      const primeHoraire=vhHebdo>0?Math.round(totalSalSem/vhHebdo):Number(ens.primeHoraire||primeDefaut||0);
      const hasPPC=(ens.primeParClasse||[]).some(p=>p.classe&&p.prime);
      const cinqSem=calcCinqSemEns(ens.nom, ens._emplois, jours5eme);
      const absences=ens._eng.filter(e=>(e.enseignantNom||"").toLowerCase().includes((ens.nom||"").toLowerCase())&&(e.statut==="Absent"||e.statut==="Non effectué")).length;
      const obs=`Statut: ${ens.statut||"—"}${hasPPC?" · Prime pondérée par classe":""}`;
      await ajS({section:"Secondaire",mois:moisSel,nom:nomComplet,matiere:ens.matiere||"",niveau:ens.grade||"",vhHebdo,vhPrevu,cinqSem,nonExecute:absences,primeHoraire,bon:0,revision:0,observation:obs});
    }

    // Primaire — modèle forfait
    for(const ens of ensPrimaire){
      const nomComplet=`${ens.prenom||""} ${ens.nom||""}`.trim();
      if(!nomComplet) continue;
      if(nomsExistants.includes(nomComplet.toLowerCase())) continue;
      await ajS({section:"Primaire",mois:moisSel,nom:nomComplet,niveau:ens.grade||ens.classe||"",matiere:ens.matiere||"",montantForfait:0,bon:0,revision:0,observation:`Statut: ${ens.statut||"—"}`});
    }

    // Personnel administratif — modèle forfait fixe
    for(const emp of personnel.filter(e=>(e.statut||"Actif")==="Actif")){
      const nomComplet=`${emp.prenom||""} ${emp.nom||""}`.trim();
      if(!nomComplet) continue;
      if(nomsExistants.includes(nomComplet.toLowerCase())) continue;
      await ajS({section:"Personnel",mois:moisSel,nom:nomComplet,poste:emp.poste||"",categorie:emp.categorie||"",montantForfait:Number(emp.salaireBase||0),bon:0,revision:0,observation:emp.observation||""});
    }

    toast("Salaires générés. Renseignez prime horaire, 5ème semaine, bon et révision selon la section.","success");
    logAction("Salaires auto-générés",`Mois : ${moisSel}`);
  };

  const imprimerSalaires = () => {
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
    {id:"personnel",label:`Personnel (${personnel.length})`},
    {id:"fondation",label:`Versements (${versements.length})`},
    {id:"enrolment",label:`Élèves (${elevesC.length+elevesP.length})`},
    {id:"mens",label:"Mensualités"},
    {id:"transferts",label:"🔄 Transferts"}];

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <img src={LOGO} alt="" style={{width:48,height:48,objectFit:"contain"}}/>
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
          const tousEleves=[...elevesC,...elevesP];
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
              <Stat label="Masse salariale" value={`${((totNetSec+totNetPrim+totNetPers)/1e6).toFixed(3)}M`} sub={`GNF — ${moisSel} (${salairesMois.length})`} bg="#fef3e0"/>
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
                    Dépenses:depenses.filter(d=>d.periode===p).reduce((s,d)=>s+Number(d.montant||0),0),
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
                  const tousEleves=[...elevesC,...elevesP];
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
            {moisSalaire.map(m=><option key={m}>{m}</option>)}
          </select>
          {sousTabSal==="etats"&&<>
            {canCreate&&<label title="Appliquée uniquement aux enseignants sans prime définie sur leur fiche" style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.blueDark,background:"#f0f7ff",border:"1px solid #b0c4d8",borderRadius:7,padding:"4px 10px",cursor:"help"}}>
              Prime/h par défaut
              <input type="number" min="0" value={primeDefaut||""} placeholder="0"
                onChange={e=>setPrimeDefaut(Number(e.target.value))}
                style={{width:80,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:C.blueDark,outline:"none"}}/>
              GNF
            </label>}
            {canCreate&&<Btn v="amber" onClick={autoGenererSalaires}>⚡ Auto-générer</Btn>}
            {canCreate&&bonsMois.length>0&&<Btn v="amber" onClick={appliquerBons}>✔ Appliquer les bons</Btn>}
            {canCreate&&<Btn onClick={()=>{setForm({section:"Secondaire",mois:moisSel,nonExecute:0,cinqSem:0,bon:0,revision:0});setModal("add_s");}}>+ Ajouter</Btn>}
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
          {sousTabSal==="bons"&&canCreate&&<Btn onClick={()=>{setForm({mois:moisSel,section:"Secondaire"});setModal("add_b");}}>+ Nouveau bon</Btn>}
        </div>

        {/* ── SOUS-ONGLET BONS ── */}
        {sousTabSal==="bons"&&<>
          {bonsMois.length===0
            ?<Vide icone="📋" msg={`Aucun bon enregistré pour ${moisSel}`}/>
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
                <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#9b2020"}}>TOTAL BONS — {moisSel}</td>
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
                <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF — {moisSel}</div>
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
          {/* Section Secondaire */}
          <div style={{background:C.blue,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13}}>
            SECTION SECONDAIRE — {moisSel} {annee||getAnnee()}
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
                      <td style={{padding:"7px 10px",fontSize:11,color:"#6b7280",border:"1px solid #e8f0e8"}}>{s.observation}</td>
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
            <span style={{flex:1}}>SECTION PRIMAIRE — {moisSel} {annee||getAnnee()}</span>
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
              <THead cols={["N°","Prénoms et Nom","Classe","Montant Forfaitaire","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
              <tbody>
                {salairesPrimFiltres.length===0?
                  <tr><td colSpan={canEdit?9:8} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>{salairesPrim.length===0?"Aucun enseignant primaire pour ce mois":"Aucun résultat pour ce filtre"}</td></tr>
                  :salairesPrimFiltres.map((s,i)=>(
                    <TR key={s._id}>
                      <TD center>{i+1}</TD>
                      <TD bold>{s.nom}</TD>
                      <TD>{s.niveau}</TD>
                      <TD center>{fmtN(s.montantForfait||0)}</TD>
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
                  <td colSpan={6} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark}}>
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
            <span style={{flex:1}}>SECTION PERSONNEL — {moisSel} {annee||getAnnee()}</span>
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
          <Selec label="Mois" value={form.mois||moisSel} onChange={chg("mois")}>
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
          const moisBon = form.mois||moisSel;
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
            <Btn onClick={()=>enreg(ajPers,modPers,{salaireBase:Number(form.salaireBase||0)})}>Enregistrer</Btn>
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
          (cEC||cEP)?<Chargement/>:elevesEnrol.length===0?<Vide icone="🎓" msg="Aucun élève enregistré"/>
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
                          await modEnrol(e._id,{statut:"Actif",dateDepart:null,motifDepart:null,destinationDepart:null});
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
                {(niveauEnrol==="college"?classesCollege:classesPrimaire).map(c=><option key={c}>{c}</option>)}
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
                // ── Vérification des doublons avant enrôlement ──
                if(modal==="add_enrol") {
                  const tousEleves2=[...elevesC,...elevesP];
                  const doublonIEN = r.ien && tousEleves2.some(e=>e.ien && e.ien===r.ien);
                  const doublonNom = tousEleves2.some(e=>
                    e.nom?.trim().toLowerCase()===r.nom?.trim().toLowerCase() &&
                    e.prenom?.trim().toLowerCase()===r.prenom?.trim().toLowerCase() &&
                    e.dateNaissance && e.dateNaissance===r.dateNaissance
                  );
                  const doublonMat = r.matricule && tousEleves2.some(e=>e.matricule===r.matricule);
                  if(doublonIEN || doublonNom || doublonMat) {
                    const msg = doublonIEN ? `⚠️ Un élève avec le même IEN (${r.ien}) existe déjà.`
                      : doublonMat ? `⚠️ Le matricule "${r.matricule}" est déjà utilisé.`
                      : `⚠️ Un élève portant le même nom et la même date de naissance est déjà enregistré.`;
                    if(!window.confirm(msg+"\n\nVoulez-vous quand même créer cette fiche ?")) {
                      setUploadEnCours(false); return;
                    }
                  }
                  ajEnrol(r);
                } else {
                  modEnrol(r);
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
                  {(niveauEnrol==="college"?classesCollege:classesPrimaire).map(c=><option key={c}>{c}</option>)}
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
              const tousE2=[...elevesC,...elevesP];
              const doublonNom=tousE2.some(e=>e.nom?.trim().toLowerCase()===r.nom?.trim().toLowerCase()&&e.prenom?.trim().toLowerCase()===r.prenom?.trim().toLowerCase()&&e.dateNaissance&&e.dateNaissance===r.dateNaissance);
              if(doublonNom&&!window.confirm("⚠️ Un élève portant le même nom et la même date de naissance existe déjà.\n\nVoulez-vous quand même créer cette fiche ?"))return false;
              ajEnrol(r);
              toast(`${r.prenom} ${r.nom} ajouté(e)`,"success");
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
                const classesEcole=[...new Set([...elevesC,...elevesP].map(e=>e.classe||"").filter(Boolean))].map(c=>c.toLowerCase());

                const rows=allRows.slice(headerRowIdx+1).filter(r=>r.some(c=>String(c||"").trim()));
                const lignes=rows.map((r,i)=>{
                  // ── Nom & Prénom : colonne Élève (nom complet) ou colonnes séparées ──
                  let nom=get(r,cols.nom);
                  let prenom=get(r,cols.prenom);
                  if((!nom||!prenom) && cols.eleveComplet>=0){
                    const complet=get(r,cols.eleveComplet);
                    if(complet){
                      const parts=complet.trim().split(/\s+/);
                      // Détermine l'ordre selon le paramètre choisi par l'utilisateur
                      const premier=parts[0]||"";
                      const premierEstMaj=premier.length>1&&premier===premier.toUpperCase()&&/[A-Z]/.test(premier);
                      const nomEnPremier = ordreNomImport==="nom_prenom"
                        || (ordreNomImport==="auto" && premierEstMaj);
                      if(nomEnPremier){
                        if(!nom)    nom=parts[0]||"";
                        if(!prenom) prenom=parts.slice(1).join(" ")||"";
                      } else {
                        if(!nom)    nom=parts[parts.length-1]||"";
                        if(!prenom) prenom=parts.slice(0,-1).join(" ")||"";
                      }
                    }
                  }
                  // ── Classe : colonne ou défaut sélectionné ──
                  const classe=get(r,cols.classe)||classeDefautImport;
                  // ── Sexe ──
                  const sexeRaw=get(r,cols.sexe).toUpperCase();
                  const sexe=sexeRaw==="F"||sexeRaw.startsWith("F")?"F":"M";
                  // ── Dates ──
                  const dateNaissance=parseDate(get(r,cols.date));
                  const lieuNaissance=get(r,cols.lieuNaiss);
                  // ── Père / Mère → filiation + tuteur ──
                  const pereVal=get(r,cols.pere);
                  const mereVal=get(r,cols.mere);
                  const filiation=pereVal||mereVal
                    ? [pereVal?"Père: "+pereVal:"", mereVal?"Mère: "+mereVal:""].filter(Boolean).join(" / ")
                    : get(r,cols.filiation);
                  const tuteur=get(r,cols.tuteur)||pereVal||mereVal;
                  // ── Contact ──
                  const contactTuteur=get(r,cols.contact);
                  const domicile=get(r,cols.domicile);
                  const ti=get(r,cols.typeInsc);
                  const typeInscription=ti||"Première inscription";
                  // La colonne "Matricule" du fichier = identifiant national (IEN) en contexte guinéen.
                  // Le matricule interne de l'école est toujours auto-généré à l'import.
                  const matriculeFichier=get(r,cols.matricule);
                  const ien=get(r,cols.ien)||(cols.ien<0?matriculeFichier:"");
                  const erreurs=[];
                  const avertissements=[];
                  if(!nom) erreurs.push("Nom manquant");
                  if(!prenom) erreurs.push("Prénom manquant");
                  if(!classe) avertissements.push("Classe non définie — sélectionner une classe par défaut");
                  else if(!classesEcole.includes(classe.toLowerCase())&&!classesConnues.includes(classe.toLowerCase()))
                    avertissements.push(`Classe "${classe}" non reconnue`);
                  return {nom,prenom,classe,sexe,dateNaissance,lieuNaissance,ien,tuteur,contactTuteur,filiation,domicile,typeInscription,erreurs,avertissements,ligne:i+2};
                });

                // Résumé du mapping détecté
                const champLabels={num:"N°(ignoré)",matricule:"Matricule→IEN",eleveComplet:"Élève",nom:"Nom",prenom:"Prénom",classe:"Classe",sexe:"Sexe",date:"Date naissance",lieuNaiss:"Lieu naissance",pere:"Père",mere:"Mère",filiation:"Père et Mère (combiné)",tuteur:"Tuteur",contact:"Téléphone",domicile:"Domicile",typeInsc:"Type inscription",ien:"IEN"};
                const mapping=Object.entries(cols).map(([k,idx])=>({champ:champLabels[k],colonne:idx>=0?headers[idx]:null,idx}));

                setImportEnrolPreview({lignes,valides:lignes.filter(l=>!l.erreurs.length),mapping,nbAvert:lignes.filter(l=>!l.erreurs.length&&l.avertissements?.length).length});
                e.target.value="";
              }}/>
            </label>
            <Btn v="ghost" onClick={()=>{
              const wb=XLSX.utils.book_new();
              const ws=XLSX.utils.aoa_to_sheet([
                ["N°","Matricule","Élève","Sexe","Date de naissance","Lieu de naissance","Père","Mère","Téléphone"],
                [1,"","BAH Aminata","F","2012-03-15","Conakry","Mamadou Bah","Fatoumata Diallo","622000001"],
                [2,"","DIALLO Ibrahima Sékou","M","2013-07-22","Kindia","Boubacar Diallo","Mariama Bah","628000002"],
              ]);
              XLSX.utils.book_append_sheet(wb,ws,"Eleves");
              telechargerExcel(wb,"modele_import_eleves.xlsx");
            }}>⬇️ Modèle Excel</Btn>
          </div>

          {/* Sélecteur classe par défaut (quand pas de colonne Classe dans le fichier) */}
          <div style={{marginBottom:8,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde047",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>📚 Classe à affecter</span>
            <span style={{fontSize:12,color:"#713f12",flex:1}}>Si votre fichier n'a pas de colonne Classe, sélectionnez-en une ici.</span>
            <select value={classeDefautImport} onChange={e=>setClasseDefautImport(e.target.value)}
              style={{border:"1.5px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",fontWeight:700,color:"#0A1628"}}>
              <option value="">— Classe du fichier —</option>
              {(niveauEnrol==="primaire"?classesPrimaire:classesCollege).map(c=><option key={c} value={c}>{c}</option>)}
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
              const existants=[...elevesC,...elevesP];
              // Accumule les matricules générés dans ce lot pour éviter les doublons
              const matsGeneres=[];
              for(const l of importEnrolPreview.valides){
                const doublon=existants.some(e=>
                  e.nom?.trim().toLowerCase()===l.nom.toLowerCase()&&
                  e.prenom?.trim().toLowerCase()===l.prenom.toLowerCase()&&
                  e.dateNaissance&&e.dateNaissance===l.dateNaissance
                );
                if(doublon) continue;
                const mat=genererMatricule([...elevesEnrol,...matsGeneres],niveauEnrol,schoolInfo);
                matsGeneres.push({matricule:mat});
                const ajFn=niveauEnrol==="primaire"?ajEP:ajEC;
                await ajFn({
                  nom:l.nom,prenom:l.prenom,classe:l.classe,sexe:l.sexe,
                  dateNaissance:l.dateNaissance,lieuNaissance:l.lieuNaissance,ien:l.ien,
                  tuteur:l.tuteur,contactTuteur:l.contactTuteur,
                  filiation:l.filiation,domicile:l.domicile,
                  typeInscription:l.typeInscription,
                  matricule:mat,statut:"Actif",mens:initMens(),
                });
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
          getTarif={getTarif}
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
                    const niv=elevesC.find(ec=>ec._id===e._id)?"Collège":"Primaire";
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
              <span style={{flex:1}}/>
              <span style={{fontSize:11,fontWeight:700,color:C.blueDark}}>Inscription :</span>
              <input type="number" value={fraisInscription} onChange={e=>setFraisInscription(Number(e.target.value))}
                placeholder="Frais inscription GNF"
                style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 8px",fontSize:12,width:160,color:C.blue,fontWeight:700}}/>
              <Badge color="purple">{fmt(elevesFiltres.filter(e=>e.inscriptionPayee).length * fraisInscription)} perçus</Badge>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
                <THead cols={["Matricule","Nom & Prénom","Classe","Tuteur","Contact",...moisAnnee,"Payés","Ins.","Reçu"]}/>
                <tbody>{elevesFiltres.map(e=>{
                  const mens=e.mens||initMens();
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
                      <button onClick={()=>{
                        if(readOnly)return;
                        modEleves(e._id,{inscriptionPayee:!e.inscriptionPayee});
                      }} title="Inscription payée ?"
                        style={{width:26,height:26,borderRadius:5,border:"none",cursor:readOnly?"default":"pointer",fontSize:11,
                          background:e.inscriptionPayee?C.blue:"#f1f3f4",color:e.inscriptionPayee?"#fff":"#9ca3af",fontWeight:700}}>
                        {e.inscriptionPayee?"✓":"I"}
                      </button>
                    </td>
                    <td style={{padding:"4px 6px",textAlign:"center"}}>
                      <Btn sm v="amber" onClick={()=>imprimerRecu(e,getTarif(e.classe),schoolInfo,moisAnnee,
                        e.typeInscription==="Réinscription"?getTarifReinsc(e.classe):getTarifIns(e.classe))}>🖨️</Btn>
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
function Ecole({titre, couleur, cleClasses, cleEns, cleNotes, cleEleves, avecEns, userRole, annee, classesPredefinies, maxNote=20, matieresPredefinies=[], readOnly=false, verrouOuvert=false}) {
  const {items:classes,chargement:cC,ajouter:ajC,modifier:modC,supprimer:supC}=useFirestore(cleClasses);
  const {items:ens,chargement:cEns,ajouter:ajEns,modifier:modEns,supprimer:supEns}=useFirestore(cleEns);
  const {items:notes,chargement:cN,ajouter:ajN,supprimer:supN}=useFirestore(cleNotes);
  const {items:eleves,chargement:cE,modifier:modE}=useFirestore(cleEleves);
  const {items:absences,chargement:cAbs,ajouter:ajAbs,supprimer:supAbs}=useFirestore(cleEleves+"_absences");
  const {items:enseignements,chargement:cEng,ajouter:ajEng,modifier:modEng,supprimer:supEng}=useFirestore(cleEns+"_enseignements");
  const {items:matieres,chargement:cMat,ajouter:ajMat,modifier:modMat,supprimer:supMat}=useFirestore(cleClasses+"_matieres");
  const {items:emplois,chargement:cEmp,ajouter:ajEmp,modifier:modEmp,supprimer:supEmp}=useFirestore(cleClasses+"_emplois");

  const [tab,setTab]=useState("apercu");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [filtreClasse,setFiltreClasse]=useState("all");
  const [edtVueGrille,setEdtVueGrille]=useState(true);
  const [edtCellule,setEdtCellule]=useState(null); // {jour,heureDebut,heureFin,existing?}
  const [edtDuree,setEdtDuree]=useState(maxNote===10?60:120); // primaire: 30/45/60min, secondaire: 120min fixe
  // Matières filtrées par classe : si la matière a des classes assignées, on filtre ; sinon elle s'applique à tout
  const matieresForClasse = (classe) => {
    if(!classe||classe==="all") return matieres;
    return matieres.filter(m=>!m.classes||!m.classes.length||m.classes.includes(classe));
  };
  const [edtGeneralOuvert,setEdtGeneralOuvert]=useState(false);
  const [edtHeureDebut,setEdtHeureDebut]=useState("08:00");
  const [edtHeureFin,setEdtHeureFin]=useState("14:00");
  const [periodeB,setPeriodeB]=useState("T1");
  const [rechercheMatricule,setRechercheMatricule]=useState("");
  const [ensCompte,setEnsCompte]=useState(null);
  const [formC,setFormC]=useState({});
  const [parentEleve,setParentEleve]=useState(null);
  const [formP,setFormP]=useState({});
  const [importPreview,setImportPreview]=useState(null);
  const [importEnCours,setImportEnCours]=useState(false);
  const [notesVue,setNotesVue]=useState("liste"); // "liste" | "grille"
  const [grilleClasse,setGrilleClasse]=useState("all");
  const [grillePeriode,setGrillePeriode]=useState("T1");
  const [grilleType,setGrilleType]=useState("Devoir");
  const [grilleChanges,setGrilleChanges]=useState({}); // {"eleveId|matiere": note}
  const [grilleSaving,setGrilleSaving]=useState(false);
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const chgC=k=>e=>setFormC(p=>({...p,[k]:e.target.value}));
  const chgP=k=>e=>setFormP(p=>({...p,[k]:e.target.value}));
  const {schoolId, schoolInfo, moisAnnee, toast, logAction, envoyerPush} = useContext(SchoolContext);
  const canCreate = !readOnly;
  const canEdit = !readOnly && (peutModifier(userRole) || verrouOuvert);
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

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <img src={LOGO} alt="" style={{width:48,height:48,objectFit:"contain"}}/>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>{titre}</h2>
          <p style={{margin:0,fontSize:12,color:couleur,fontWeight:700}}>Gestion des classes, élèves, notes et discipline</p>
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#92400e",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>🔒</span>
        <span>L'enrôlement et la suppression des élèves se font uniquement dans le module <strong>Comptabilité → Élèves</strong>.</span>
      </div>
      <Tabs items={tabItems} actif={tab} onChange={setTab}/>

      {/* ── APERÇU ── */}
      {tab==="apercu"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
          <Stat label="Classes" value={classes.length}/>
          <Stat label="Élèves actifs" value={eleves.filter(e=>e.statut==="Actif").length} sub={`sur ${eleves.length}`}/>
          {avecEns&&<Stat label="Enseignants" value={ens.length}/>}
          <Stat label="Moy. Générale" value={`${moy}/${maxNote}`} bg="#eaf4e0"/>
          <Stat label="Absences" value={absences.length} bg="#fef3e0"/>
        </div>
        {(cC||cE)?<Chargement/>:classes.length===0&&eleves.length===0?<Vide icone={avecEns?"🏫":"🎒"} msg="Module vide"/>
          :<Card><div style={{padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{margin:0,fontWeight:800,fontSize:14,color:C.blueDark}}>Effectifs par classe</p>
              <div style={{display:"flex",gap:8}}>
                {classesUniq.map(cl=>(
                  <Btn sm key={cl} v="ghost" onClick={()=>imprimerListeClasse(cl,eleves,schoolInfo)}>🖨️ {cl}</Btn>
                ))}
              </div>
            </div>
            {classes.map(c=>(
              <div key={c._id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:C.blueDark,width:76}}>{c.nom}</span>
                <div style={{flex:1,background:"#e0ebf8",borderRadius:5,height:8}}>
                  <div style={{background:couleur,borderRadius:5,height:8,width:`${Math.min((Number(c.effectif)||0)/50*100,100).toFixed(0)}%`}}/>
                </div>
                <span style={{fontSize:11,color:"#6b7280",width:26,textAlign:"right",fontWeight:600}}>{c.effectif}</span>
              </div>
            ))}
          </div></Card>}

          {/* ── GRAPHIQUE EFFECTIFS + MOYENNES ── */}
          {classes.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Effectifs par classe</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classes.map(c=>({classe:c.nom,Effectif:Number(c.effectif)||0}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="classe" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip/>
                  <Bar dataKey="Effectif" fill={couleur} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>

            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Moyenne générale par classe</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classes.map(c=>{
                  const elevesClasse=eleves.filter(e=>e.classe===c.nom);
                  if(!elevesClasse.length) return {classe:c.nom,Moyenne:0};
                  const moyClasse=elevesClasse.map(e=>{
                    const notesE=notes.filter(n=>n.eleveId===e._id);
                    let moy=0,totC=0;
                    matieresForClasse(e.classe).forEach(mat=>{
                      const coef=mat.coefficient||1;
                      totC+=coef;
                      const nm=notesE.filter(n=>n.matiere===mat.nom);
                      if(nm.length){const m=nm.reduce((s,n)=>s+Number(n.note),0)/nm.length;moy+=m*coef;}
                    });
                    return totC>0?moy/totC:null;
                  }).filter(m=>m!==null);
                  const moy=moyClasse.length?(moyClasse.reduce((s,m)=>s+m,0)/moyClasse.length).toFixed(2):0;
                  return {classe:c.nom,Moyenne:Number(moy)};
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="classe" tick={{fontSize:10}}/>
                  <YAxis domain={[0,maxNote]} tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${v}/${maxNote}`}/>
                  <Bar dataKey="Moyenne" fill="#f59e0b" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>
          </div>}

          {/* ── TABLEAU D'HONNEUR ── */}
          {eleves.length>0&&(()=>{
            const classement=eleves.map(e=>{
              const notesPeriode=notes.filter(n=>n.eleveId===e._id);
              let moy=0,totC=0;
              matieresForClasse(e.classe).forEach(mat=>{
                const coef=mat.coefficient||1;
                totC+=coef;
                const nm=notesPeriode.filter(n=>n.matiere===mat.nom);
                if(nm.length){const m=nm.reduce((s,n)=>s+Number(n.note),0)/nm.length;moy+=m*coef;}
              });
              return {...e, moyGene:totC>0?(moy/totC):0};
            }).filter(e=>e.moyGene>0).sort((a,b)=>b.moyGene-a.moyGene).slice(0,5);
            if(!classement.length) return null;
            return (
              <div style={{marginTop:16}}>
                <div style={{background:"linear-gradient(90deg,#d97706,#f59e0b)",color:"#fff",padding:"10px 16px",borderRadius:"10px 10px 0 0",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                  🏆 Tableau d'Honneur — 5 meilleurs élèves
                </div>
                <Card style={{borderRadius:"0 0 10px 10px"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#fef3e0"}}>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Rang</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Élève</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Classe</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Moyenne</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Mention</th>
                    </tr></thead>
                    <tbody>{classement.map((e,i)=>{
                      const medals=["🥇","🥈","🥉","4️⃣","5️⃣"];
                      const moy=e.moyGene.toFixed(2);
                      const mention=Number(moy)>=16?"Très Bien":Number(moy)>=14?"Bien":Number(moy)>=12?"Assez Bien":Number(moy)>=10?"Passable":"Insuffisant";
                      const mentionColor=Number(moy)>=14?"vert":Number(moy)>=10?"blue":"red";
                      return <tr key={e._id} style={{borderBottom:"1px solid #fde68a",background:i===0?"#fffbeb":"#fff"}}>
                        <td style={{padding:"9px 12px",textAlign:"center",fontSize:20}}>{medals[i]}</td>
                        <td style={{padding:"9px 12px",fontWeight:800,color:C.blueDark}}>{e.nom} {e.prenom}</td>
                        <td style={{padding:"9px 12px"}}><Badge color="blue">{e.classe}</Badge></td>
                        <td style={{padding:"9px 12px",textAlign:"center",fontSize:16,fontWeight:800,color:C.greenDk}}>{moy}/20</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><Badge color={mentionColor}>{mention}</Badge></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </Card>
              </div>
            );
          })()}
        </div>}

      {/* ── CLASSES ── */}
      {tab==="classes"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Classes ({classes.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_c");}}>+ Nouvelle classe</Btn>}
        </div>
        {cC?<Chargement/>:classes.length===0?<Vide icone="🏫" msg="Aucune classe"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Classe","Effectif","Enseignant Principal","Salle","Imprimer liste",canEdit?"Actions":""]}/>
            <tbody>{classes.map(c=><TR key={c._id}>
              <TD bold>{c.nom}</TD><TD><Badge color="blue">{c.effectif} élèves</Badge></TD>
              <TD>{c.enseignant}</TD><TD>{c.salle}</TD>
              <TD><Btn sm v="ghost" onClick={()=>imprimerListeClasse(c.nom,eleves,schoolInfo)}>🖨️ Imprimer</Btn></TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...c});setModal("edit_c");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supC(c._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {(modal==="add_c"&&canCreate||(modal==="edit_c"&&canEdit))&&<Modale titre={modal==="add_c"?"Nouvelle classe":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
            <Champ label="Nom de la classe">
              <input value={form.nom||""} onChange={chg("nom")}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",marginBottom:8}}
                placeholder="Saisir ou cliquer sur une classe prédéfinie"/>
              <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 5px"}}>Classes prédéfinies — cliquez pour sélectionner :</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).map(c=>(
                  <button key={c} onClick={()=>setForm(p=>({...p,nom:c}))}
                    style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",
                      background:form.nom===c?C.green:"#e0ebf8",color:form.nom===c?"#fff":C.blue,border:"none"}}>
                    {c}
                  </button>
                ))}
                {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).length===0&&
                  <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Toutes les classes prédéfinies sont déjà créées.</span>}
              </div>
            </Champ>
          </div>
            <Input label="Effectif" type="number" value={form.effectif||""} onChange={chg("effectif")}/>
            <Input label="Enseignant Principal" value={form.enseignant||""} onChange={chg("enseignant")}/>
            <Input label="Salle" value={form.salle||""} onChange={chg("salle")}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={saveClasse}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ÉLÈVES (lecture seule — enrôlement dans Comptabilité) ── */}
      {tab==="eleves"&&<div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Élèves ({eleves.length})</strong>
          <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {classesUniq.map(c=><option key={c}>{c}</option>)}
          </select>
          {filtreClasse!=="all"&&<Btn sm v="ghost" onClick={()=>imprimerListeClasse(filtreClasse,eleves,schoolInfo)}>🖨️ Imprimer liste</Btn>}
          <Btn sm v="blue" onClick={()=>imprimerCartesEleves(elevesFiltres,schoolInfo,annee)}>🪪 Cartes ID</Btn>
          <Btn sm v="ghost" onClick={()=>exportExcel(
            `Eleves_${avecEns?"College":"Primaire"}`,
            ["Matricule","IEN","Nom","Prénom","Classe","Sexe","Date Naissance","Lieu Naissance","Filiation","Tuteur","Contact","Domicile","Statut"],
            elevesFiltres.map(e=>[e.matricule||"",e.ien||"",e.nom,e.prenom,e.classe,e.sexe||"",e.dateNaissance||"",e.lieuNaissance||"",e.filiation||"",e.tuteur||"",e.contactTuteur||"",e.domicile||"",e.statut||"Actif"])
          )}>📥 Export Excel</Btn>
        </div>
        {cE?<Chargement/>:elevesFiltres.length===0?<Vide icone="🎓" msg="Aucun élève"/>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
              <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Date Nais.","Lieu Nais.","Filiation","Tuteur","Contact","Domicile","Documents","Statut","Accès"]}/>
              <tbody>{elevesFiltres.map(e=><TR key={e._id}>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
                <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
                <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
                <TD>{e.dateNaissance||"—"}</TD>
                <TD>{e.lieuNaissance||"—"}</TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
                <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
                <TD>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {(e.fichiers||[]).map((f,i)=>(
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,background:"#e0ebf8",padding:"2px 6px",borderRadius:4}}>📎 {f.nom}</a>
                    ))}
                    {(e.fichiers||[]).length===0&&<span style={{fontSize:11,color:"#9ca3af"}}>—</span>}
                  </div>
                </TD>
                <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
                <TD>
                  {canEdit&&<Btn sm v="purple" onClick={()=>{
                    const loginSuggere=`parent.${(e.nom||"").toLowerCase().replace(/\s+/g,"").slice(0,12)}`;
                    setParentEleve(e);
                    setFormP({login:loginSuggere, mdp:genererMdp()});
                  }}>👨‍👩‍👧 Compte</Btn>}
                </TD>

              </TR>)}</tbody>
            </table>
          </div>}

      {/* Modal création compte parent */}
      {parentEleve&&<Modale titre={`Compte parent — ${parentEleve.prenom} ${parentEleve.nom}`} fermer={()=>setParentEleve(null)}>
        <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🎓</span>
          <span><strong>{parentEleve.prenom} {parentEleve.nom}</strong> · Classe {parentEleve.classe} · Tuteur : {parentEleve.tuteur||"—"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
          <Input label="Identifiant de connexion" value={formP.login||""} onChange={chgP("login")} placeholder="ex: parent.dupont"/>
          <Champ label="Mot de passe initial">
            <div style={{display:"flex",gap:8}}>
              <input value={formP.mdp||""} onChange={chgP("mdp")}
                style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
              <Btn sm v="ghost" onClick={()=>setFormP(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
            </div>
          </Champ>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
          ⚠️ Notez ces identifiants avant de valider — remettez-les au tuteur de l'élève.
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setParentEleve(null)}>Annuler</Btn>
          <Btn v="purple" onClick={async()=>{
            if(!formP.login?.trim()){toast("Identifiant requis.","warning");return;}
            if(!formP.mdp||formP.mdp.length<8){toast("Mot de passe minimum 8 caractères.","warning");return;}
            try{
              const section=cleEleves.includes("Primaire")?"primaire":cleEleves.includes("Lycee")?"lycee":"college";
              const headers = await getAuthHeaders({"Content-Type":"application/json"});
              const res = await fetch("/api/account-manage",{
                method:"POST",
                headers,
                body:JSON.stringify({
                  action:"create",
                  schoolId,
                  login:formP.login.trim().toLowerCase(),
                  mdp:formP.mdp,
                  role:"parent",
                  label:"Parent",
                  nom:(parentEleve.tuteur||`Parent de ${parentEleve.prenom}`),
                  eleveId:parentEleve._id,
                  eleveNom:`${parentEleve.prenom} ${parentEleve.nom}`,
                  eleveClasse:parentEleve.classe||"",
                  section,
                  statut:"Actif",
                }),
              });
              const data = await res.json().catch(()=>({}));
              if(!res.ok||!data.ok) throw new Error(data.error||"Création du compte impossible.");
              toast(`Compte parent créé — ID : ${formP.login} · Remettez-le au tuteur de ${parentEleve.prenom}.`,"success");
              logAction("Compte parent créé",`Login: ${formP.login} · Élève: ${parentEleve.prenom} ${parentEleve.nom}`);
              setParentEleve(null);
            }catch(e){toast("Erreur : "+e.message,"error");}
          }}>✅ Créer le compte</Btn>
        </div>
      </Modale>}

      </div>}

      {/* ── ENSEIGNANTS ── */}
      {tab==="ens"&&avecEns&&(()=>{
        const sectionEns = cleEns.includes("Lycee")?"lycee":cleEns.includes("College")?"college":"primaire";

        const creerCompteEns = async () => {
          if(!formC.login?.trim()){toast("Identifiant requis.","warning");return;}
          if(!formC.mdp||formC.mdp.length<8){toast("Mot de passe minimum 8 caractères.","warning");return;}
          try{
            const nomComplet=`${ensCompte.prenom||""} ${ensCompte.nom||""}`.trim();
            const headers = await getAuthHeaders({"Content-Type":"application/json"});
            const res = await fetch("/api/account-manage",{
              method:"POST",
              headers,
              body:JSON.stringify({
                action:"create",
                schoolId,
                login:formC.login.trim().toLowerCase(),
                mdp:formC.mdp,
                role:"enseignant",
                label:"Enseignant",
                nom:nomComplet,
                enseignantNom:nomComplet,
                section:sectionEns,
                matiere:ensCompte.matiere||"",
                statut:"Actif",
              }),
            });
            const data = await res.json().catch(()=>({}));
            if(!res.ok||!data.ok) throw new Error(data.error||"Création du compte impossible.");
            toast(`Compte enseignant créé — ID : ${formC.login} · L'enseignant changera son mot de passe à la 1ère connexion.`,"success");
            logAction("Compte enseignant créé",`Login: ${formC.login} · ${nomComplet}`);
            setEnsCompte(null);
          }catch(e){toast("Erreur : "+e.message,"error");}
        };

        return <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <strong style={{fontSize:14,color:C.blueDark}}>Corps enseignant ({ens.length})</strong>
            {canCreate&&<Btn onClick={()=>{setForm({statut:"Titulaire"});setModal("add_ens");}}>+ Ajouter</Btn>}
          </div>
          {cEns?<Chargement/>:ens.length===0?<Vide icone="👨‍🏫" msg="Aucun enseignant"/>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
              {ens.map(e=><Card key={e._id}><div style={{padding:"14px 15px"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
                  <div style={{width:38,height:38,borderRadius:8,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff"}}>
                    {(e.prenom||"?")[0]}{(e.nom||"?")[0]}
                  </div>
                  <Badge color={e.statut==="Titulaire"?"vert":"amber"}>{e.statut}</Badge>
                </div>
                <p style={{margin:"0 0 1px",fontWeight:800,fontSize:13,color:C.blueDark}}>{e.prenom} {e.nom}</p>
                <p style={{margin:"0 0 4px",fontSize:12,color:couleur,fontWeight:700}}>{e.matiere}</p>
                <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.grade} · {e.telephone}</p>
                {(e.fichiers||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                  {e.fichiers.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.blue,background:"#e0ebf8",padding:"2px 5px",borderRadius:3}}>📎 {f.nom}</a>)}
                </div>}
                {canEdit&&<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens");}}>✏️ Modifier</Btn>
                  <Btn sm v="purple" onClick={()=>{
                    const loginSuggere=`${(e.prenom||"").toLowerCase().replace(/\s+/g,"")}${e.nom?"."+e.nom.toLowerCase().replace(/\s+/g,""):""}`;
                    setEnsCompte(e);
                    setFormC({login:loginSuggere,mdp:genererMdp()});
                  }}>🔑 Compte</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEns(e._id);}}>🗑</Btn>
                </div>}
              </div></Card>)}
            </div>}

          {/* Modal compte enseignant */}
          {ensCompte&&<Modale titre={`Compte — ${ensCompte.prenom} ${ensCompte.nom}`} fermer={()=>setEnsCompte(null)}>
            <div style={{marginBottom:14,padding:"10px 14px",background:"#f5f3ff",borderRadius:10,fontSize:12,color:"#6d28d9"}}>
              <strong>Section :</strong> {sectionEns} &nbsp;|&nbsp; <strong>Matière :</strong> {ensCompte.matiere||"—"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
              <Input label="Identifiant de connexion" value={formC.login||""} onChange={chgC("login")} placeholder="ex: jean.dupont"/>
              <Champ label="Mot de passe initial">
                <div style={{display:"flex",gap:8}}>
                  <input value={formC.mdp||""} onChange={chgC("mdp")}
                    style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
                  <Btn sm v="ghost" onClick={()=>setFormC(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
                </div>
              </Champ>
            </div>
            <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
              ⚠️ Notez ces identifiants avant de valider — le mot de passe ne sera plus visible ensuite.
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setEnsCompte(null)}>Annuler</Btn>
              <Btn v="purple" onClick={creerCompteEns}>✅ Créer le compte</Btn>
            </div>
          </Modale>}

          {(modal==="add_ens"&&canCreate||(modal==="edit_ens"&&canEdit))&&<Modale titre={modal==="add_ens"?"Nouvel enseignant":"Modifier"} fermer={()=>setModal(null)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
              <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
              <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
              <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
              <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
              <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
                <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
              </Selec>
              <Input label="Prime horaire unique (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")} placeholder="Ex : 15000"/>
              <div style={{display:"flex",alignItems:"flex-end",paddingBottom:4}}>
                <span style={{fontSize:11,color:"#64748b",lineHeight:1.4}}>💡 Utilisée si aucune prime par classe n'est définie ci-dessous</span>
              </div>
            </div>
            {/* ── PRIMES PAR CLASSE ── */}
            <div style={{marginTop:14,borderTop:"1px solid #e2e8f0",paddingTop:12}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:8}}>
                Primes par classe <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>(si la prime varie selon la classe enseignée)</span>
              </div>
              {(form.primeParClasse||[]).map((entry,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                  <input value={entry.classe||""} placeholder="Classe (ex: 3ème Année A)"
                    onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],classe:e.target.value};return{...p,primeParClasse:arr};})}
                    style={{flex:2,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12}}/>
                  <input type="number" value={entry.prime||""} placeholder="Prime GNF"
                    onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],prime:Number(e.target.value)};return{...p,primeParClasse:arr};})}
                    style={{flex:1,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12}}/>
                  <Btn sm v="danger" onClick={()=>setForm(p=>({...p,primeParClasse:(p.primeParClasse||[]).filter((_,j)=>j!==i)}))}>×</Btn>
                </div>
              ))}
              <Btn sm v="ghost" onClick={()=>setForm(p=>({...p,primeParClasse:[...(p.primeParClasse||[]),{classe:"",prime:0}]}))}>+ Ajouter une classe</Btn>
            </div>
            <UploadFichiers dossier={`enseignants/${cleEns}`} fichiers={form.fichiers||[]}
              onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
              onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn onClick={()=>{if(modal==="add_ens")ajEns(form);else modEns(form);setModal(null);}}>Enregistrer</Btn>
            </div>
          </Modale>}
        </div>;
      })()}

      {/* ── NOTES ── */}
      {tab==="notes"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Notes ({notes.length})</strong>
          {/* Toggle vue */}
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:8,padding:3,gap:2}}>
            {[{v:"liste",icon:"☰"},{v:"grille",icon:"⊞"}].map(({v,icon})=>(
              <button key={v} onClick={()=>setNotesVue(v)} style={{
                padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
                background:notesVue===v?"#fff":"transparent",color:notesVue===v?C.blueDark:"#94a3b8",
                boxShadow:notesVue===v?"0 1px 3px rgba(0,0,0,0.1)":"none",
              }}>{icon}</button>
            ))}
          </div>
          <Btn sm v="ghost" onClick={()=>exportExcel(
            `Notes_${avecEns?"College":"Primaire"}`,
            ["Élève","Matière","Type","Période",`Note /${maxNote}`],
            notes.map(n=>[n.eleveNom,n.matiere,n.type,n.periode,n.note])
          )}>📥 Export</Btn>
          <Btn sm v="ghost" onClick={()=>exportExcel(`Modele_Notes`,
            ["Élève (Nom Prénom)","Matière","Type","Période",`Note (/${maxNote})`],
            eleves.slice(0,3).map(e=>[`${e.nom} ${e.prenom}`,matieres[0]?.nom||"Maths","Devoir","T1",Math.round(maxNote*0.7)])
          )}>📋 Modèle</Btn>
          {canCreate&&<Btn sm v="vert" onClick={()=>setModal("import_notes")}>⬆️ Importer</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({periode:"T1",type:"Devoir"});setModal("add_n");}}>+ Saisir</Btn>}
        </div>

        {/* ── VUE GRILLE ── */}
        {notesVue==="grille"&&(()=>{
          const classesUniqN = [...new Set(eleves.map(e=>e.classe||""))].filter(Boolean).sort();
          const elevesGrille = (grilleClasse==="all"?eleves:eleves.filter(e=>e.classe===grilleClasse))
            .filter(e=>e.statut==="Actif"||!e.statut)
            .sort((a,b)=>(a.nom+a.prenom).localeCompare(b.nom+b.prenom));
          // Filtre les matières selon la classe sélectionnée dans la grille
          const matieresCols = matieresForClasse(grilleClasse==="all"?null:grilleClasse).map(m=>m.nom);

          const getNoteExist = (eleveId, mat) =>
            notes.find(n=>(n.eleveId===eleveId||n.eleveNom)&&n.matiere===mat&&n.periode===grillePeriode&&n.type===grilleType);

          const valeurCellule = (eleveId, mat) => {
            const key = `${eleveId}|${mat}`;
            if(key in grilleChanges) return grilleChanges[key];
            return getNoteExist(eleveId, mat)?.note ?? "";
          };

          const couleurNote = (v) => {
            const n = Number(v);
            if(v===""||isNaN(n)) return {};
            if(n >= maxNote*0.7) return {background:"#dcfce7",color:"#166534"};
            if(n >= maxNote*0.5) return {background:"#fef3c7",color:"#92400e"};
            return {background:"#fee2e2",color:"#991b1b"};
          };

          const sauvegarderGrille = async() => {
            if(!Object.keys(grilleChanges).length){toast("Aucune modification.","info");return;}
            setGrilleSaving(true);
            let nb=0;
            for(const [key,val] of Object.entries(grilleChanges)){
              const [eleveId, ...matParts] = key.split("|");
              const mat = matParts.join("|");
              if(val===""||isNaN(Number(val))) continue;
              const exist = getNoteExist(eleveId, mat);
              const eleve = eleves.find(e=>e._id===eleveId);
              if(exist){ /* modifier */ await ajN({...exist,note:Number(val)}); }
              else { await ajN({eleveId,eleveNom:`${eleve?.nom||""} ${eleve?.prenom||""}`.trim(),matiere:mat,type:grilleType,periode:grillePeriode,note:Number(val)}); }
              nb++;
            }
            setGrilleChanges({});
            setGrilleSaving(false);
            toast(`${nb} note(s) enregistrée(s)`,"success");
          };

          return (
            <div>
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <select value={grilleClasse} onChange={e=>setGrilleClasse(e.target.value)}
                  style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                  <option value="all">Toutes classes</option>
                  {classesUniqN.map(c=><option key={c}>{c}</option>)}
                </select>
                <select value={grillePeriode} onChange={e=>setGrillePeriode(e.target.value)}
                  style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                  <option>T1</option><option>T2</option><option>T3</option>
                </select>
                <select value={grilleType} onChange={e=>setGrilleType(e.target.value)}
                  style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                  <option>Devoir</option><option>Interrogation</option><option>Examen</option><option>Composition</option>
                </select>
                {Object.keys(grilleChanges).length>0&&(
                  <Btn v="vert" sm disabled={grilleSaving} onClick={sauvegarderGrille}>
                    {grilleSaving?"Enregistrement…":`💾 Enregistrer (${Object.keys(grilleChanges).length} modif.)`}
                  </Btn>
                )}
                {Object.keys(grilleChanges).length>0&&(
                  <Btn v="ghost" sm onClick={()=>setGrilleChanges({})}>✕ Annuler</Btn>
                )}
              </div>
              {elevesGrille.length===0?<Vide icone="📝" msg="Aucun élève"/>:
              matieresCols.length===0?<Vide icone="📚" msg="Aucune matière définie"/>:
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                  <thead>
                    <tr style={{background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))"}}>
                      <th style={{padding:"8px 12px",textAlign:"left",color:"rgba(255,255,255,0.9)",fontSize:11,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap",minWidth:150}}>Élève</th>
                      {matieresCols.map(m=>(
                        <th key={m} style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.9)",fontSize:10,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap",borderLeft:"1px solid rgba(255,255,255,0.1)"}}>
                          {m}<div style={{fontSize:9,opacity:0.6,fontWeight:400}}>/{maxNote}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {elevesGrille.map((e,ri)=>{
                      const moy = matieresCols.reduce((s,m)=>{
                        const v=Number(valeurCellule(e._id,m));
                        return s+(isNaN(v)?0:v);
                      },0)/matieresCols.filter(m=>valeurCellule(e._id,m)!=="").length||0;
                      return (
                        <tr key={e._id} style={{background:ri%2===0?"#fff":"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                          <td style={{padding:"6px 12px",fontSize:12,fontWeight:700,color:C.blueDark,whiteSpace:"nowrap"}}>
                            {e.nom} {e.prenom}
                            <span style={{fontSize:10,color:"#94a3b8",marginLeft:6}}>{e.classe}</span>
                            {!isNaN(moy)&&moy>0&&<span style={{marginLeft:8,fontSize:11,fontWeight:900,...couleurNote(moy)}}>{moy.toFixed(1)}</span>}
                          </td>
                          {matieresCols.map(m=>{
                            const key=`${e._id}|${m}`;
                            const val=valeurCellule(e._id,m);
                            const modif=key in grilleChanges;
                            return (
                              <td key={m} style={{padding:"4px 6px",textAlign:"center",borderLeft:"1px solid #f1f5f9"}}>
                                {canCreate
                                  ?<input
                                    type="number" min="0" max={maxNote} step="0.25"
                                    value={val}
                                    onChange={ev=>setGrilleChanges(p=>({...p,[key]:ev.target.value}))}
                                    style={{
                                      width:54,textAlign:"center",border:`1.5px solid ${modif?"#f59e0b":"#e2e8f0"}`,
                                      borderRadius:6,padding:"3px 4px",fontSize:12,fontWeight:700,
                                      outline:"none",...couleurNote(val),
                                      background:modif?"#fffbeb":couleurNote(val).background||"#fff",
                                    }}
                                  />
                                  :<span style={{...couleurNote(val),padding:"2px 6px",borderRadius:6,fontSize:12,fontWeight:700}}>{val||"—"}</span>
                                }
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </div>
          );
        })()}
        {notesVue==="liste"&&(cN?<Chargement/>:notes.length===0?<Vide icone="📝" msg="Aucune note"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Élève","Matière","Type","Période",`Note /${maxNote}`,readOnly?"":"Action"]}/>
            <tbody>{notes.map(n=><TR key={n._id}>
              <TD bold>{n.eleveNom}</TD><TD>{n.matiere}</TD>
              <TD><Badge color="gray">{n.type}</Badge></TD><TD>{n.periode}</TD>
              <TD><Badge color={n.note>=(maxNote*0.7)?"vert":n.note>=(maxNote*0.5)?"blue":"red"}>{n.note}/{maxNote}</Badge></TD>
              {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supN(n._id);}}>Suppr.</Btn></TD>}
            </TR>)}</tbody>
          </table></Card>)}
        {modal==="import_notes"&&canCreate&&<Modale titre="⬆️ Importer des notes depuis Excel" fermer={()=>{setModal(null);setImportPreview(null);}} large>
          <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534"}}>
            <strong>Format attendu :</strong> colonnes <em>Élève (Nom Prénom) · Matière · Type · Période · Note</em><br/>
            Télécharge le modèle via le bouton "📋 Modèle" pour garantir le bon format.
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={async e=>{
            const file = e.target.files[0];
            if(!file) return;
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""}).slice(1); // skip header
            const lignes = rows.filter(r=>r[0]||r[1]).map((r,i)=>{
              const eleveNom = String(r[0]||"").trim();
              const matiere  = String(r[1]||"").trim();
              const type     = String(r[2]||"Devoir").trim();
              const periode  = String(r[3]||"T1").trim();
              const note     = Number(String(r[4]||"").replace(",","."));
              const eleve    = eleves.find(e=>`${e.nom} ${e.prenom}`.toLowerCase()===eleveNom.toLowerCase());
              const erreurs  = [];
              if(!eleveNom) erreurs.push("Élève manquant");
              else if(!eleve) erreurs.push("Élève introuvable");
              if(!matiere) erreurs.push("Matière manquante");
              if(isNaN(note)||note<0||note>maxNote) erreurs.push(`Note invalide (0–${maxNote})`);
              return { eleveNom, eleveId:eleve?._id, matiere, type, periode, note, erreurs, ligne:i+2 };
            });
            setImportPreview({ lignes, valides:lignes.filter(l=>!l.erreurs.length) });
          }} style={{marginBottom:12}}/>

          {importPreview&&<>
            <div style={{display:"flex",gap:12,marginBottom:10,fontSize:12}}>
              <span style={{color:"#059669",fontWeight:700}}>✅ {importPreview.valides.length} valides</span>
              <span style={{color:"#dc2626",fontWeight:700}}>❌ {importPreview.lignes.length-importPreview.valides.length} erreurs</span>
            </div>
            <div style={{maxHeight:300,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>L.</th>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Élève</th>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Matière</th>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Type</th>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Période</th>
                  <th style={{padding:"6px 8px",textAlign:"center",fontSize:10,color:"#64748b"}}>Note</th>
                  <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Statut</th>
                </tr></thead>
                <tbody>{importPreview.lignes.map((l,i)=>(
                  <tr key={i} style={{background:l.erreurs.length?"#fef2f2":"#f0fdf4",borderBottom:"1px solid #f1f5f9"}}>
                    <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10}}>{l.ligne}</td>
                    <td style={{padding:"4px 8px",fontWeight:600}}>{l.eleveNom||"—"}</td>
                    <td style={{padding:"4px 8px"}}>{l.matiere||"—"}</td>
                    <td style={{padding:"4px 8px"}}>{l.type}</td>
                    <td style={{padding:"4px 8px"}}>{l.periode}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",fontWeight:700}}>{isNaN(l.note)?"—":l.note}</td>
                    <td style={{padding:"4px 8px"}}>
                      {l.erreurs.length
                        ?<span style={{color:"#dc2626",fontSize:10}}>⚠️ {l.erreurs.join(", ")}</span>
                        :<span style={{color:"#059669",fontSize:10}}>✅</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>{setModal(null);setImportPreview(null);}}>Annuler</Btn>
            {importPreview?.valides.length>0&&<Btn v="vert" disabled={importEnCours} onClick={async()=>{
              setImportEnCours(true);
              let count=0;
              for(const l of importPreview.valides){
                await ajN({eleveNom:l.eleveNom,eleveId:l.eleveId,matiere:l.matiere,type:l.type,periode:l.periode,note:l.note});
                count++;
              }
              setImportEnCours(false);
              setModal(null);
              setImportPreview(null);
              toast(`${count} note(s) importée(s) avec succès`,"success");
            }}>{importEnCours?"Import en cours…":`⬆️ Importer ${importPreview.valides.length} note(s)`}</Btn>}
          </div>
        </Modale>}

        {modal==="add_n"&&canCreate&&<Modale titre="Saisir une note" fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <Selec label="Élève" value={form.eleveNom||""} onChange={e=>{
                const el=eleves.find(ev=>`${ev.nom} ${ev.prenom}`===e.target.value);
                setForm(p=>({...p,eleveNom:e.target.value,eleveId:el?._id}));
              }}>
                <option value="">— Sélectionner —</option>
                {eleves.map(e=><option key={e._id}>{e.nom} {e.prenom}</option>)}
              </Selec>
            </div>
            <Selec label="Matière" value={form.matiere||""} onChange={chg("matiere")}>
              <option value="">—</option>
              {(()=>{
                const eleveSelec=eleves.find(e=>`${e.nom} ${e.prenom}`===form.eleveNom);
                return matieresForClasse(eleveSelec?.classe).map(m=><option key={m._id}>{m.nom}</option>);
              })()}
            </Selec>
            <Selec label="Type" value={form.type||"Devoir"} onChange={chg("type")}>
              <option>Devoir</option><option>Interrogation</option><option>Examen</option><option>Composition</option>
            </Selec>
            <Input label={`Note (/${maxNote})`} type="number" min="0" max={maxNote} step="0.25" value={form.note||""} onChange={chg("note")}/>
            <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}>
              <option>T1</option><option>T2</option><option>T3</option>
            </Selec>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{ajN({...form,note:Number(form.note)});setModal(null);}}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ENSEIGNEMENTS ── */}
      {tab==="enseignements"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Gestion des Enseignements ({enseignements.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({type:"Cours",statut:"Effectué"});setModal("add_eng");}}>+ Enregistrer</Btn>}
        </div>

        {/* Stats rapides */}
        {enseignements.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
          {[
            {label:"Cours effectués",val:enseignements.filter(e=>e.statut==="Effectué").length,bg:"#eaf4e0",c:C.greenDk},
            {label:"Absences enseignants",val:enseignements.filter(e=>e.statut==="Absent").length,bg:"#fce8e8",c:"#b91c1c"},
            {label:"Retards",val:enseignements.filter(e=>e.statut==="Retard").length,bg:"#fef3e0",c:"#d97706"},
            {label:"Cours non effectués",val:enseignements.filter(e=>e.statut==="Non effectué").length,bg:"#e6f4ea",c:C.blue},
          ].map(s=><div key={s.label} style={{background:s.bg,borderRadius:9,padding:"10px 14px",border:"1px solid #e8eaed"}}>
            <p style={{fontSize:10,fontWeight:700,color:s.c,textTransform:"uppercase",margin:"0 0 2px",letterSpacing:"0.06em"}}>{s.label}</p>
            <p style={{fontSize:22,fontWeight:800,color:s.c,margin:0}}>{s.val}</p>
          </div>)}
        </div>}

        {cEng?<Chargement/>:enseignements.length===0?<Vide icone="📚" msg="Aucun enseignement enregistré"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Enseignant","Matière","Classe","Date","Heure","Type","Statut","Observation",canEdit?"Actions":""]}/>
            <tbody>{enseignements.sort((a,b)=>b.date>a.date?1:-1).map(e=><TR key={e._id}>
              <TD bold>{e.enseignantNom}</TD>
              <TD>{e.matiere}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD>{e.date}</TD>
              <TD>{e.heure||"—"}</TD>
              <TD><Badge color="gray">{e.type}</Badge></TD>
              <TD><Badge color={
                e.statut==="Effectué"?"vert":
                e.statut==="Absent"?"red":
                e.statut==="Retard"?"amber":"purple"
              }>{e.statut}</Badge></TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.observation||"—"}</span></TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_eng");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEng(e._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {(modal==="add_eng"&&canCreate||(modal==="edit_eng"&&canEdit))&&<Modale titre={modal==="add_eng"?"Enregistrer un enseignement":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <Selec label="Enseignant" value={form.enseignantNom||""} onChange={chg("enseignantNom")}>
                <option value="">— Sélectionner —</option>
                {ens.map(e=><option key={e._id}>{e.prenom} {e.nom}</option>)}
              </Selec>
            </div>
            <Selec label="Matière" value={form.matiere||""} onChange={chg("matiere")}>
              <option value="">—</option>
              {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
            </Selec>
            <Selec label="Classe" value={form.classe||""} onChange={chg("classe")}>
              <option value="">—</option>
              {classes.map(c=><option key={c._id}>{c.nom}</option>)}
            </Selec>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Input label="Heure" type="time" value={form.heure||""} onChange={chg("heure")}/>
            <Selec label="Type" value={form.type||"Cours"} onChange={chg("type")}>
              <option>Cours</option>
              <option>Composition</option>
              <option>Devoir surveillé</option>
              <option>Correction</option>
            </Selec>
            <Selec label="Statut" value={form.statut||"Effectué"} onChange={chg("statut")}>
              <option>Effectué</option>
              <option>Absent</option>
              <option>Retard</option>
              <option>Non effectué</option>
            </Selec>
            <div style={{gridColumn:"1/-1"}}><Textarea label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              const r={...form,date:form.date||today()};
              if(modal==="add_eng")ajEng(r);else modEng(r);
              setModal(null);
            }}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── DISCIPLINE ── */}
      {tab==="discipline"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Discipline & Absences ({absences.length})</strong>
          <Btn sm v="ghost" onClick={()=>exportExcel(
            `Discipline_${avecEns?"College":"Primaire"}`,
            ["Élève","Classe","Type","Date","Motif","Justifié"],
            absences.map(a=>[a.eleveNom,a.classe,a.type,a.date,a.motif||"",a.justifie])
          )}>📥 Export Excel</Btn>
          {canCreate&&<Btn onClick={()=>{setForm({type:"Absence",justifie:"Non"});setModal("add_abs");}}>+ Enregistrer</Btn>}
        </div>
        {(()=>{
          const elevesAlerte=eleves.map(e=>({
            ...e,
            nbAbs:absences.filter(a=>a.eleveNom===`${e.nom} ${e.prenom}`&&a.type==="Absence"&&a.justifie==="Non").length
          })).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs);
          return elevesAlerte.length>0?(
            <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>⚠️</span>
                <strong style={{fontSize:13,color:"#92400e"}}>Alertes absences — {elevesAlerte.length} élève(s) avec 3 absences non justifiées ou plus</strong>
                <Btn sm v="ghost" style={{marginLeft:"auto"}} onClick={()=>exportExcel(
                  "Alertes_Absences",
                  ["Nom","Prénom","Classe","Nb absences non justifiées","Tuteur","Contact"],
                  elevesAlerte.map(e=>[e.nom,e.prenom,e.classe,e.nbAbs,e.tuteur||"",e.contactTuteur||""])
                )}>📥 Exporter</Btn>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {elevesAlerte.map(e=>(
                  <div key={e._id} style={{background:"#fff",border:"1px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                    <span style={{fontWeight:800,color:"#92400e"}}>{e.nom} {e.prenom}</span>
                    <span style={{color:"#6b7280"}}> · {e.classe} · </span>
                    <Badge color="amber">{e.nbAbs} absences</Badge>
                  </div>
                ))}
              </div>
            </div>
          ):null;
        })()}
        {cAbs?<Chargement/>:absences.length===0?<Vide icone="📋" msg="Aucun événement de discipline enregistré"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Élève","Classe","Type","Date","Motif","Justifié",canEdit?"Action":""]}/>
            <tbody>{absences.map(a=><TR key={a._id}>
              <TD bold>{a.eleveNom}</TD><TD>{a.classe}</TD>
              <TD><Badge color={a.type==="Absence"?"red":a.type==="Retard"?"amber":"orange"}>{a.type}</Badge></TD>
              <TD>{a.date}</TD><TD>{a.motif||"—"}</TD>
              <TD><Badge color={a.justifie==="Oui"?"vert":"red"}>{a.justifie}</Badge></TD>
              {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supAbs(a._id);}}>Suppr.</Btn></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {modal==="add_abs"&&canCreate&&<Modale titre="Enregistrer un événement disciplinaire" fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <Selec label="Élève" value={form.eleveNom||""} onChange={e=>{
                const el=eleves.find(ev=>`${ev.nom} ${ev.prenom}`===e.target.value);
                setForm(p=>({...p,eleveNom:e.target.value,classe:el?.classe||""}));
              }}>
                <option value="">— Sélectionner —</option>
                {eleves.map(e=><option key={e._id}>{e.nom} {e.prenom}</option>)}
              </Selec>
            </div>
            <Selec label="Type" value={form.type||"Absence"} onChange={chg("type")}>
              <option>Absence</option><option>Retard</option><option>Sanction</option><option>Avertissement</option><option>Renvoi temporaire</option>
            </Selec>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Selec label="Justifié ?" value={form.justifie||"Non"} onChange={chg("justifie")}>
              <option>Non</option><option>Oui</option>
            </Selec>
            <div style={{gridColumn:"1/-1"}}><Textarea label="Motif / Description" value={form.motif||""} onChange={chg("motif")}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="orange" onClick={async()=>{
              const abs={...form,date:form.date||today()};
              await ajAbs(abs);
              setModal(null);
              envoyerPush(
                ["parent"],
                `⚠️ ${abs.type||"Absence"} signalée`,
                `${abs.eleveNom||"Votre enfant"} — ${abs.type||"Absence"} du ${abs.date}${abs.motif?` : ${abs.motif}`:""}`,
                "/absences"
              );
            }}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── BULLETINS ── */}
      {tab==="bulletins"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Bulletins de notes</strong>
          <input placeholder="🔍 Recherche par matricule..."
            value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
          <select value={periodeB} onChange={e=>setPeriodeB(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option>T1</option><option>T2</option><option>T3</option>
          </select>
          <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {classesUniq.map(c=><option key={c}>{c}</option>)}
          </select>
          <Btn v="success" onClick={()=>{
            const elevesC=(filtreClasse==="all"?elevesFiltres:elevesFiltres.filter(e=>e.classe===filtreClasse))
              .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
            imprimerFicheCompositions(filtreClasse,periodeB,notes,matieres,elevesC,maxNote,schoolInfo);
          }}>
            🏆 Résultats des évaluations
          </Btn>
          <Btn v="vert" onClick={()=>{
            const elevesB=elevesFiltres
              .filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()))
              .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
            imprimerBulletinsGroupes(elevesB,notes,matieres,periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,filtreClasse==="all"?"Toutes classes":filtreClasse,matieresForClasse);
          }}>
            📄 Tous les bulletins {filtreClasse!=="all"?`— ${filtreClasse}`:""}
          </Btn>
        </div>
        {(()=>{
          const elevesB=elevesFiltres.filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
          return elevesB.length===0?<Vide icone="📊" msg="Aucun élève pour cette sélection"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Matricule","Élève","Classe","Moy. Générale","Mention","Bulletin"]}/>
            <tbody>{elevesB.map(e=>{
              const notesE=notes.filter(n=>n.eleveId===e._id&&n.periode===periodeB);
              let moy=0,totC=0;
              matieresForClasse(e.classe).forEach(mat=>{
                const coef=mat.coefficient||1;
                totC+=coef; // toutes les matières comptent au dénominateur
                const nm=notesE.filter(n=>n.matiere===mat.nom);
                if(nm.length){const m=nm.reduce((s,n)=>s+Number(n.note),0)/nm.length;moy+=m*coef;}
              });
              const moyGene=totC>0?(moy/totC).toFixed(2):"—";
              const mention=moyGene==="—"?"—":Number(moyGene)>=16?"Très Bien":Number(moyGene)>=14?"Bien":Number(moyGene)>=12?"Assez Bien":Number(moyGene)>=10?"Passable":"Insuffisant";
              const eleveImpayeBloq = !!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0;
              return <TR key={e._id}>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
                <TD bold>{e.nom} {e.prenom}</TD>
                <TD><Badge color="blue">{e.classe}</Badge></TD>
                <TD><span style={{fontWeight:800,fontSize:14,color:moyGene!=="—"&&Number(moyGene)>=10?C.greenDk:"#b91c1c"}}>{moyGene}/20</span></TD>
                <TD><Badge color={mention==="Très Bien"||mention==="Bien"?"vert":mention==="Assez Bien"||mention==="Passable"?"blue":"red"}>{mention}</Badge></TD>
                <TD>{eleveImpayeBloq
                  ? <span title="Frais impayés — impression bloquée" style={{fontSize:18}}>🔒</span>
                  : <Btn sm v="amber" onClick={()=>imprimerBulletin(e,notes,matieresForClasse(e.classe),periodeB,avecEns?"college":"primaire",maxNote,schoolInfo)}>🖨️ Imprimer</Btn>
                }</TD>
              </TR>;
            })}</tbody>
          </table></Card>;
        })()}
      </div>}

      {/* ── LIVRETS ── */}
      {tab==="livrets"&&<LivretsTab
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {tab==="matieres"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Matières et coefficients ({matieres.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({coefficient:1});setModal("add_mat");}}>+ Ajouter</Btn>}
        </div>
        {canCreate&&matieres.length===0&&matieresPredefinies.length>0&&<div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:16}}>💡</span>
          <span style={{fontSize:13,color:"#166534",flex:1}}>Des matières prédéfinies sont disponibles pour ce niveau.</span>
          <Btn v="success" onClick={()=>matieresPredefinies.forEach(m=>ajMat(m))}>✅ Initialiser les matières</Btn>
        </div>}
        {/* Légende */}
        <div style={{background:"#f0f7ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
          💡 Si une matière n'est assignée à <strong>aucune classe</strong>, elle apparaît dans <strong>toutes les classes</strong>. Sinon, elle n'apparaît que dans les classes sélectionnées.
        </div>
        {cMat?<Chargement/>:matieres.length===0?<Vide icone="📚" msg="Ajoutez les matières pour calculer les bulletins"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Matière","Coefficient","Classes concernées",canEdit?"Actions":""]}/>
            <tbody>{matieres.map(m=><TR key={m._id}>
              <TD bold>{m.nom}</TD>
              <TD><Badge color="blue">Coef. {m.coefficient}</Badge></TD>
              <TD>
                {!m.classes||!m.classes.length
                  ? <span style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>Toutes les classes</span>
                  : <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {m.classes.map(c=><span key={c} style={{background:"#ede9fe",color:"#6d28d9",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700}}>{c}</span>)}
                    </div>}
              </TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...m,classesEdit:[...(m.classes||[])]});setModal("edit_mat_"+m._id);}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supMat(m._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {/* Modal ajout matière */}
        {modal==="add_mat"&&canCreate&&<Modale titre="Nouvelle matière" fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <Input label="Nom de la matière" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
              Classes (laisser vide = toutes les classes)
            </label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {classes.map(c=>{
                const sel=(form.classesEdit||[]).includes(c.nom);
                return <button key={c._id} type="button"
                  onClick={()=>setForm(p=>({...p,classesEdit:sel?(p.classesEdit||[]).filter(x=>x!==c.nom):[...(p.classesEdit||[]),c.nom]}))}
                  style={{padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#8b5cf6":"#e5e7eb"}`,
                    background:sel?"#ede9fe":"#f9fafb",color:sel?"#6d28d9":"#6b7280",
                    fontWeight:sel?700:400,fontSize:12,cursor:"pointer"}}>
                  {c.nom}
                </button>;
              })}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{ajMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[]});setModal(null);}}>Enregistrer</Btn>
          </div>
        </Modale>}

        {/* Modal modification matière (classes assignées) */}
        {modal&&modal.startsWith("edit_mat_")&&canEdit&&(()=>{
          const matId=modal.replace("edit_mat_","");
          const mat=matieres.find(m=>m._id===matId);
          if(!mat)return null;
          return <Modale titre={`Modifier — ${mat.nom}`} fermer={()=>setModal(null)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
              <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
                Classes concernées (laisser vide = toutes les classes)
              </label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {classes.map(c=>{
                  const sel=(form.classesEdit||[]).includes(c.nom);
                  return <button key={c._id} type="button"
                    onClick={()=>setForm(p=>({...p,classesEdit:sel?(p.classesEdit||[]).filter(x=>x!==c.nom):[...(p.classesEdit||[]),c.nom]}))}
                    style={{padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#8b5cf6":"#e5e7eb"}`,
                      background:sel?"#ede9fe":"#f9fafb",color:sel?"#6d28d9":"#6b7280",
                      fontWeight:sel?700:400,fontSize:12,cursor:"pointer"}}>
                    {c.nom}
                  </button>;
                })}
              </div>
              {!(form.classesEdit||[]).length&&<p style={{margin:"8px 0 0",fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Aucune sélection → s'applique à toutes les classes</p>}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn onClick={()=>{
                modMat ? modMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[],_id:matId}) : null;
                setModal(null);
              }}>💾 Enregistrer</Btn>
            </div>
          </Modale>;
        })()}
      </div>}

      {/* ── EMPLOIS DU TEMPS — GRILLE VISUELLE ── */}
      {tab==="emploidutemps"&&avecEns&&(()=>{
        const JOURS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
        const genTranches=(step)=>{
          const [sh,sm]=(edtHeureDebut||"08:00").split(":").map(Number);
          const [eh,em]=(edtHeureFin||"14:00").split(":").map(Number);
          const t=[];let h=sh,m=sm;
          while(h*60+m<=eh*60+em){t.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));m+=step;h+=Math.floor(m/60);m=m%60;}
          return t;
        };
        const duree=maxNote===10?edtDuree:120; // secondaire toujours 2h
        const TRANCHES=genTranches(duree);
        const COULEURS=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
        // ── Tri des classes par niveau scolaire ──
        const NIVEAUX_ORDER=[
          "maternelle","ps","ms","gs","petite section","moyenne section","grande section",
          "cp","cp1","cp2",
          "ce","ce1","ce2",
          "cm","cm1","cm2",
          "6ème","6e","6","6eme",
          "5ème","5e","5","5eme",
          "4ème","4e","4","4eme",
          "3ème","3e","3","3eme",
          "7ème","7e","7","7eme",
          "8ème","8e","8","8eme",
          "9ème","9e","9","9eme",
          "10ème","10e","10","10eme",
          "11ème","11e","11","11eme",
          "seconde","2nde","2nd",
          "12ème","12e","12","12eme",
          "première","premiere","1ère","1ere",
          "13ème","13e","13","13eme",
          "terminale","tle","term",
        ];
        const niveauRank=(nom)=>{
          const n=(nom||"").toLowerCase().trim();
          const idx=NIVEAUX_ORDER.findIndex(o=>n===o||n.startsWith(o+" ")||n.startsWith(o+"-")||n.startsWith(o+"_"));
          if(idx>=0)return idx*10;
          const m=n.match(/^(\d+)/);
          if(m)return 500+parseInt(m[1]);
          return 999;
        };
        const classesTriees=[...classes].sort((a,b)=>niveauRank(a.nom)-niveauRank(b.nom));
        const classeEdtActuelle = filtreClasse==="all"&&classesTriees.length>0 ? classesTriees[0].nom : filtreClasse;
        const matCouleur={};
        matieres.forEach((m,i)=>{matCouleur[m.nom]=COULEURS[i%COULEURS.length];});
        // Lookup enseignant par nom stocké (supporte ancien format "Prénom Nom (matière)" et nouveau "Prénom Nom")
        const findEns=(nomStr)=>ens.find(e=>{
          if(!nomStr)return false;
          const full=`${e.prenom||""} ${e.nom||""}`.trim();
          return nomStr===full||nomStr.startsWith(full+" (");
        });
        // Nom affiché sans la partie "(matière)" si présente
        const affNom=(nomStr)=>nomStr?nomStr.replace(/\s*\([^)]*\)$/,""):"";
        const emploisClasse=emplois.filter(e=>e.classe===classeEdtActuelle);
        const getCreneau=(jour,hd)=>emploisClasse.find(e=>e.jour===jour&&e.heureDebut===hd);
        const imprimerEDT=()=>{
          const couleursBg=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
          const allMat=[...new Set(emploisClasse.map(e=>e.matiere).filter(Boolean))];
          const mc={};allMat.forEach((m,i)=>{mc[m]=couleursBg[i%couleursBg.length];});
          const getCr=(jour,hd)=>emploisClasse.find(e=>e.jour===jour&&e.heureDebut===hd);
          const ths=JOURS.map(j=>"<th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;text-align:center;min-width:80px'>"+j+"</th>").join("");
          const rows=TRANCHES.slice(0,-1).map((_,i)=>{
            const hd=TRANCHES[i],hf=TRANCHES[i+1];
            const tds=JOURS.map(jour=>{
              const cr=getCr(jour,hd);
              if(!cr)return "<td style='background:#fafcff;border:1px solid #e2e8f0;padding:6px'></td>";
              const isRev=cr.type==="revision";
              const bg=isRev?"#fff7ed":(mc[cr.matiere]||"#e0ebf8");
              const borderColor=isRev?"#fdba74":"#e2e8f0";
              const ensObj=findEns(cr.enseignant);
              return "<td style='background:"+bg+";border:1px solid "+borderColor+";padding:6px;vertical-align:top'>"
                +(isRev?"<span style='background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-block;margin-bottom:2px'>RÉV</span><br>":"")
                +"<b style='font-size:11px;color:"+(isRev?"#9a3412":"#1e3a5f")+";display:block'>"+cr.matiere+"</b>"
                +(cr.enseignant?"<span style='font-size:10px;color:#475569'>"+affNom(cr.enseignant)+"</span>":"")
                +(ensObj?.telephone?"<br><span style='font-size:9px;color:#00876a;font-weight:600'>"+ensObj.telephone+"</span>":"")
                +(cr.salle?"<br><span style='font-size:9px;color:#94a3b8'>📍"+cr.salle+"</span>":"")
                +"</td>";
            }).join("");
            return "<tr><td style='background:#f0f4f8;font-weight:700;font-size:11px;color:#0A1628;padding:7px 10px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap'>"+hd.slice(0,5)+"–"+hf.slice(0,5)+"</td>"+tds+"</tr>";
          }).join("");
          const w=window.open("","_blank");
          w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT "+classeEdtActuelle+"</title>"
            +"<style>body{font-family:Arial,sans-serif;padding:30px;font-size:12px}h2{color:#0A1628;text-align:center;margin-bottom:12px}"
            +"table{width:100%;border-collapse:collapse}@media print{body{padding:10px}}</style></head><body>"
            +enteteDoc(schoolInfo,schoolInfo.logo)
            +"<h2>Emploi du temps — "+classeEdtActuelle+"</h2>"
            +"<table><thead><tr><th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;width:80px'>Horaire</th>"+ths+"</tr></thead>"
            +"<tbody>"+rows+"</tbody></table>"
            +"<scri"+"pt>window.onload=()=>window.print();</scri"+"pt></body></html>");
          w.document.close();
        };
        const copierEDT=()=>{
          const cibles=classes.filter(c=>c.nom!==classeEdtActuelle);
          if(!cibles.length){toast("Aucune autre classe.","warning");return;}
          const dest=window.prompt("Copier l'EDT de \""+classeEdtActuelle+"\" vers quelle classe ?\n"+cibles.map(c=>c.nom).join(", "));
          if(!dest||!classes.find(c=>c.nom===dest)){toast("Classe introuvable.","error");return;}
          const aSupp=emplois.filter(e=>e.classe===dest);
          Promise.all(aSupp.map(e=>supEmp(e._id))).then(()=>{
            emploisClasse.forEach(e=>ajEmp({...e,classe:dest,_id:undefined}));
            toast("EDT copié vers "+dest,"success");
          });
        };

        // ── EDT GÉNÉRAL : Col1=Classes · Col2=Horaires (3 sous-lignes, 4 pour le 10ème) · Col3-8=Jours ──
        // Sous-lignes : 0=Matière 1=Enseignant 2=Salle (3ème slot=4ème sous-ligne vide de séparation)
        const SOUS_LABELS=["Matière","Enseignant","Salle"];
        const nbTranches=TRANCHES.length-1;
        const nbSousLignes=(ti)=>ti===9?4:3; // 10ème créneau (index 9) → 4 sous-lignes
        const totalLignesClasse=()=>{let t=0;for(let i=0;i<nbTranches;i++)t+=nbSousLignes(i);return t;};

        // ── version HTML pour impression ──
        const getEdtGeneralHTML=()=>{
          const couleursBg=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
          const allMat=[...new Set(emplois.map(e=>e.matiere).filter(Boolean))];
          const mc={};allMat.forEach((m,i)=>{mc[m]=couleursBg[i%couleursBg.length];});
          const ths=JOURS.map(j=>"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;text-align:center;min-width:90px'>"+j+"</th>").join("");
          const subLabelStyle="background:#f8fafc;color:#94a3b8;font-size:9px;padding:2px 6px;text-align:right;border:1px solid #e8edf2;white-space:nowrap;font-style:italic";
          const hrStyle="background:#f0f4f8;font-weight:800;font-size:11px;color:#0A1628;padding:5px 7px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap;vertical-align:middle";
          const clsStyle="background:#0A1628;color:#00C48C;font-weight:800;font-size:12px;text-align:center;padding:6px 8px;border:2px solid #0A1628;vertical-align:middle;writing-mode:horizontal-tb";
          let tbody="";
          classesTriees.forEach(cl=>{
            const total=totalLignesClasse();
            let firstRowOfClass=true;
            for(let ti=0;ti<nbTranches;ti++){
              const hd=TRANCHES[ti],hf=TRANCHES[ti+1];
              const ns=nbSousLignes(ti);
              for(let si=0;si<ns;si++){
                const isLastSub=si===ns-1;
                const isLastSlot=ti===nbTranches-1;
                const borderB=isLastSub?(isLastSlot?"3px solid #0A1628":"2px solid #b0c4d8"):"1px solid #f0f4f8";
                let row="<tr>";
                if(firstRowOfClass&&si===0){row+="<td rowspan='"+total+"' style='"+clsStyle+"'>"+cl.nom+"</td>";firstRowOfClass=false;}
                if(si===0)row+="<td rowspan='"+ns+"' style='"+hrStyle+"'>"+hd.slice(0,5)+"<br>"+hf.slice(0,5)+"</td>";
                row+="<td style='"+subLabelStyle+";border-bottom:"+borderB+"'>"+(SOUS_LABELS[si]||"")+"</td>";
                JOURS.forEach(jour=>{
                  const cr=emplois.find(e=>e.classe===cl.nom&&e.jour===jour&&e.heureDebut===hd);
                  const bg=cr?(mc[cr.matiere]||"#e0ebf8"):"#fff";
                  let val="";
                  if(cr){
                    if(si===0)val="<b>"+cr.matiere+"</b>";
                    else if(si===1){
                      const ensObj=findEns(cr.enseignant);
                      val=affNom(cr.enseignant||"")+(ensObj?.telephone?"<br><span style='font-size:9px;color:#00876a;font-weight:600'>"+ensObj.telephone+"</span>":"");
                    }
                    else if(si===2)val=cr.salle||"";
                  }
                  row+="<td style='background:"+bg+";border:1px solid #e2e8f0;border-bottom:"+borderB+";padding:2px 5px;font-size:10px;text-align:center;vertical-align:middle'>"+val+"</td>";
                });
                row+="</tr>";
                tbody+=row;
              }
            }
          });
          return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT G\u00e9n\u00e9ral</title>"
            +"<style>body{font-family:Arial,sans-serif;padding:15px;font-size:11px;color:#0A1628}"
            +"h2{text-align:center;font-size:14px;margin-bottom:10px}"
            +"table{width:100%;border-collapse:collapse}"
            +"@media print{.no-print{display:none}body{padding:8px}}</style></head><body>"
            +enteteDoc(schoolInfo,schoolInfo.logo)
            +"<h2>Emploi du Temps G\u00e9n\u00e9ral</h2>"
            +"<div class='no-print' style='text-align:center;margin-bottom:12px'>"
            +"<button onclick='window.print()' style='background:#0A1628;color:#fff;border:none;padding:7px 22px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:700'>🖨️ Imprimer</button></div>"
            +"<table><thead><tr>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:70px'>Classes</th>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:60px'>Horaires</th>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:10px;min-width:50px'></th>"
            +ths
            +"</tr></thead><tbody>"+tbody+"</tbody></table>"
            +"<scri"+"pt>window.onload=()=>window.print();</script></body></html>";
        };
        const voirEdtGeneral=()=>{
          const w=window.open("","_blank");
          w.document.write(getEdtGeneralHTML());
          w.document.close();
        };

        return <div>
        {/* ── TOOLBAR ── */}
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,marginRight:4}}>Emploi du temps</strong>
          <select value={classeEdtActuelle} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",fontWeight:700,color:C.blueDark}}>
            {classesTriees.map(c=><option key={c._id} value={c.nom}>{c.nom}</option>)}
          </select>
          <Btn sm v={edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(true)}>📅 Grille</Btn>
          <Btn sm v={!edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(false)}>☰ Liste</Btn>
          {maxNote===10
            ? <select value={edtDuree} onChange={e=>setEdtDuree(Number(e.target.value))}
                title="Durée des rubriques"
                style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"5px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
                <option value={30}>Rubriques 30 min</option>
                <option value={45}>Rubriques 45 min</option>
                <option value={60}>Rubriques 1 h</option>
              </select>
            : <span style={{fontSize:11,color:"#9ca3af",padding:"4px 8px",background:"#f8fafc",borderRadius:6,border:"1px solid #e2e8f0"}}>⏱ Séances 2h</span>
          }
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
            De <input type="time" value={edtHeureDebut} onChange={e=>setEdtHeureDebut(e.target.value)}
              style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
            à <input type="time" value={edtHeureFin} onChange={e=>setEdtHeureFin(e.target.value)}
              style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
          </label>
          {canCreate&&<Btn sm v="vert" onClick={copierEDT}>📋 Copier vers…</Btn>}
          {classeEdtActuelle!=="all"&&<Btn sm v="ghost" onClick={imprimerEDT}>🖨️ Imprimer</Btn>}
          <Btn sm v="blue" onClick={()=>setEdtGeneralOuvert(true)}>📊 EDT Général</Btn>
        </div>

        {classes.length===0
          ? <Vide icone="📅" msg="Créez d'abord des classes"/>
          : cEmp ? <Chargement/>
          : edtVueGrille ? (
          /* ── VUE GRILLE ── */
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",minWidth:700,width:"100%",fontSize:12}}>
              <thead>
                <tr>
                  <th style={{background:C.blueDark,color:"#fff",padding:"8px 10px",width:72,fontSize:11}}>Horaire</th>
                  {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"8px 10px",textAlign:"center",fontSize:11,fontWeight:700}}>{j}</th>)}
                </tr>
              </thead>
              <tbody>
                {TRANCHES.slice(0,-1).map((hd,i)=>{
                  const hf=TRANCHES[i+1];
                  return <tr key={hd}>
                    <td style={{padding:"6px 8px",background:"#f0f4f8",fontWeight:700,fontSize:11,color:C.blueDark,textAlign:"center",borderBottom:"1px solid #e2e8f0",whiteSpace:"nowrap"}}>
                      {hd.slice(0,5)}–{hf.slice(0,5)}
                    </td>
                    {JOURS.map(jour=>{
                      const cr=getCreneau(jour,hd);
                      const conflit=cr&&emplois.some(x=>x._id!==cr._id&&x.enseignant&&x.enseignant===cr.enseignant&&x.jour===jour&&x.heureDebut===hd);
                      return <td key={jour}
                        onClick={()=>{
                          if(!canCreate&&!canEdit)return;
                          if(cr){setForm({...cr});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:cr});}
                          else{setForm({classe:classeEdtActuelle,jour,heureDebut:hd,heureFin:hf,matiere:"",enseignant:"",salle:""});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:null});}
                        }}
                        style={{
                          padding:"4px 5px",border:`1px solid ${cr?.type==="revision"?"#fdba74":"#e2e8f0"}`,
                          cursor:canCreate||canEdit?"pointer":"default",
                          background:cr?(cr.type==="revision"?"#fff7ed":matCouleur[cr.matiere]||"#e0ebf8"):"#fafcff",
                          minWidth:90,verticalAlign:"top",position:"relative",
                          transition:"filter .15s",
                        }}>
                        {cr ? <>
                          {conflit&&<span title="Conflit enseignant" style={{position:"absolute",top:2,right:3,fontSize:10}}>⚠️</span>}
                          {cr.type==="revision"&&<span style={{position:"absolute",top:2,left:3,background:"#f97316",color:"#fff",fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:3,lineHeight:1.4}}>RÉV</span>}
                          <div style={{fontWeight:800,fontSize:11,color:cr.type==="revision"?"#9a3412":"#1e3a5f",lineHeight:1.3,marginTop:cr.type==="revision"?10:0}}>{cr.matiere||"—"}</div>
                          {cr.enseignant&&(()=>{
                            const e=findEns(cr.enseignant);
                            return <div style={{fontSize:10,color:"#475569",marginTop:1}}>
                              <div>{affNom(cr.enseignant)}</div>
                              {e?.telephone&&<div style={{fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</div>}
                            </div>;
                          })()}
                          {cr.salle&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>📍{cr.salle}</div>}
                        </> : (canCreate&&<div style={{fontSize:18,color:"#c7d7e9",textAlign:"center",lineHeight:"40px"}}>+</div>)}
                      </td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
            <p style={{fontSize:11,color:"#9ca3af",marginTop:8}}>💡 Cliquez sur une cellule pour ajouter ou modifier un créneau</p>
          </div>
        ) : (
          /* ── VUE LISTE (groupée par jour, sans répétition) ── */
          emploisClasse.length===0
            ? <Vide icone="📅" msg="Aucun créneau pour cette classe"/>
            : <Card style={{padding:0,overflow:"hidden"}}>{(()=>{
                const lignes=[...emploisClasse].sort((a,b)=>JOURS.indexOf(a.jour)-JOURS.indexOf(b.jour)||(a.heureDebut||"").localeCompare(b.heureDebut||""));
                const rows=[];let dernierJour=null;
                lignes.forEach(e=>{
                  const jourChange=e.jour!==dernierJour;
                  dernierJour=e.jour;
                  rows.push(<TR key={e._id}>
                    {jourChange
                      ? <TD bold style={{background:"#f0f4f8",verticalAlign:"top",whiteSpace:"nowrap",borderRight:"2px solid #e2e8f0"}}>{e.jour}</TD>
                      : <td style={{background:"#f8fafc",borderRight:"2px solid #e2e8f0",borderBottom:"1px solid #f1f5f9"}}></td>}
                    <TD style={{whiteSpace:"nowrap"}}>{e.heureDebut} – {e.heureFin}</TD>
                    <TD>
                      <span style={{background:e.type==="revision"?"#fff7ed":matCouleur[e.matiere]||"#e0ebf8",
                        border:e.type==="revision"?"1px solid #fdba74":"none",
                        padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,
                        color:e.type==="revision"?"#9a3412":"inherit"}}>
                        {e.matiere||"—"}
                      </span>
                    </TD>
                    <TD>
                      {e.type==="revision"
                        ? <span style={{background:"#fff7ed",border:"1px solid #fdba74",color:"#9a3412",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>
                            📝 Révision
                          </span>
                        : <span style={{color:"#9ca3af",fontSize:11}}>Cours</span>}
                    </TD>
                    <TD>{e.enseignant||<span style={{color:"#9ca3af",fontStyle:"italic"}}>—</span>}</TD>
                    <TD>{e.salle||"—"}</TD>
                    {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                      <Btn sm v="ghost" onClick={()=>{setForm({...e});setEdtCellule({jour:e.jour,heureDebut:e.heureDebut,heureFin:e.heureFin,existing:e});}}>Modifier</Btn>
                      <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEmp(e._id);}}>Suppr.</Btn>
                    </div></TD>}
                  </TR>);
                });
                return <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <THead cols={["Jour","Heure","Matière","Type","Enseignant","Salle",canEdit?"":""]}/>
                  <tbody>{rows}</tbody>
                </table>;
              })()}
            </Card>
        )}

        {/* ── MINI MODAL CELLULE ── */}
        {edtCellule&&(canCreate||canEdit)&&<Modale
          titre={edtCellule.existing?"Modifier le créneau":"Nouveau créneau"}
          fermer={()=>setEdtCellule(null)}>
          <div style={{marginBottom:12,padding:"8px 12px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark,display:"flex",gap:16,flexWrap:"wrap"}}>
            <span>📅 <strong>{edtCellule.jour}</strong></span>
            <span>⏰ <strong>{edtCellule.heureDebut} → {edtCellule.heureFin}</strong></span>
            <span>🏫 <strong>{form.classe||classeEdtActuelle}</strong></span>
          </div>
          {/* Type du créneau */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{v:"cours",label:"📚 Cours"},{v:"revision",label:"📝 Révision"}].map(t=>(
              <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
                style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                  background:(form.type||"cours")===t.v?(t.v==="revision"?"#fff7ed":"#eff6ff"):"#f9fafb",
                  border:`2px solid ${(form.type||"cours")===t.v?(t.v==="revision"?"#f97316":"#3b82f6"):"#e5e7eb"}`,
                  color:(form.type||"cours")===t.v?(t.v==="revision"?"#9a3412":"#1d4ed8"):"#6b7280"}}>
                {t.label}
              </button>
            ))}
          </div>

          {(form.type||"cours")==="revision"&&(
            <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#9a3412",marginBottom:4}}>Prime horaire révision</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" value={form.primeRevision||""}
                    onChange={e=>setForm(p=>({...p,primeRevision:e.target.value}))}
                    placeholder="Ex : 50000"
                    style={{border:"1px solid #fdba74",borderRadius:6,padding:"6px 10px",fontSize:13,width:140,background:"#fff"}}/>
                  <span style={{fontSize:12,color:"#c2410c",fontWeight:600}}>GNF / heure</span>
                </div>
                <div style={{fontSize:11,color:"#c2410c",marginTop:4}}>Cette prime remplace la prime horaire normale pour ce créneau.</div>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Selec label="Matière" value={form.matiere||""} onChange={e=>{setForm(p=>({...p,matiere:e.target.value,enseignant:""}));}}>
              <option value="">— Sélectionner —</option>
              {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
            </Selec>
            {(()=>{
              const ensOccupes=emplois
                .filter(x=>x.jour===edtCellule.jour&&x.heureDebut===edtCellule.heureDebut
                  &&(!edtCellule.existing||x._id!==edtCellule.existing._id)&&x.enseignant)
                .map(x=>x.enseignant);
              const ensFiltres=ens.filter(e=>!form.matiere||(e.matiere||"").toLowerCase().split(/[,/;]+/).map(s=>s.trim()).some(m=>m.includes((form.matiere||"").toLowerCase())||(form.matiere||"").toLowerCase().includes(m)));
              return <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
                <option value="">— Sélectionner —</option>
                {ensFiltres.map(e=>{
                  const nomSimple=`${e.prenom} ${e.nom}`.trim();
                  const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`; // pour compatibilité détection conflit
                  const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
                  const label=`${nomSimple}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
                  return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
                })}
              </Selec>;
            })()}
            <Input label="Salle (optionnel)" value={form.salle||""} onChange={chg("salle")}/>
            <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <Input label="Début" type="time" value={form.heureDebut||edtCellule.heureDebut} onChange={chg("heureDebut")}/>
              <Input label="Fin" type="time" value={form.heureFin||edtCellule.heureFin} onChange={chg("heureFin")}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
            <div>
              {edtCellule.existing&&canEdit&&<Btn v="danger" onClick={()=>{supEmp(edtCellule.existing._id);setEdtCellule(null);}}>🗑 Supprimer</Btn>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setEdtCellule(null)}>Annuler</Btn>
              <Btn onClick={()=>{
                if(!form.matiere){toast("Choisissez une matière.","warning");return;}
                const typeCreneaux=form.type||"cours";
                const data={
                  classe:form.classe||classeEdtActuelle,
                  jour:edtCellule.jour,
                  heureDebut:form.heureDebut||edtCellule.heureDebut,
                  heureFin:form.heureFin||edtCellule.heureFin,
                  matiere:form.matiere,
                  enseignant:form.enseignant||"",
                  salle:form.salle||"",
                  type:typeCreneaux,
                  primeRevision:typeCreneaux==="revision"?Number(form.primeRevision||0):null,
                };
                if(edtCellule.existing)modEmp({...data,_id:edtCellule.existing._id});
                else ajEmp(data);
                setEdtCellule(null);
              }}>✅ Enregistrer</Btn>
            </div>
          </div>
        </Modale>}

        {/* ── MODAL EDT GÉNÉRAL : 8 colonnes ── */}
        {edtGeneralOuvert&&<Modale titre="📊 Emploi du Temps Général" fermer={()=>setEdtGeneralOuvert(false)}>
          <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:12,color:"#64748b"}}>{classes.length} classe(s) · {emplois.length} créneaux</span>
            <Btn onClick={voirEdtGeneral}>🖨️ Imprimer / PDF</Btn>
          </div>
          <div style={{overflowX:"auto",maxHeight:"70dvh",overflowY:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:11,width:"100%",minWidth:700}}>
              <thead>
                <tr style={{position:"sticky",top:0,zIndex:3}}>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:65,position:"sticky",top:0}}>Classes</th>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:58,position:"sticky",top:0}}>Horaires</th>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 4px",fontSize:9,position:"sticky",top:0}}></th>
                  {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,textAlign:"center",minWidth:85,position:"sticky",top:0}}>{j}</th>)}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const rows=[];
                  classesTriees.forEach(cl=>{
                    const total=totalLignesClasse();
                    let first=true;
                    for(let ti=0;ti<nbTranches;ti++){
                      const hd=TRANCHES[ti],hf=TRANCHES[ti+1];
                      const ns=nbSousLignes(ti);
                      for(let si=0;si<ns;si++){
                        const isLastSub=si===ns-1;
                        const isLastSlot=ti===nbTranches-1;
                        const bBot=isLastSub?(isLastSlot?"3px solid "+C.blueDark:"2px solid #b0c4d8"):"1px solid #f0f4f8";
                        const cells=[];
                        if(first&&si===0){
                          cells.push(<td key="cls" rowSpan={total} style={{background:C.blueDark,color:C.vert,fontWeight:800,fontSize:12,textAlign:"center",padding:"6px 5px",border:"2px solid "+C.blueDark,verticalAlign:"middle"}}>{cl.nom}</td>);
                          first=false;
                        }
                        if(si===0)cells.push(<td key="hr" rowSpan={ns} style={{background:"#f0f4f8",fontWeight:800,fontSize:10,color:C.blueDark,textAlign:"center",padding:"4px 5px",border:"1px solid #e2e8f0",whiteSpace:"nowrap",verticalAlign:"middle"}}>{hd.slice(0,5)}<br/>{hf.slice(0,5)}</td>);
                        cells.push(<td key="lbl" style={{background:"#f8fafc",color:"#94a3b8",fontSize:9,padding:"2px 5px",textAlign:"right",border:"1px solid #e8edf2",borderBottom:bBot,whiteSpace:"nowrap",fontStyle:"italic"}}>{SOUS_LABELS[si]||""}</td>);
                        JOURS.forEach(jour=>{
                          const cr=emplois.find(e=>e.classe===cl.nom&&e.jour===jour&&e.heureDebut===hd);
                          const bg=cr?(matCouleur[cr.matiere]||"#e0ebf8"):"#fff";
                          let val=null;
                          if(cr){
                            if(si===0)val=<strong style={{fontSize:11}}>{cr.matiere}</strong>;
                            else if(si===1){const e=findEns(cr.enseignant);val=<span style={{fontSize:10,color:"#475569"}}>{affNom(cr.enseignant||"")}{e?.telephone&&<span style={{display:"block",fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</span>}</span>;}
                            else if(si===2)val=<span style={{fontSize:9,color:"#94a3b8"}}>{cr.salle||""}</span>;
                          }
                          cells.push(<td key={jour} style={{background:bg,border:"1px solid #e2e8f0",borderBottom:bBot,padding:"2px 5px",textAlign:"center",verticalAlign:"middle",minWidth:85}}>{val}</td>);
                        });
                        rows.push(<tr key={cl._id+"-"+ti+"-"+si}>{cells}</tr>);
                      }
                    }
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </Modale>}
      </div>;})()}

      {/* ── ATTESTATIONS DE NIVEAU ── */}
      {tab==="attestations"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Attestations de niveau</strong>
          <input placeholder="🔍 Recherche nom / matricule..."
            value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
          <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {classesUniq.map(c=><option key={c}>{c}</option>)}
          </select>
          <Btn sm v="amber" onClick={()=>{
            const elevesAtt=elevesFiltres.filter(e=>!rechercheMatricule
              ||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())
              ||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
            if(!elevesAtt.length){alert("Aucun élève à imprimer.");return;}
            const w=window.open("","_blank");
            // Génération groupée en ouvrant plusieurs onglets n'est pas idéale ; on imprime la liste
            const rows=elevesAtt.map(e=>`<tr><td>${e.matricule||"—"}</td><td>${e.nom} ${e.prenom}</td><td>${e.classe}</td><td>${e.dateNaissance||"—"}</td><td>${e.lieuNaissance||"—"}</td></tr>`).join("");
            w.document.write(`<!DOCTYPE html><html><head><title>Attestations — ${filtreClasse==="all"?"Toutes classes":filtreClasse}</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#0A1628;text-align:center}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px}td{padding:7px 8px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style></head><body><h2>${schoolInfo.nom||"École"} — Registre des attestations</h2><p style="text-align:center">${filtreClasse==="all"?"Toutes classes":filtreClasse} · Année ${annee}</p><table><tr><th>Matricule</th><th>Nom & Prénom</th><th>Classe</th><th>Date naissance</th><th>Lieu naissance</th></tr>${rows}</table><br/><button onclick="window.print()">🖨️ Imprimer la liste</button></body></html>`);
            w.document.close();
          }}>📋 Liste en lot</Btn>
        </div>
        <div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#166534",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>📜</span>
          <span>Cliquez sur <strong>Imprimer</strong> pour générer l'attestation officielle de niveau pour chaque élève.</span>
        </div>
        {cE?<Chargement/>:(()=>{
          const elevesAtt=elevesFiltres.filter(e=>!rechercheMatricule
            ||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())
            ||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
          return elevesAtt.length===0?<Vide icone="📜" msg="Aucun élève pour cette sélection"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Matricule","Nom & Prénom","Classe","Niveau","Statut","Attestation"]}/>
            <tbody>{elevesAtt.map(e=><TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><Badge color={avecEns?"purple":"amber"}>{avecEns?"Collège":"Primaire"}</Badge></TD>
              <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut||"Actif"}</Badge></TD>
              <TD><Btn sm v="amber" onClick={()=>imprimerAttestation(e,avecEns?"college":"primaire",annee,schoolInfo)}>🖨️ Imprimer</Btn></TD>
            </TR>)}</tbody>
          </table></Card>;
        })()}
      </div>}
    </div>
  );
}
function ParametresEcole() {
  const {schoolId,schoolInfo,setSchoolInfo,toast} = useContext(SchoolContext);
  const {items:honneurs, ajouter:ajHonneur, modifier:modHonneur, supprimer:supHonneur} = useFirestore("honneurs");
  const [tabParam, setTabParam] = useState("identite");
  const [form,setForm] = useState({
    nom: schoolInfo.nom||"",
    type: schoolInfo.type||"Groupe Scolaire Privé",
    ville: schoolInfo.ville||"",
    pays: schoolInfo.pays||"Guinée",
    couleur1: schoolInfo.couleur1||"#0A1628",
    couleur2: schoolInfo.couleur2||"#00C48C",
    logo: schoolInfo.logo||"",
    devise: schoolInfo.devise||"",
    ministere: schoolInfo.ministere||"",
    ire: schoolInfo.ire||"",
    dpe: schoolInfo.dpe||"",
    agrement: schoolInfo.agrement||"",
    moisDebut: schoolInfo.moisDebut||"Octobre",
  });
  const acc0 = schoolInfo.accueil||{};
  const [accueil, setAccueil] = useState({
    active: acc0.active||false,
    slogan: acc0.slogan||"",
    texteAccueil: acc0.texteAccueil||"",
    bannerUrl: acc0.bannerUrl||"",
    photos: acc0.photos||[],
    showAnnonces: acc0.showAnnonces!==false,
    showHonneurs: acc0.showHonneurs!==false,
    showContact: acc0.showContact!==false,
    telephone: acc0.telephone||"",
    email: acc0.email||"",
    facebook: acc0.facebook||"",
    whatsapp: acc0.whatsapp||"",
    adresse: acc0.adresse||"",
  });
  const [formHonneur, setFormHonneur] = useState({});
  const [modalH, setModalH] = useState(null);
  const chgA = k => e => setAccueil(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));
  const [chargement,setChargement] = useState(false);
  const [msgSucces,setMsgSucces] = useState("");
  const [erreur,setErreur] = useState("");
  const [apercu,setApercu] = useState(null); // aperçu logo uploadé

  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const [couleursDetectees, setCouleursDetectees] = useState(null);

  // Extrait les 2 couleurs dominantes d'une image via Canvas
  const extraireCouleurs = (src, cb) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 80; // résolution réduite pour perf
        const canvas = document.createElement("canvas");
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        const freq = {};
        for(let i=0;i<px.length;i+=4){
          const [r,g,b,a] = [px[i],px[i+1],px[i+2],px[i+3]];
          if(a<100) continue;                        // transparent
          if(r>230&&g>230&&b>230) continue;          // blanc
          if(r<25&&g<25&&b<25) continue;             // noir
          // Quantiser (grouper les teintes proches)
          const k=`${Math.round(r/28)*28},${Math.round(g/28)*28},${Math.round(b/28)*28}`;
          freq[k]=(freq[k]||0)+1;
        }
        const tri = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
        if(!tri.length){cb(null,null);return;}
        const hex=([r,g,b])=>"#"+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,"0")).join("");
        const c1rgb = tri[0][0].split(",").map(Number);
        const c1 = hex(c1rgb);
        let c2=null;
        for(const [k] of tri.slice(1)){
          const rgb=k.split(",").map(Number);
          const d=Math.sqrt(c1rgb.reduce((s,v,i)=>s+(v-rgb[i])**2,0));
          if(d>70){c2=hex(rgb);break;}
        }
        cb(c1, c2||"#00C48C");
      } catch{ cb(null,null); }
    };
    img.onerror=()=>cb(null,null);
    img.src=src;
  };

  // Upload logo fichier → base64 + extraction couleurs
  const handleLogoFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){ setErreur("Logo trop grand (max 500 Ko)."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      setForm(p=>({...p,logo:src}));
      setApercu(src);
      setCouleursDetectees(null);
      extraireCouleurs(src, (c1, c2) => {
        if(c1) setCouleursDetectees({c1, c2});
      });
    };
    reader.readAsDataURL(file);
  };

  const appliquerCouleursDetectees = () => {
    if(!couleursDetectees) return;
    setForm(p=>({...p, couleur1:couleursDetectees.c1, couleur2:couleursDetectees.c2}));
    setCouleursDetectees(null);
  };

  const sauvegarder = async () => {
    if(!form.nom.trim()){setErreur("Le nom de l'école est requis.");return;}
    setChargement(true); setErreur("");
    try {
      const data = {
        nom: form.nom.trim(),
        type: form.type.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        couleur1: form.couleur1,
        couleur2: form.couleur2,
        logo: form.logo||null,
        devise: form.devise.trim(),
        ministere: form.ministere.trim(),
        ire: form.ire.trim(),
        dpe: form.dpe.trim(),
        agrement: form.agrement.trim(),
        moisDebut: form.moisDebut,
        accueil: {
          active: accueil.active,
          slogan: accueil.slogan.trim(),
          texteAccueil: accueil.texteAccueil.trim(),
          bannerUrl: accueil.bannerUrl.trim(),
          photos: accueil.photos,
          showAnnonces: accueil.showAnnonces,
          showHonneurs: accueil.showHonneurs,
          showContact: accueil.showContact,
          telephone: accueil.telephone.trim(),
          email: accueil.email.trim(),
          facebook: accueil.facebook.trim(),
          whatsapp: accueil.whatsapp.trim(),
          adresse: accueil.adresse.trim(),
        },
      };
      await updateDoc(doc(db,"ecoles",schoolId), data);
      setSchoolInfo(prev=>({...prev,...data}));
      if(data.couleur1) document.documentElement.style.setProperty("--sc1", data.couleur1);
      if(data.couleur2) document.documentElement.style.setProperty("--sc2", data.couleur2);
      setMsgSucces("Paramètres enregistrés avec succès.");
      setTimeout(()=>setMsgSucces(""),4000);
    } catch(e) {
      setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
    } finally {
      setChargement(false);
    }
  };

  // Upload photo galerie → base64
  const handlePhotoGalerie = e => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if(file.size > 800*1024){ toast(`${file.name} trop grande (max 800 Ko).`,"warning"); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setAccueil(p=>({...p, photos:[...(p.photos||[]), {url:ev.target.result, caption:""}]}));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Upload bannière → base64
  const handleBanniere = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 1024*1024){ setErreur("Bannière trop grande (max 1 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = ev => setAccueil(p=>({...p, bannerUrl:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetLogo = () => { setForm(p=>({...p,logo:""})); setApercu(null); };

  const inp = {
    width:"100%",border:"1px solid #d1d5db",borderRadius:8,
    padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",
  };
  const lbl = {
    display:"block",fontSize:11,fontWeight:700,color:C.blueDark,
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4,marginTop:14,
  };
  const sec = {
    background:"#fff",borderRadius:14,padding:"24px 28px",
    boxShadow:"0 2px 16px rgba(0,32,80,0.07)",marginBottom:20,
  };

  return (
    <div style={{padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:760,margin:"0 auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:C.blueDark}}>⚙️ Paramètres de l'école</h2>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#9ca3af"}}>Personnalisez l'identité visuelle et les informations de votre établissement</p>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:24,width:"fit-content"}}>
        {[
          {id:"identite",    label:"🏫 Identité"},
          {id:"accueil",     label:"🌐 Page d'accueil"},
          {id:"officiel",    label:"🏛️ Officiel & Année"},
          {id:"matricules",  label:"🔢 Matricules"},
          {id:"affichage",   label:"🎨 Affichage"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTabParam(t.id)} style={{
            padding:"8px 18px",border:"none",borderRadius:9,cursor:"pointer",
            fontSize:13,fontWeight:700,
            background:tabParam===t.id?"#fff":"transparent",
            color:tabParam===t.id?C.blueDark:"#64748b",
            boxShadow:tabParam===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
            transition:"all .15s",
          }}>{t.label}</button>
        ))}
      </div>

      {msgSucces&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#065f46",fontWeight:600}}>✅ {msgSucces}</div>}
      {erreur&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>{erreur}</div>}

      {/* ══ TAB IDENTITÉ ══ */}
      {tabParam==="identite"&&<>
      {/* Informations générales */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🏫 Informations générales</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <label style={lbl}>Nom de l'école *</label>
            <input style={inp} value={form.nom} onChange={chg("nom")} placeholder="Ex. : La Citadelle"/>
          </div>
          <div>
            <label style={lbl}>Type d'établissement</label>
            <input style={inp} value={form.type} onChange={chg("type")} placeholder="Ex. : Groupe Scolaire Privé"/>
          </div>
          <div>
            <label style={lbl}>Ville</label>
            <input style={inp} value={form.ville} onChange={chg("ville")} placeholder="Ex. : Kindia"/>
          </div>
          <div>
            <label style={lbl}>Pays</label>
            <input style={inp} value={form.pays} onChange={chg("pays")} placeholder="Ex. : Guinée"/>
          </div>
        </div>
        <label style={lbl}>Devise / Slogan</label>
        <input style={inp} value={form.devise} onChange={chg("devise")} placeholder="Ex. : Travail – Rigueur – Réussite"/>
      </div>

      {/* Couleurs */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🎨 Couleurs de l'établissement</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
          {[
            {key:"couleur1",label:"Couleur principale (fond sidebar, titres)"},
            {key:"couleur2",label:"Couleur secondaire (accents, boutons)"},
          ].map(({key,label})=>(
            <div key={key}>
              <label style={lbl}>{label}</label>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <input type="color" value={form[key]} onChange={chg(key)}
                  style={{width:48,height:40,border:"1px solid #d1d5db",borderRadius:8,cursor:"pointer",padding:2}}/>
                <input style={{...inp,flex:1}} value={form[key]} onChange={chg(key)} placeholder="#0A1628"/>
                <div style={{width:40,height:40,borderRadius:8,background:form[key],border:"1px solid #e5e7eb",flexShrink:0}}/>
              </div>
            </div>
          ))}
        </div>
        {/* Aperçu couleurs */}
        <div style={{marginTop:16,padding:"14px 18px",borderRadius:10,background:form.couleur1,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:form.couleur2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏫</div>
          <div>
            <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Aperçu sidebar</p>
            <p style={{margin:0,fontSize:14,fontWeight:800,color:form.couleur2}}>{form.nom||"Nom de l'école"}</p>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🖼️ Logo de l'établissement</h3>
        <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
          {/* Aperçu */}
          <div style={{width:100,height:100,borderRadius:12,border:"2px dashed #d1d5db",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#f9fafb",flexShrink:0}}>
            {(apercu||form.logo)
              ? <img src={apercu||form.logo} alt="Logo" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              : <span style={{fontSize:32}}>🏫</span>}
          </div>
          <div style={{flex:1,minWidth:200}}>
            <label style={{...lbl,marginTop:0}}>Uploader un fichier (max 500 Ko)</label>
            <input type="file" accept="image/*" onChange={handleLogoFile}
              style={{...inp,padding:"6px 8px",cursor:"pointer"}}/>
            <label style={lbl}>Ou coller une URL d'image</label>
            <input style={inp} value={form.logo.startsWith("data:")?"":(form.logo||"")}
              onChange={e=>{ setForm(p=>({...p,logo:e.target.value})); setApercu(null); }}
              placeholder="https://exemple.com/logo.png"/>
            {(form.logo||apercu)&&(
              <button onClick={resetLogo}
                style={{marginTop:8,background:"#fee2e2",border:"none",color:"#991b1b",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                ✕ Supprimer le logo
              </button>
            )}
            {couleursDetectees&&(
              <div style={{marginTop:10,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10}}>
                <p style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:8}}>🎨 Couleurs détectées dans le logo :</p>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:28,height:28,borderRadius:6,background:couleursDetectees.c1,border:"2px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,.15)"}}/>
                    <span style={{fontSize:11,color:"#374151",fontWeight:600}}>Couleur 1<br/><code style={{fontSize:10,color:"#6b7280"}}>{couleursDetectees.c1}</code></span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:28,height:28,borderRadius:6,background:couleursDetectees.c2,border:"2px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,.15)"}}/>
                    <span style={{fontSize:11,color:"#374151",fontWeight:600}}>Couleur 2<br/><code style={{fontSize:10,color:"#6b7280"}}>{couleursDetectees.c2}</code></span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={appliquerCouleursDetectees}
                    style={{background:"linear-gradient(135deg,#065f46,#059669)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    ✔ Appliquer ces couleurs
                  </button>
                  <button onClick={()=>setCouleursDetectees(p=>({c1:p.c2,c2:p.c1}))}
                    style={{background:"#e0ebf8",color:C.blueDark,border:"none",padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    ⇄ Inverser
                  </button>
                  <button onClick={()=>setCouleursDetectees(null)}
                    style={{background:"#e5e7eb",color:"#374151",border:"none",padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Ignorer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Année scolaire — dans onglet identité */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Mois de début de l'année</h3>
        <select style={{...inp,cursor:"pointer"}} value={form.moisDebut} onChange={chg("moisDebut")}>
          {TOUS_MOIS_LONGS.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
          Actuellement : <strong style={{color:C.blue}}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
        </p>
      </div>
      </>}

      {/* ══ TAB PAGE D'ACCUEIL ══ */}
      {tabParam==="accueil"&&<>

        {/* Activation */}
        <div style={{...sec,borderLeft:`4px solid ${accueil.active?C.green:"#e2e8f0"}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.blueDark}}>🌐 Page d'accueil publique</h3>
              <p style={{margin:0,fontSize:12,color:"#64748b"}}>Visible par tous les visiteurs avant connexion — vitrine de votre école</p>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
              <span style={{fontSize:13,fontWeight:700,color:accueil.active?C.greenDk:"#94a3b8"}}>
                {accueil.active?"✅ Activée":"⭕ Désactivée"}
              </span>
              <div onClick={()=>setAccueil(p=>({...p,active:!p.active}))} style={{
                width:44,height:24,borderRadius:12,cursor:"pointer",transition:"background .2s",
                background:accueil.active?C.green:"#d1d5db",position:"relative",flexShrink:0,
              }}>
                <div style={{
                  position:"absolute",top:2,left:accueil.active?22:2,
                  width:20,height:20,borderRadius:"50%",background:"#fff",
                  transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.25)",
                }}/>
              </div>
            </label>
          </div>
        </div>

        {/* Textes */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>✏️ Textes de la page</h3>
          <label style={lbl}>Slogan / Tagline</label>
          <input style={inp} value={accueil.slogan} onChange={chgA("slogan")} placeholder="Ex. : L'excellence au cœur de l'Afrique"/>
          <label style={lbl}>Message d'accueil</label>
          <textarea value={accueil.texteAccueil} onChange={chgA("texteAccueil")} rows={3}
            placeholder="Ex. : Bienvenue à l'École La Citadelle, un établissement d'excellence..."
            style={{...inp,resize:"vertical",fontFamily:"inherit"}}/>
        </div>

        {/* Bannière */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🖼️ Image bannière (hero)</h3>
          {accueil.bannerUrl&&<div style={{marginBottom:12,borderRadius:10,overflow:"hidden",height:120,background:"#f1f5f9"}}>
            <img src={accueil.bannerUrl} alt="Bannière" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </div>}
          <input type="file" accept="image/*" onChange={handleBanniere} style={{...inp,padding:"6px 8px",cursor:"pointer"}}/>
          <label style={lbl}>Ou coller une URL</label>
          <input style={inp} value={accueil.bannerUrl.startsWith("data:")?"":accueil.bannerUrl}
            onChange={e=>setAccueil(p=>({...p,bannerUrl:e.target.value}))}
            placeholder="https://...jpg"/>
          {accueil.bannerUrl&&<button onClick={()=>setAccueil(p=>({...p,bannerUrl:""}))}
            style={{marginTop:8,background:"#fee2e2",border:"none",color:"#991b1b",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ✕ Supprimer la bannière
          </button>}
        </div>

        {/* Galerie photos */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📸 Galerie de photos</h3>
          <input type="file" accept="image/*" multiple onChange={handlePhotoGalerie}
            style={{...inp,padding:"6px 8px",cursor:"pointer",marginBottom:12}}/>
          {(accueil.photos||[]).length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucune photo ajoutée</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginTop:8}}>
            {(accueil.photos||[]).map((p,i)=>(
              <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                <img src={p.url} alt="" style={{width:"100%",height:90,objectFit:"cover",display:"block"}}/>
                <input value={p.caption||""} onChange={e=>{
                  const photos=[...accueil.photos];
                  photos[i]={...photos[i],caption:e.target.value};
                  setAccueil(pa=>({...pa,photos}));
                }} placeholder="Légende..." style={{width:"100%",border:"none",borderTop:"1px solid #e2e8f0",padding:"4px 6px",fontSize:11,outline:"none",boxSizing:"border-box"}}/>
                <button onClick={()=>setAccueil(pa=>({...pa,photos:pa.photos.filter((_,j)=>j!==i)}))}
                  style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Tableau d'honneur */}
        <div style={sec}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:800,color:C.blueDark}}>🏆 Tableau d'honneur</h3>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>
                <input type="checkbox" checked={accueil.showHonneurs} onChange={chgA("showHonneurs")}/>
                Afficher sur la page
              </label>
              <Btn sm onClick={()=>{setFormHonneur({periode:"",distinction:"Major de promotion"});setModalH("add");}}>+ Ajouter</Btn>
            </div>
          </div>
          {honneurs.length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucun élève distingué</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {honneurs.map(h=>(
              <div key={h._id} style={{background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:"1px solid #fde68a",borderRadius:12,padding:"14px 16px",position:"relative"}}>
                <div style={{fontSize:22,marginBottom:6}}>🏅</div>
                <div style={{fontWeight:800,fontSize:13,color:"#0A1628"}}>{h.prenom} {h.nom}</div>
                <div style={{fontSize:11,color:"#92400e",fontWeight:700,marginTop:2}}>{h.distinction}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{h.classe} · {h.periode}</div>
                <div style={{display:"flex",gap:4,marginTop:8}}>
                  <Btn sm v="ghost" onClick={()=>{setFormHonneur({...h});setModalH("edit");}}>✏️</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supHonneur(h._id);}}>🗑</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections visibles */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>👁️ Sections affichées</h3>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              {key:"showAnnonces", label:"Annonces de l'école"},
              {key:"showContact",  label:"Informations de contact"},
            ].map(({key,label})=>(
              <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:"#374151"}}>
                <input type="checkbox" checked={accueil[key]} onChange={chgA(key)} style={{width:16,height:16}}/>
                <span style={{fontWeight:600}}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div style={sec}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📞 Informations de contact</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div><label style={lbl}>Téléphone</label><input style={inp} value={accueil.telephone} onChange={chgA("telephone")} placeholder="+224 6XX XXX XXX"/></div>
            <div><label style={lbl}>Email</label><input style={inp} value={accueil.email} onChange={chgA("email")} placeholder="contact@ecole.gn"/></div>
            <div><label style={lbl}>WhatsApp</label><input style={inp} value={accueil.whatsapp} onChange={chgA("whatsapp")} placeholder="+224 6XX XXX XXX"/></div>
            <div><label style={lbl}>Facebook</label><input style={inp} value={accueil.facebook} onChange={chgA("facebook")} placeholder="facebook.com/monecole"/></div>
          </div>
          <label style={lbl}>Adresse physique</label>
          <input style={inp} value={accueil.adresse} onChange={chgA("adresse")} placeholder="Ex. : Quartier Madina, Kindia, Guinée"/>
        </div>

        {/* Modal honneur */}
        {modalH&&<Modale titre={modalH==="add"?"Ajouter une distinction":"Modifier"} fermer={()=>setModalH(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="Prénom" value={formHonneur.prenom||""} onChange={e=>setFormHonneur(p=>({...p,prenom:e.target.value}))}/>
            <Input label="Nom" value={formHonneur.nom||""} onChange={e=>setFormHonneur(p=>({...p,nom:e.target.value}))}/>
            <Input label="Classe" value={formHonneur.classe||""} onChange={e=>setFormHonneur(p=>({...p,classe:e.target.value}))} placeholder="Ex : 9ème A"/>
            <Input label="Période" value={formHonneur.periode||""} onChange={e=>setFormHonneur(p=>({...p,periode:e.target.value}))} placeholder="Ex : T1 2025-2026"/>
          </div>
          <div style={{marginTop:12}}>
            <Selec label="Distinction" value={formHonneur.distinction||"Major de promotion"} onChange={e=>setFormHonneur(p=>({...p,distinction:e.target.value}))}>
              <option>Major de promotion</option>
              <option>Premier de classe</option>
              <option>Deuxième de classe</option>
              <option>Troisième de classe</option>
              <option>Excellence académique</option>
              <option>Mention Très Bien</option>
              <option>Mention Bien</option>
              <option>Prix du mérite</option>
              <option>Meilleur(e) en Mathématiques</option>
              <option>Meilleur(e) en Français</option>
              <option>Meilleur(e) en Sciences</option>
            </Selec>
          </div>
          <div style={{marginTop:12}}>
            <label style={{...lbl,marginTop:0}}>Observation (optionnel)</label>
            <input style={inp} value={formHonneur.observation||""} onChange={e=>setFormHonneur(p=>({...p,observation:e.target.value}))} placeholder="Ex : Moyenne 19.5/20"/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModalH(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              if(!formHonneur.nom?.trim()||!formHonneur.prenom?.trim()){toast("Nom et prénom requis.","warning");return;}
              if(modalH==="add") ajHonneur(formHonneur); else modHonneur(formHonneur);
              setModalH(null);
            }}>Enregistrer</Btn>
          </div>
        </Modale>}

      </>}

      {/* ══ TAB OFFICIEL & ANNÉE ══ */}
      {tabParam==="officiel"&&<>
      {/* Informations officielles */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🏛️ Informations officielles</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <label style={lbl}>Ministère (abrégé)</label>
            <input style={inp} value={form.ministere} onChange={chg("ministere")} placeholder="Ex. : MEPU-FP"/>
          </div>
          <div>
            <label style={lbl}>N° Agrément</label>
            <input style={inp} value={form.agrement} onChange={chg("agrement")} placeholder="Ex. : 2024/001"/>
          </div>
          <div>
            <label style={lbl}>Inspection Régionale (abrégé)</label>
            <input style={inp} value={form.ire} onChange={chg("ire")} placeholder="Ex. : IRE de Kindia"/>
          </div>
          <div>
            <label style={lbl}>Direction Préfectorale (abrégé)</label>
            <input style={inp} value={form.dpe} onChange={chg("dpe")} placeholder="Ex. : DPE de Kindia"/>
          </div>
        </div>
      </div>

      {/* Année scolaire */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Année scolaire</h3>
        <div>
          <label style={lbl}>Mois de début de l'année scolaire</label>
          <select style={{...inp,cursor:"pointer"}} value={form.moisDebut} onChange={chg("moisDebut")}>
            {TOUS_MOIS_LONGS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
            L'année scolaire couvre 9 mois à partir du mois choisi. Actuellement&nbsp;:&nbsp;
            <strong style={{color:C.blue}}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
          </p>
        </div>
      </div>
      </>}

      {/* ══ TAB MATRICULES ══ */}
      {tabParam==="matricules"&&<MatriculeSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}

      {/* ══ TAB AFFICHAGE ══ */}
      {tabParam==="affichage"&&<AffichageSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}

      {/* Bouton sauvegarder (identité / officiel / accueil) */}
      {["identite","accueil","officiel"].includes(tabParam)&&<button onClick={sauvegarder} disabled={chargement}
        style={{width:"100%",background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",
          border:"none",padding:"13px",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer",
          opacity:chargement?0.7:1}}>
        {chargement?"Enregistrement…":"💾 Enregistrer les paramètres"}
      </button>}

      <p style={{textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:12}}>
        Code école : <strong style={{color:C.blue}}>{schoolId}</strong> · Les modifications sont visibles immédiatement dans la sidebar et au prochain chargement.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PANEL SUPER-ADMIN
// ══════════════════════════════════════════════════════════════
function SuperAdminPanel() {
  const [ecoles, setEcoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({});
  const [recherche, setRecherche] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouvelleEcole, setNouvelleEcole] = useState({nom:"",ville:"",pays:"Guinée"});
  const [msgSucces, setMsgSucces] = useState("");
  const [demandes, setDemandes] = useState([]);
  const [ongletSA, setOngletSA] = useState("ecoles");
  // Gestion plan inline
  const [planModal, setPlanModal] = useState(null);
  const [planChoix, setPlanChoix] = useState("gratuit");
  const [planDuree, setPlanDuree] = useState(365);
  const [planSaving, setPlanSaving] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const planPanelRef = useRef(null);

  const chargerEcoles = async () => {
    setChargement(true);
    try {
      const snap = await getDocs(collection(db,"ecoles"));
      const liste = snap.docs.map(d=>({...d.data(),_id:d.id}));
      setEcoles(liste);
      // Charger les stats en parallèle
      const statsMap = {};
      await Promise.all(liste.map(async (e) => {
        const [eleves, comptes, enseignants] = await Promise.all([
          getDocs(collection(db,"ecoles",e._id,"elevesPrimaire")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"comptes")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"ensPrimaire")).then(s=>s.size).catch(()=>0),
        ]);
        // Élèves secondaire aussi
        const elevesS = await getDocs(collection(db,"ecoles",e._id,"elevesSecondaire")).then(s=>s.size).catch(()=>0);
        statsMap[e._id] = { eleves: eleves + elevesS, comptes, enseignants };
      }));
      setStats(statsMap);
    } catch(err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerEcoles();
    const unsub = chargerDemandes();
    return () => unsub && unsub();
  }, []);

  const chargerDemandes = () => {
    try {
      const q = collectionGroup(db,"demandes_plan");
      return onSnapshot(q, snap => {
        const liste = snap.docs
          .map(d=>({...d.data(),_id:d.id,_schoolId:d.ref.parent.parent.id}))
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        setDemandes(liste);
      }, ()=>{});
    } catch { return ()=>{}; }
  };

  const validerDemande = async (demande) => {
    const plan = demande.planDemande || "starter";
    const update = {
      plan, planExpiry: Date.now()+365*86400000,
      planActivatedBy:"superadmin", planActivatedAt:Date.now(),
    };
    await updateDoc(doc(db,"ecoles",demande._schoolId), update);
    await updateDoc(doc(db,"ecoles",demande._schoolId,"demandes_plan",demande._id),{statut:"validee"});
    await addDoc(collection(db,"ecoles",demande._schoolId,"historique"),{
      action:"Plan activé",
      details:`Plan ${PLANS[plan]?.label||plan} activé par le superadmin — valable 1 an`,
      auteur:"EduGest", date:Date.now(),
    }).catch(()=>{});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"validee"}:d));
    setEcoles(prev=>prev.map(e=>e._id===demande._schoolId?{...e,...update}:e));
    setMsgSucces(`Plan ${PLANS[plan]?.label||plan} activé pour ${demande.ecoleNom}`);
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const rejeterDemande = async (demande) => {
    await updateDoc(doc(db,"ecoles",demande._schoolId,"demandes_plan",demande._id),{statut:"rejetee"});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"rejetee"}:d));
  };

  const sauvegarderPlan = async () => {
    if(!planModal) return;
    // Protection : downgrade vers Gratuit depuis un plan payant → double confirmation
    const estPlanPayant = planModal.plan && planModal.plan !== "gratuit";
    if(planChoix === "gratuit" && estPlanPayant && !confirmDowngrade) {
      setConfirmDowngrade(true);
      return;
    }
    setConfirmDowngrade(false);
    setPlanSaving(true);
    try {
      const update = planChoix === "gratuit"
        ? { plan:"gratuit", planExpiry:null, planActivatedBy:"superadmin", planActivatedAt:Date.now() }
        : { plan:planChoix, planExpiry:Date.now()+planDuree*86400000, planActivatedBy:"superadmin", planActivatedAt:Date.now() };

      // ── 1. Sauvegarde principale (bloquante) ──
      await updateDoc(doc(db,"ecoles",planModal._id), update);
      setEcoles(prev=>prev.map(e=>e._id===planModal._id?{...e,...update}:e));

      const planLabel = PLANS[planChoix]?.label ?? "Gratuit";
      const expMsg = update.planExpiry
        ? ` — expire le ${new Date(update.planExpiry).toLocaleDateString("fr-FR")}`
        : "";

      // ── 2. Feedback immédiat + fermeture différée ──
      setMsgSucces(`✅ Plan ${planLabel} activé pour ${planModal.nom}`);
      setTimeout(()=>{ setPlanModal(null);setConfirmDowngrade(false); setMsgSucces(""); }, 2500);
      planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"});

      // ── 3. Notification & push (best-effort, ne bloque pas) ──
      addDoc(collection(db,"ecoles",planModal._id,"historique"),{
        action: "Plan mis à jour",
        details: `Plan ${planLabel} activé par le superadmin${expMsg}`,
        auteur: "EduGest",
        date: Date.now(),
      }).catch(()=>{});

      getAuthHeaders({"Content-Type":"application/json"}).then(headers =>
        fetch("/api/push",{
          method:"POST", headers,
          body: JSON.stringify({
            schoolId: planModal._id,
            cibles: ["admin","direction"],
            titre: `Plan ${planLabel} activé`,
            corps: `Votre abonnement ${planLabel} est maintenant actif${expMsg}.`,
            url: "/",
          }),
        })
      ).catch(()=>{});

    } catch(err) {
      console.error("Erreur sauvegarderPlan:", err);
      setMsgSucces("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
      setTimeout(()=>setMsgSucces(""),5000);
    } finally {
      setPlanSaving(false);
    }
  };

  const toggleActif = async (ecole) => {
    await updateDoc(doc(db,"ecoles",ecole._id), {actif: !ecole.actif});
    setEcoles(prev => prev.map(e => e._id===ecole._id ? {...e,actif:!e.actif} : e));
    setConfirmation(null);
  };

  const supprimerEcole = async (ecole) => {
    // On désactive seulement (suppression physique = risque)
    await updateDoc(doc(db,"ecoles",ecole._id), {actif:false, supprime:true});
    setEcoles(prev => prev.filter(e => e._id!==ecole._id));
    setConfirmation(null);
  };

  const genSlug = (nom) =>
    nom.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30)||"ecole";

  const creerEcole = async () => {
    if(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()) return;
    const sid = genSlug(nouvelleEcole.nom);
    await setDoc(doc(db,"ecoles",sid),{
      nom: nouvelleEcole.nom.trim(),
      ville: nouvelleEcole.ville.trim(),
      pays: nouvelleEcole.pays.trim()||"Guinée",
      createdAt: Date.now(),
      actif: true,
    });
    setMsgSucces(`École "${nouvelleEcole.nom}" créée (code : ${sid})`);
    setNouvelleEcole({nom:"",ville:"",pays:"Guinée"});
    setCreationOuverte(false);
    chargerEcoles();
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const ecolesFiltrees = ecoles.filter(e =>
    e.nom?.toLowerCase().includes(recherche.toLowerCase()) ||
    e.ville?.toLowerCase().includes(recherche.toLowerCase()) ||
    e._id?.toLowerCase().includes(recherche.toLowerCase())
  );

  const S = {
    page: {padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f7fb"},
    titre: {margin:"0 0 6px",fontSize:22,fontWeight:900,color:C.blueDark},
    sous: {margin:"0 0 24px",fontSize:12,color:"#9ca3af"},
    card: {background:"#fff",borderRadius:14,boxShadow:"0 2px 16px rgba(0,32,80,0.08)",overflow:"hidden"},
    th: {padding:"10px 14px",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",textAlign:"left"},
    td: {padding:"12px 14px",fontSize:13,color:"#374151",borderBottom:"1px solid #f0f0f0",verticalAlign:"middle"},
    badge: (actif) => ({
      display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
      background:actif?"#d1fae5":"#fee2e2",color:actif?"#065f46":"#991b1b",
    }),
    btn: (color,bg) => ({background:bg||color,color:color===C.blue?"#fff":color===C.green?"#fff":"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}),
    input: {border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
    modal: {background:"#fff",borderRadius:16,padding:"28px 32px",width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"},
  };

  return (
    <div style={S.page}>
      <h2 style={S.titre}>⚙️ Panel Super-Admin</h2>
      <p style={S.sous}>Gestion de toutes les écoles enregistrées sur la plateforme</p>

      {msgSucces && (
        <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:18,fontSize:13,color:"#065f46",fontWeight:600}}>
          ✅ {msgSucces}
        </div>
      )}

      {/* Onglets */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[
          {id:"ecoles",label:"🏫 Écoles"},
          {id:"plans",label:"⭐ Plans"},
          {id:"demandes",label:`📋 Demandes${demandes.filter(d=>d.statut==="en_attente").length>0?" ("+demandes.filter(d=>d.statut==="en_attente").length+")":""}`},
        ].map(o=>(
          <button key={o.id} onClick={()=>{setOngletSA(o.id);setPlanModal(null);setConfirmDowngrade(false);}}
            style={{padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
              background:ongletSA===o.id?C.blue:"#f0f4f8",color:ongletSA===o.id?"#fff":"#6b7280"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Onglet Demandes Pro ── */}
      {ongletSA==="demandes" && (
        <div style={S.card}>
          {demandes.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune demande de souscription.</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["École","Plan demandé","Opérateur","Téléphone","Référence","Date","Statut","Actions"].map(h=>(
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandes.map(d=>(
                  <tr key={d._id}>
                    <td style={S.td}><strong>{d.ecoleNom||d._schoolId}</strong></td>
                    <td style={S.td}>
                      {d.planDemande ? (
                        <span style={{display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                          background:PLANS[d.planDemande]?.bg||"#f3f4f6",color:PLANS[d.planDemande]?.couleur||"#6b7280"}}>
                          {PLANS[d.planDemande]?.label||d.planDemande}
                        </span>
                      ):"—"}
                    </td>
                    <td style={S.td}>{d.operateur||"—"}</td>
                    <td style={S.td}>{d.telephone}</td>
                    <td style={S.td}><code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11}}>{d.reference}</code></td>
                    <td style={S.td}>{d.createdAt?new Date(d.createdAt).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={S.td}>
                      <span style={{...S.badge(d.statut==="validee"),
                        background:d.statut==="validee"?"#d1fae5":d.statut==="rejetee"?"#fee2e2":"#fef3c7",
                        color:d.statut==="validee"?"#065f46":d.statut==="rejetee"?"#991b1b":"#92400e"}}>
                        {d.statut==="validee"?"✅ Validée":d.statut==="rejetee"?"❌ Rejetée":"⏳ En attente"}
                      </span>
                    </td>
                    <td style={S.td}>
                      {d.statut==="en_attente" && (
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>validerDemande(d)}
                            style={{...S.btn(C.green),background:"#d1fae5",color:"#065f46"}}>
                            ✅ Valider
                          </button>
                          <button onClick={()=>rejeterDemande(d)}
                            style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
                            ❌ Rejeter
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Onglet Plans ── */}
      {ongletSA==="plans" && (
        <div>
          {/* Résumé par plan */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
            {Object.entries(PLANS).map(([key,info])=>{
              const count = ecoles.filter(e=>(e.plan||"gratuit")===key).length;
              const expired = key!=="gratuit" ? ecoles.filter(e=>e.plan===key&&e.planExpiry&&Date.now()>e.planExpiry).length : 0;
              return (
                <div key={key} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderTop:`4px solid ${info.couleur}`}}>
                  <div style={{fontSize:22,fontWeight:900,color:info.couleur}}>{count}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#374151",marginTop:2}}>{info.label}</div>
                  {expired>0&&<div style={{fontSize:11,color:"#ef4444",marginTop:2}}>⚠ {expired} expiré{expired>1?"s":""}</div>}
                </div>
              );
            })}
          </div>

          {/* Liste des écoles avec gestion plan */}
          {chargement ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement…</div>
          ) : ecoles.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune école.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {ecoles.filter(e=>
                e.nom?.toLowerCase().includes(recherche.toLowerCase())||
                e._id?.toLowerCase().includes(recherche.toLowerCase())
              ).map(ecole=>{
                const p = PLANS[ecole.plan||"gratuit"] || PLANS.gratuit;
                const expired = ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
                const isOpen = planModal?._id===ecole._id;
                return (
                  <div key={ecole._id} style={{background:"#fff",borderRadius:12,overflow:"hidden",
                    boxShadow:"0 2px 12px rgba(0,32,80,0.07)",border:`1px solid ${isOpen?C.blue:"#e5e7eb"}`}}>
                    {/* Ligne école */}
                    <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{fontWeight:800,fontSize:14,color:C.blueDark}}>{ecole.nom}</div>
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{ecole.ville} · <code style={{fontSize:10}}>{ecole._id}</code></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{display:"inline-block",padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:800,
                          background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur}}>
                          {expired?"⚠ Expiré":p.label}
                        </span>
                        {ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&(
                          <span style={{fontSize:11,color:expired?"#ef4444":"#9ca3af"}}>
                            Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </div>
                      <button onClick={()=>{
                          if(isOpen){setPlanModal(null);setConfirmDowngrade(false);}
                          else{
                            setPlanModal(ecole);
                            setPlanChoix(ecole.plan||"gratuit");
                            setPlanDuree(365);
                            setTimeout(()=>planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}),50);
                          }
                        }}
                        style={{background:isOpen?"#0369a1":"#e0f2fe",color:isOpen?"#fff":"#0369a1",
                          border:"none",padding:"8px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                          whiteSpace:"nowrap",minWidth:130}}>
                        {isOpen?"▲ Fermer":"✏ Modifier le plan"}
                      </button>
                    </div>

                    {/* Panneau plan inline */}
                    {isOpen && (
                      <div ref={planPanelRef} style={{borderTop:`2px solid ${PLANS[planChoix]?.couleur||C.blue}`,
                        padding:"20px 18px 18px",background:"#f9fafb"}}>
                        <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
                          Choisir le nouveau plan
                        </label>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:16}}>
                          {Object.entries(PLANS).map(([key,info])=>(
                            <button key={key} onClick={()=>{setPlanChoix(key);setConfirmDowngrade(false);}}
                              style={{border:`2px solid ${planChoix===key?info.couleur:"#e5e7eb"}`,borderRadius:10,
                                padding:"12px 10px",cursor:"pointer",textAlign:"left",
                                background:planChoix===key?info.bg:"#fff",transition:"all 0.15s"}}>
                              <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
                              <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>
                                {info.eleveLimit===Infinity?"Illimité":`≤ ${info.eleveLimit} élèves`}
                              </div>
                            </button>
                          ))}
                        </div>

                        {planChoix!=="gratuit" && (
                          <div style={{marginBottom:16}}>
                            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
                              Durée
                            </label>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {PLAN_DUREES.map(d=>(
                                <button key={d.jours} onClick={()=>setPlanDuree(d.jours)}
                                  style={{border:`2px solid ${planDuree===d.jours?C.blue:"#e5e7eb"}`,borderRadius:8,
                                    padding:"7px 16px",cursor:"pointer",
                                    background:planDuree===d.jours?"#e0f2fe":"#fff",
                                    color:planDuree===d.jours?C.blue:"#374151",
                                    fontWeight:planDuree===d.jours?700:400,fontSize:13}}>
                                  {d.label}
                                </button>
                              ))}
                            </div>
                            <p style={{margin:"8px 0 0",fontSize:12,color:"#6b7280"}}>
                              Expiration : <strong style={{color:C.blueDark}}>{new Date(Date.now()+planDuree*86400000).toLocaleDateString("fr-FR")}</strong>
                            </p>
                          </div>
                        )}

                        {msgSucces && (
                          <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:12,fontSize:13,color:"#065f46",fontWeight:700}}>
                            {msgSucces}
                          </div>
                        )}
                        {confirmDowngrade && (
                          <div style={{background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
                            <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:"#991b1b"}}>⚠️ Confirmer la désactivation du plan payant ?</p>
                            <p style={{margin:0,fontSize:12,color:"#7f1d1d"}}>Cette école passera au plan Gratuit (≤ 50 élèves). Cette action ne peut pas être annulée automatiquement.</p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                          <button onClick={()=>{setPlanModal(null);setConfirmDowngrade(false);}}
                            style={{background:"#f3f4f6",border:"none",padding:"9px 20px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
                            Annuler
                          </button>
                          <button onClick={sauvegarderPlan} disabled={planSaving||!!msgSucces}
                            style={{background:confirmDowngrade?`linear-gradient(90deg,#ef4444,#dc2626)`:`linear-gradient(90deg,${C.blue},${C.green})`,
                              border:"none",color:"#fff",padding:"9px 28px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                              opacity:(planSaving||!!msgSucces)?0.7:1}}>
                            {planSaving?"Sauvegarde…":confirmDowngrade?"⚠️ Oui, désactiver":"✅ Confirmer le plan"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Écoles ── */}
      {ongletSA==="ecoles" && <>

      {/* Barre d'outils */}
      <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <input value={recherche} onChange={e=>setRecherche(e.target.value)}
          placeholder="🔍 Rechercher une école…"
          style={{...S.input,flex:1,minWidth:200}}/>
        <button onClick={()=>setCreationOuverte(true)}
          style={{...S.btn(C.blue),padding:"8px 18px",fontSize:13,background:`linear-gradient(90deg,${C.blue},${C.green})`}}>
          + Nouvelle école
        </button>
        <button onClick={chargerEcoles}
          style={{...S.btn("#6b7280"),background:"#f3f4f6",color:"#374151",padding:"8px 14px",fontSize:13}}>
          ↻ Actualiser
        </button>
      </div>

      {/* Statistiques globales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        {[
          {label:"Écoles totales",val:ecoles.length,icon:"🏫",color:C.blue},
          {label:"Écoles actives",val:ecoles.filter(e=>e.actif).length,icon:"✅",color:C.green},
          {label:"Écoles inactives",val:ecoles.filter(e=>!e.actif).length,icon:"⛔",color:"#ef4444"},
          {label:"Élèves total",val:Object.values(stats).reduce((s,v)=>s+(v.eleves||0),0),icon:"👥",color:"#8b5cf6"},
        ].map(({label,val,icon,color})=>(
          <div key={label} style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderLeft:`4px solid ${color}`}}>
            <div style={{fontSize:22}}>{icon}</div>
            <div style={{fontSize:24,fontWeight:900,color,marginTop:4}}>{chargement?"…":val}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tableau des écoles */}
      <div style={S.card}>
        {chargement ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement des écoles…</div>
        ) : ecolesFiltrees.length===0 ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
            {recherche ? "Aucune école ne correspond à la recherche." : "Aucune école enregistrée."}
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["Code","École","Ville/Pays","Créée le","Statut","Plan","Élèves","Comptes","Actions"].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecolesFiltrees.map(ecole=>{
                const st = stats[ecole._id]||{};
                return (
                  <tr key={ecole._id} style={{transition:"background .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={S.td}>
                      <code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11,color:C.blue,fontWeight:700}}>
                        {ecole._id}
                      </code>
                    </td>
                    <td style={S.td}><strong>{ecole.nom}</strong></td>
                    <td style={S.td}>{ecole.ville}{ecole.pays&&ecole.pays!=="Guinée"?`, ${ecole.pays}`:""}</td>
                    <td style={S.td}>{ecole.createdAt?new Date(ecole.createdAt).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={S.td}><span style={S.badge(ecole.actif)}>{ecole.actif?"Actif":"Inactif"}</span></td>
                    <td style={S.td}>
                      <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-start"}}>
                        {(()=>{
                          const p=PLANS[ecole.plan]||PLANS.gratuit;
                          const expired=ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
                          return (<>
                            <span style={{
                              display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                              background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur,
                            }}>
                              {expired?"⚠ Expiré":p.label}
                            </span>
                            {ecole.plan!=="gratuit"&&ecole.planExpiry&&(
                              <span style={{fontSize:9,color:expired?"#ef4444":"#9ca3af"}}>
                                Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </>);
                        })()}
                      </div>
                    </td>
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.blue}}>{st.eleves??"…"}</td>
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.green}}>{st.comptes??"…"}</td>
                    <td style={S.td}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{
                            if(planModal?._id===ecole._id){setPlanModal(null);setConfirmDowngrade(false);}
                            else{
                              setPlanModal(ecole);
                              setPlanChoix(ecole.plan||"gratuit");
                              setPlanDuree(365);
                              setTimeout(()=>planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50);
                            }
                          }}
                          style={{...S.btn(C.blue),background:planModal?._id===ecole._id?"#0369a1":"#e0f2fe",color:planModal?._id===ecole._id?"#fff":"#0369a1"}}>
                          {planModal?._id===ecole._id?"▲ Fermer":"Gérer le plan"}
                        </button>
                        <button onClick={()=>setConfirmation({ecole,action:"toggle"})}
                          style={{...S.btn(ecole.actif?C.blue:C.green),background:ecole.actif?"#fee2e2":"#d1fae5",color:ecole.actif?"#991b1b":"#065f46"}}>
                          {ecole.actif?"Désactiver":"Activer"}
                        </button>
                        <button onClick={()=>setConfirmation({ecole,action:"supprimer"})}
                          style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panneau inline gestion plan */}
      {planModal && (
        <div ref={planPanelRef} style={{background:"#fff",border:`2px solid ${PLANS[planChoix]?.couleur||C.blue}`,borderRadius:14,padding:"24px 28px",marginTop:16,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.blueDark}}>Gérer le plan — {planModal.nom}</h3>
              <p style={{margin:"4px 0 0",fontSize:12,color:"#6b7280"}}>Plan actuel : <strong>{PLANS[planModal.plan]?.label||"Gratuit"}</strong></p>
            </div>
            <button onClick={()=>setPlanModal(null)}
              style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:13,color:"#6b7280"}}>
              ✕ Fermer
            </button>
          </div>

          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Choisir le plan</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
            {Object.entries(PLANS).map(([key,info])=>(
              <button key={key} onClick={()=>{setPlanChoix(key);setConfirmDowngrade(false);}}
                style={{border:`2px solid ${planChoix===key?info.couleur:"#e5e7eb"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left",
                  background:planChoix===key?info.bg:"#f9fafb",transition:"all 0.15s"}}>
                <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>{info.eleveLimit===Infinity?"Illimité":`≤ ${info.eleveLimit} élèves`}</div>
              </button>
            ))}
          </div>

          {planChoix !== "gratuit" && (
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Durée de l'abonnement</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {PLAN_DUREES.map(d=>(
                  <button key={d.jours} onClick={()=>setPlanDuree(d.jours)}
                    style={{border:`2px solid ${planDuree===d.jours?C.blue:"#e5e7eb"}`,borderRadius:8,padding:"8px 18px",cursor:"pointer",
                      background:planDuree===d.jours?"#e0f2fe":"#fff",color:planDuree===d.jours?C.blue:"#374151",
                      fontWeight:planDuree===d.jours?700:400,fontSize:13}}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p style={{margin:"10px 0 0",fontSize:12,color:"#6b7280"}}>
                Expiration : <strong style={{color:C.blueDark}}>{new Date(Date.now()+planDuree*86400000).toLocaleDateString("fr-FR")}</strong>
              </p>
            </div>
          )}

          {msgSucces && (
            <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:12,fontSize:13,color:"#065f46",fontWeight:700}}>
              {msgSucces}
            </div>
          )}
          {confirmDowngrade && (
            <div style={{background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
              <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:"#991b1b"}}>⚠️ Confirmer la désactivation du plan payant ?</p>
              <p style={{margin:0,fontSize:12,color:"#7f1d1d"}}>Cette école passera au plan Gratuit (≤ 50 élèves). Cette action ne peut pas être annulée automatiquement.</p>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:"1px solid #f0f0f0"}}>
            <button onClick={()=>setPlanModal(null)}
              style={{background:"#f3f4f6",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
              Annuler
            </button>
            <button onClick={sauvegarderPlan} disabled={planSaving||!!msgSucces}
              style={{background:confirmDowngrade?`linear-gradient(90deg,#ef4444,#dc2626)`:`linear-gradient(90deg,${C.blue},${C.green})`,
                border:"none",color:"#fff",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                opacity:(planSaving||!!msgSucces)?0.7:1}}>
              {planSaving?"Sauvegarde en cours…":confirmDowngrade?"⚠️ Oui, désactiver":"Confirmer le plan"}
            </button>
          </div>
        </div>
      )}

      {/* Fin onglet écoles */}
      </>}

      {/* Modal création d'école */}
      {creationOuverte && (
        <div style={S.overlay} onClick={()=>setCreationOuverte(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",color:C.blueDark,fontSize:17}}>➕ Créer une nouvelle école</h3>
            {[
              {label:"Nom de l'école *",key:"nom",placeholder:"Ex. : École Les Étoiles"},
              {label:"Ville *",key:"ville",placeholder:"Ex. : Conakry"},
              {label:"Pays",key:"pays",placeholder:"Ex. : Guinée"},
            ].map(({label,key,placeholder})=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</label>
                <input value={nouvelleEcole[key]} onChange={e=>setNouvelleEcole(p=>({...p,[key]:e.target.value}))}
                  placeholder={placeholder} style={{...S.input,width:"100%"}}/>
              </div>
            ))}
            {nouvelleEcole.nom && (
              <div style={{background:"#f0f4f8",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6b7280",marginBottom:14}}>
                Code école généré : <strong style={{color:C.blue}}>{genSlug(nouvelleEcole.nom)}</strong>
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setCreationOuverte(false)}
                style={{background:"#f3f4f6",border:"none",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280"}}>
                Annuler
              </button>
              <button onClick={creerEcole} disabled={!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()}
                style={{background:`linear-gradient(90deg,${C.blue},${C.green})`,border:"none",color:"#fff",
                  padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,
                  opacity:(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim())?0.5:1}}>
                Créer l'école
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation désactiver/supprimer — inline */}
      {confirmation && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginTop:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
          <h3 style={{margin:"0 0 8px",color:C.blueDark,fontSize:16,fontWeight:800}}>
            {confirmation.action==="toggle"?(confirmation.ecole.actif?"Désactiver l'école":"Activer l'école"):"Supprimer l'école"}
          </h3>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>
            {confirmation.action==="toggle"
              ?`Confirmer ${confirmation.ecole.actif?"la désactivation":"l'activation"} de "${confirmation.ecole.nom}" ?`
              :`Cette action masquera définitivement "${confirmation.ecole.nom}". Confirmer ?`}
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setConfirmation(null)}
              style={{background:"#f3f4f6",border:"none",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
              Annuler
            </button>
            <button onClick={()=>confirmation.action==="toggle"?toggleActif(confirmation.ecole):supprimerEcole(confirmation.ecole)}
              style={{background:confirmation.action==="supprimer"?"#ef4444":`linear-gradient(90deg,${C.blue},${C.green})`,
                border:"none",color:"#fff",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function App() {
  const [utilisateur,setUtilisateur]=useState(null);
  const [page,setPage]=useState(null);
  const [rechercheOuverte,setRechercheOuverte]=useState(false);
  const [notifOuvert,setNotifOuvert]=useState(false);
  const [notifListe,setNotifListe]=useState([]);
  const [notifNonLues,setNotifNonLues]=useState(0);
  const [profilOuvert,setProfilOuvert]=useState(false);
  const [aideOuverte,setAideOuverte]=useState(false);
  const [schoolId,setSchoolId]=useState(()=>{
    const params=new URLSearchParams(window.location.search);
    const fromUrl=params.get("school");
    if(fromUrl){localStorage.setItem("LC_schoolId",fromUrl);}
    return fromUrl||localStorage.getItem("LC_schoolId")||"citadelle";
  });
  const [schoolInfoState,setSchoolInfo]=useState(SCHOOL_INFO_DEFAUT);
  const [annee,setAnneeState]=useState(()=>localStorage.getItem("LC_annee")||"2025-2026");
  const [verrous,setVerrous]=useState({comptable:false,primaire:false,secondaire:false});
  const [msgsNonLus,setMsgsNonLus]=useState(0); // badge messages sidebar
  const [totalElevesActifs,setTotalElevesActifs]=useState(0); // comptage toutes sections
  const [nowTs,setNowTs]=useState(() => Date.now());
  const [toasts,setToasts]=useState([]);
  const toast=(msg,type="success")=>{
    const id=Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  };
  const logAction=(action,details="",auteur="")=>{
    try{
      const sid=localStorage.getItem("LC_schoolId")||"citadelle";
      addDoc(collection(db,"ecoles",sid,"historique"),{action,details,auteur,date:Date.now()}).catch(()=>{});
    }catch{
      // Logging is best-effort only.
    }
  };
  const [onboardingOuvert,setOnboardingOuvert]=useState(false);
  const [sidebarOuvert,setSidebarOuvert]=useState(false);
  const [modeSombre,setModeSombre]=useState(()=>localStorage.getItem("LC_theme")==="dark");
  const [estHorsLigne,setEstHorsLigne]=useState(!navigator.onLine);
  const [promptInstall,setPromptInstall]=useState(null);
  const [installVisible,setInstallVisible]=useState(false);

  useEffect(()=>{
    const timer = window.setInterval(()=>setNowTs(Date.now()), 60000);
    return ()=>window.clearInterval(timer);
  },[]);

  // ── PWA : détection hors ligne ───────────────────────────────
  useEffect(()=>{
    const goOn  = ()=>setEstHorsLigne(false);
    const goOff = ()=>setEstHorsLigne(true);
    window.addEventListener("online",  goOn);
    window.addEventListener("offline", goOff);
    return ()=>{ window.removeEventListener("online",goOn); window.removeEventListener("offline",goOff); };
  },[]);

  // ── PWA : prompt d'installation (Android Chrome / Edge) ──────
  useEffect(()=>{
    const handler=(e)=>{ e.preventDefault(); setPromptInstall(e); setInstallVisible(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return ()=>window.removeEventListener("beforeinstallprompt", handler);
  },[]);

  const installerApp=async()=>{
    if(!promptInstall)return;
    promptInstall.prompt();
    const {outcome}=await promptInstall.userChoice;
    if(outcome==="accepted") setInstallVisible(false);
    setPromptInstall(null);
  };
  const [isMobile,setIsMobile]=useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);

  useEffect(()=>{
    document.body.classList.toggle("mode-sombre", modeSombre);
    localStorage.setItem("LC_theme", modeSombre?"dark":"light");
  },[modeSombre]);

  // Ctrl+K / ⌘K — ouvrir la recherche globale  |  ? — aide raccourcis
  useEffect(()=>{
    const fn=(e)=>{
      if((e.ctrlKey||e.metaKey) && e.key==="k"){
        e.preventDefault();
        if(utilisateur && !["enseignant","parent"].includes(utilisateur.role))
          setRechercheOuverte(o=>!o);
      }
      // ? — aide clavier (seulement si pas de champ texte actif)
      if(e.key==="?" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){
        e.preventDefault();
        if(utilisateur) setAideOuverte(o=>!o);
      }
      // Escape — fermer les dropdowns/panneaux
      if(e.key==="Escape"){
        setNotifOuvert(false);
        setProfilOuvert(false);
        setAideOuverte(false);
      }
    };
    window.addEventListener("keydown",fn);
    return ()=>window.removeEventListener("keydown",fn);
  },[utilisateur]);

  const setAnnee=(val)=>{
    setAnneeState(val);
    localStorage.setItem("LC_annee",val);
    // Sync to Firestore
    setDoc(doc(db,"config","annee"),{valeur:val}).catch(()=>{});
  };

  // Charger l'année depuis Firestore au démarrage
  useEffect(()=>{
    getDoc(doc(db,"config","annee")).then(snap=>{
      if(snap.exists())setAnneeState(snap.data().valeur||"2025-2026");
    }).catch(()=>{});
  },[]);

  // Charger les infos de l'école depuis Firestore (temps réel)
  useEffect(()=>{
    if(!schoolId||schoolId==="superadmin"){
      document.documentElement.style.setProperty("--sc1","#0A1628");
      document.documentElement.style.setProperty("--sc2","#00C48C");
      return;
    }
    const unsub = onSnapshot(doc(db,"ecoles",schoolId),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        const D = SCHOOL_INFO_DEFAUT;
        setSchoolInfo({
          ...D,
          ...d,           // tous les champs Firestore (blocageParentImpaye, triEleves, matricule*, etc.)
          nom:       d.nom       || D.nom,
          type:      d.type      || D.type,
          ville:     d.ville     || D.ville,
          pays:      d.pays      || D.pays,
          couleur1:  d.couleur1  || D.couleur1,
          couleur2:  d.couleur2  || D.couleur2,
          logo:      d.logo      || D.logo,
          devise:    d.devise    || D.devise,
          ministere: d.ministere || D.ministere,
          ire:       d.ire       || D.ire,
          dpe:       d.dpe       || D.dpe,
          agrement:  d.agrement  || D.agrement,
          moisDebut: d.moisDebut || D.moisDebut,
          plan:      d.plan      || "gratuit",
          planExpiry:d.planExpiry|| null,
          accueil:   d.accueil   || D.accueil,
        });
        if(d.verrous) setVerrous(d.verrous);
        // Sync CSS custom properties for school branding
        const r = document.documentElement.style;
        r.setProperty("--sc1", d.couleur1 || "#0A1628");
        r.setProperty("--sc2", d.couleur2 || "#00C48C");
      }
    });
    return ()=>unsub();
  },[schoolId]);

  // Badge messages non lus (côté école) — écoute en temps réel
  useEffect(()=>{
    if(!schoolId||schoolId==="superadmin") return;
    const unsub = onSnapshot(collection(db,"ecoles",schoolId,"messages"),(snap)=>{
      const nonLus = snap.docs.filter(d=>d.data().expediteur==="parent"&&!d.data().lu).length;
      setMsgsNonLus(nonLus);
    });
    return ()=>unsub();
  },[schoolId]);

  // Comptage élèves actifs toutes sections (pour vérification plan)
  useEffect(()=>{
    if(!schoolId||schoolId==="superadmin") return;
    const colls = ["elevesCollege","elevesPrimaire","elevesLycee"];
    const counts = {elevesCollege:0, elevesPrimaire:0, elevesLycee:0};
    const unsubs = colls.map(coll=>
      onSnapshot(collection(db,"ecoles",schoolId,coll),(snap)=>{
        counts[coll] = snap.docs.filter(d=>d.data().statut==="Actif").length;
        setTotalElevesActifs(Object.values(counts).reduce((a,b)=>a+b,0));
      })
    );
    return ()=>unsubs.forEach(u=>u());
  },[schoolId]);

  // Centre de notifications — 10 dernières actions de l'historique
  useEffect(()=>{
    if(!schoolId||schoolId==="superadmin") return;
    const q=query(collection(db,"ecoles",schoolId,"historique"),orderBy("date","desc"),limit(10));
    const unsub=onSnapshot(q,(snap)=>{
      const liste=snap.docs.map(d=>({id:d.id,...d.data()}));
      setNotifListe(liste);
      // Non lues = actions < 5 minutes
      const cinqMin=Date.now()-5*60*1000;
      setNotifNonLues(liste.filter(n=>n.date>cinqMin).length);
    });
    return ()=>unsub();
  },[schoolId]);

  // Écoute l'état Firebase Auth — charge le profil depuis /users/{uid}
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth, async(firebaseUser)=>{
      if(!firebaseUser){
        // Session Firebase expirée ou déconnexion — vider l'état
        setUtilisateur(null);
        setPage(null);
        return;
      }
      try{
        const profil=await getDoc(doc(db,"users",firebaseUser.uid));
        if(profil.exists()){
          const d=profil.data();
          const sid=d.schoolId;
          setSchoolId(sid);
          localStorage.setItem("LC_schoolId",sid);
          const premiereCo=!!d.premiereCo;
          const compteDocId=d.compteDocId||null;
          setUtilisateur({uid:firebaseUser.uid, login:d.login, nom:d.nom, role:d.role, premiereCo, compteDocId, schoolId:sid});
          setPage(p=>p||ACCES[d.role][0]);
        }
      }catch(e){
        console.error("Erreur chargement profil:", e);
      }
    });
    return ()=>unsub();
  },[]);

  // ── Calcul planInfo (freemium + période de grâce 7 jours) ───
  const GRACE_MS      = 7 * 86400000; // 7 jours de grâce après expiration
  const planCourant   = schoolInfoState.plan || "gratuit";
  const planExpiry    = schoolInfoState.planExpiry || null;
  const now           = nowTs;
  const planExpiryBrut = planCourant !== "gratuit" && planExpiry && now > planExpiry;
  const enPeriodeGrace = planExpiryBrut && now < planExpiry + GRACE_MS;
  const planEstExpire  = planExpiryBrut && !enPeriodeGrace; // vraiment expiré (après grâce)
  const joursGrace     = enPeriodeGrace ? Math.ceil((planExpiry + GRACE_MS - now) / 86400000) : null;
  const joursRestants  = planExpiry && !planExpiryBrut ? Math.ceil((planExpiry - now) / 86400000) : null;
  // Pendant la période de grâce : on garde les limites du plan payant
  const eleveLimit    = planEstExpire
    ? PLANS.gratuit.eleveLimit
    : (PLANS[planCourant]?.eleveLimit ?? PLANS.gratuit.eleveLimit);
  const planInfo = {
    planCourant,
    planExpiry,
    planEstExpire,
    enPeriodeGrace,
    joursGrace,
    joursRestants,
    eleveLimit,
    totalElevesActifs,
    peutAjouterEleve: totalElevesActifs < eleveLimit,
    planLabel: PLANS[planCourant]?.label ?? "Gratuit",
  };

  // ── Push notifications helper ────────────────────────────────
  const envoyerPush = async(cibles, titre, corps, url="/") => {
    const sid = localStorage.getItem("LC_schoolId")||"citadelle";
    const headers = await getAuthHeaders({"Content-Type":"application/json"});
    fetch("/api/push",{
      method:"POST",
      headers,
      body:JSON.stringify({schoolId:sid,cibles,titre,corps,url}),
    }).catch(()=>{});
  };

  // Abonnement push après login (silencieux si refus)
  const sAbonnerAuxPush = async(utilisateurCo, sid) => {
    try{
      if(!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const perm = await Notification.requestPermission();
      if(perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      });
      // Sauvegarde la souscription dans Firestore
      const id = btoa(sub.endpoint).slice(-20);
      await setDoc(doc(db,"ecoles",sid,"pushSubs",id),{
        subscription: sub.toJSON(),
        role: utilisateurCo.role,
        nom: utilisateurCo.nom,
        updatedAt: Date.now(),
      });
    }catch{
      // Push subscription is optional.
    }
  };

  const connecter=(c,sid)=>{
    if(sid){ setSchoolId(sid); localStorage.setItem("LC_schoolId",sid); }
    setUtilisateur(c);
    setPage(ACCES[c.role][0]);
    logAction("Connexion",`${c.nom} (${c.label})`,c.nom);
    // Abonnement push en arrière-plan
    const schoolIdEffectif = sid || localStorage.getItem("LC_schoolId") || "citadelle";
    sAbonnerAuxPush(c, schoolIdEffectif);
  };
  const deconnecter=()=>{
    signOut(auth).catch(()=>{});
    setUtilisateur(null);
    setPage(null);
  };

  const schoolInfo = (!schoolId || schoolId === "superadmin") ? SCHOOL_INFO_DEFAUT : schoolInfoState;
  const moisAnnee   = calcMoisAnnee(schoolInfo.moisDebut||"Octobre");
  const moisSalaire = calcMoisSalaire(schoolInfo.moisDebut||"Octobre");

  if(!utilisateur && page==="inscription")return <Inscription/>;

  // 1. Landing EduGest (page produit, visible si aucune page sélectionnée)
  if(!utilisateur && !page) return (
    <LandingEduGest
      onConnexion={()=>setPage("login")}
      onInscription={()=>setPage("inscription")}
    />
  );

  // 2. Portail public de l'école (si activé, avant le formulaire de connexion)
  if(!utilisateur && page==="login" && schoolInfo.accueil?.active) return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
      <PortailPublic onConnexion={()=>setPage("connexion")}/>
    </SchoolContext.Provider>
  );

  // 3. Formulaire de connexion
  if(!utilisateur)return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
      <GlobalStyles/>
      <Connexion onLogin={connecter} onInscription={()=>{ signOut(auth).catch(()=>{}); setUtilisateur(null); setPage("inscription"); }}/>
    </SchoolContext.Provider>
  );

  // Forcer le changement de mot de passe à la première connexion
  if(utilisateur.premiereCo) return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
      <ChangerMotDePasseModal
        utilisateur={utilisateur}
        onDone={()=>setUtilisateur(u=>({...u,premiereCo:false}))}
      />
    </SchoolContext.Provider>
  );

  // Portail dédié aux enseignants — interface séparée du shell principal
  if(utilisateur.role==="enseignant") return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
      <GlobalStyles/>
      <PortailEnseignant utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo}/>
    </SchoolContext.Provider>
  );

  // Portail dédié aux parents
  if(utilisateur.role==="parent") return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
      <GlobalStyles/>
      <PortailParent utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo}/>
    </SchoolContext.Provider>
  );

  const modulesVisibles=MODULES.filter(m=>ACCES[utilisateur.role].includes(m.id));
  const role = utilisateur.role;
  const estAdmin = role==="admin" || role==="direction";
  // Admin/direction : lecture seule totale (ni créer ni modifier)
  // Les autres rôles : peuvent toujours créer ; modifier/supprimer selon le verrou de l'admin
  const readOnly = estAdmin;
  const couleur2 = schoolInfo.couleur2 || C.green;

  return (
    <SchoolContext.Provider value={{schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo}}>
    <GlobalStyles/>

    <ToastContainerView toasts={toasts}/>

    {rechercheOuverte&&(
      <RechercheGlobale
        modules={modulesVisibles}
        onNaviguer={id=>{setPage(id);setRechercheOuverte(false);}}
        onFermer={()=>setRechercheOuverte(false)}
      />
    )}

{/* ── Bandeau INSTALLER L'APPLICATION ─────────────────── */}
    {installVisible&&promptInstall&&(
      <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",
        zIndex:9998,background:"#0A1628",color:"#fff",borderRadius:14,
        padding:"12px 20px",display:"flex",alignItems:"center",gap:14,
        boxShadow:"0 8px 32px rgba(0,0,0,0.45)",maxWidth:360,width:"calc(100% - 32px)"}}>
        <span style={{fontSize:28}}>📲</span>
        <div style={{flex:1}}>
          <p style={{margin:"0 0 2px",fontWeight:800,fontSize:14}}>Installer EduGest</p>
          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.65)"}}>Accès rapide, fonctionne hors ligne</p>
        </div>
        <button onClick={installerApp}
          style={{background:"#00C48C",color:"#fff",border:"none",borderRadius:8,
            padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>
          Installer
        </button>
        <button onClick={()=>setInstallVisible(false)}
          style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",
            fontSize:18,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>
      </div>
    )}

    <div className="lc-app-root" style={{overflow:"hidden",display:"flex",background:C.bg}}>
      {/* Overlay mobile */}
      {sidebarOuvert&&<div onClick={()=>setSidebarOuvert(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:40}}/>}
      <aside style={{position:"fixed",top:0,bottom:0,left:0,width:228,zIndex:50,background:schoolInfo.couleur1||C.sidebar,display:"flex",flexDirection:"column",
        transform:isMobile&&!sidebarOuvert?"translateX(-100%)":"translateX(0)",transition:"transform 0.25s ease"}}>
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)",textAlign:"center"}}>
          <Logo width={140} height={46} variant="light"/>
          <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            {schoolInfo.logo
              ? <img src={schoolInfo.logo} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:6,marginBottom:4,display:"block",margin:"0 auto 4px"}}/>
              : null}
            <p style={{margin:0,fontSize:12,fontWeight:800,color:couleur2}}>{schoolInfo.nom}</p>
            <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.3)"}}>{schoolInfo.ville||"Kindia"} · {annee||getAnnee()}</p>
          </div>
        </div>
        <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:3,overflowY:"auto",minHeight:0}}>
          {modulesVisibles.map(m=>{
            const actif=page===m.id;
            return <button key={m.id} onClick={()=>{setPage(m.id);if(isMobile)setSidebarOuvert(false);}} style={{
              display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,border:"none",cursor:"pointer",textAlign:"left",width:"100%",
              background:actif?`${C.green}22`:"transparent",transition:"background .15s"}}>
              <span style={{fontSize:15}}>{m.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:12,fontWeight:800,color:actif?C.green:"rgba(255,255,255,0.82)"}}>{m.label}</p>
                <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.35)"}}>{m.desc}</p>
              </div>
              {m.id==="messages"&&msgsNonLus>0&&(
                <span style={{background:"#ef4444",color:"#fff",borderRadius:"50%",minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,padding:"0 4px",flexShrink:0}}>
                  {msgsNonLus}
                </span>
              )}
              {actif&&msgsNonLus===0&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:C.green,flexShrink:0}}/>}
            </button>;
          })}
        </nav>
        <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
              {utilisateur.nom[0]}
            </div>
            <div>
              <p style={{margin:0,fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.9)"}}>{utilisateur.nom}</p>
              <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)"}}>{utilisateur.label}</p>
            </div>
          </div>
          <button onClick={deconnecter} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.5)",padding:"6px",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:600}}>
            ⬅ Se déconnecter
          </button>
          {estHorsLigne&&(
            <div style={{marginTop:8,background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:14}}>📡</span>
              <div>
                <p style={{margin:0,fontSize:10,fontWeight:800,color:"#fbbf24"}}>Mode hors ligne</p>
                <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)"}}>Navigation disponible</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main style={{flex:1,marginLeft:isMobile?0:228,minWidth:0,display:"flex",flexDirection:"column",height:"100dvh",overflow:"hidden"}}>
        <header style={{background:"#fff",borderBottom:`3px solid ${C.green}`,padding:"0 12px",height:52,display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:30,minWidth:0}}>
          {/* Bouton hamburger mobile */}
          <button onClick={()=>setSidebarOuvert(v=>!v)} style={{display:isMobile?"flex":"none",flexShrink:0,alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:6,color:C.blueDark,fontSize:22}}>
            ☰
          </button>
          <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
            <span style={{fontSize:14,fontWeight:800,color:C.blueDark,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>
              {modulesVisibles.find(m=>m.id===page)?.icon} {modulesVisibles.find(m=>m.id===page)?.label}
            </span>
            {readOnly&&!isMobile&&<span style={{marginLeft:10,fontSize:11,color:"#d97706",fontWeight:700,background:"#fef3e0",padding:"2px 8px",borderRadius:10}}>👁️ Lecture seule</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {estHorsLigne&&(
              <div title="Mode hors ligne — données depuis le cache" style={{display:"flex",alignItems:"center",gap:4,background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,color:"#92400e",flexShrink:0}}>
                <span style={{fontSize:13}}>📡</span>
                {!isMobile&&<span>Hors ligne</span>}
              </div>
            )}
            {/* ── Alerte expiration abonnement ── */}
            {planInfo && planInfo.joursRestants !== null && planInfo.joursRestants <= 30 && ["admin","direction"].includes(utilisateur?.role) && (
              <div title={`Abonnement ${planInfo.planLabel} — expire dans ${planInfo.joursRestants} jour(s)`}
                style={{display:"flex",alignItems:"center",gap:4,
                  background: planInfo.joursRestants<=7?"#fee2e2":"#fef3c7",
                  border:`1px solid ${planInfo.joursRestants<=7?"#f87171":"#f59e0b"}`,
                  borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,
                  color:planInfo.joursRestants<=7?"#b91c1c":"#92400e",flexShrink:0,cursor:"default"}}>
                <span style={{fontSize:13}}>{planInfo.joursRestants<=7?"🔴":"🟡"}</span>
                {!isMobile&&<span>Abonnement : {planInfo.joursRestants<=0?"EXPIRÉ":`${planInfo.joursRestants}j`}</span>}
              </div>
            )}
            <button onClick={()=>setRechercheOuverte(true)}
              title="Recherche globale (Ctrl+K)"
              style={{display:"flex",alignItems:"center",gap:isMobile?0:6,background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:isMobile?17:12,color:"#6b7280",fontWeight:600}}>
              🔍{!isMobile&&<><span>Rechercher</span><kbd style={{background:"#e2e8f0",border:"1px solid #cbd5e1",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#94a3b8",marginLeft:4}}>Ctrl K</kbd></>}
            </button>
            <button onClick={()=>setModeSombre(v=>!v)}
              title={modeSombre?"Mode clair":"Mode sombre"}
              style={{background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>
              {modeSombre?"☀️":"🌙"}
            </button>

            {/* ── Cloche notifications ── */}
            <div style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>{setNotifOuvert(v=>!v);setProfilOuvert(false);setNotifNonLues(0);}}
                title="Notifications récentes"
                style={{position:"relative",background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>
                🔔
                {notifNonLues>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{notifNonLues}</span>}
              </button>
              {notifOuvert&&(
                <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:320,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>Activité récente</span>
                    <button onClick={()=>setNotifOuvert(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",padding:0}}>✕</button>
                  </div>
                  <div style={{maxHeight:320,overflowY:"auto"}}>
                    {notifListe.length===0
                      ? <div style={{padding:"24px 16px",textAlign:"center",color:"#94a3b8",fontSize:12}}>Aucune activité récente</div>
                      : notifListe.map((n,i)=>{
                          const age=nowTs-n.date;
                          const ageStr=age<60000?"À l'instant":age<3600000?`${Math.floor(age/60000)}min`:age<86400000?`${Math.floor(age/3600000)}h`:`${Math.floor(age/86400000)}j`;
                          const isNew=age<5*60*1000;
                          return <div key={n.id||i} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",background:isNew?"#f0fdf4":"#fff",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:isNew?"#22c55e":"#e2e8f0",marginTop:5,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:12,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.action}</p>
                              {n.details&&<p style={{margin:"2px 0 0",fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.details}</p>}
                            </div>
                            <span style={{fontSize:10,color:"#94a3b8",flexShrink:0,marginTop:2}}>{ageStr}</span>
                          </div>;
                        })
                    }
                  </div>
                  <div style={{padding:"8px 16px",borderTop:"1px solid #f1f5f9"}}>
                    <button onClick={()=>{setNotifOuvert(false);setPage("historique");}} style={{width:"100%",background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.blue,fontWeight:700,padding:"4px 0",textAlign:"center"}}>
                      Voir tout l'historique →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Avatar + menu profil ── */}
            <div style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>{setProfilOuvert(v=>!v);setNotifOuvert(false);}}
                title="Mon profil"
                style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>
                  {utilisateur.nom[0]}
                </div>
                {!isMobile&&<>
                  <span style={{fontSize:12,fontWeight:700,color:C.blueDark}}>{utilisateur.nom}</span>
                  <Badge color={utilisateur.role==="admin"?"purple":utilisateur.role==="comptable"?"teal":"blue"}>{utilisateur.label}</Badge>
                </>}
              </button>
              {profilOuvert&&(
                <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:220,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
                    <p style={{margin:0,fontSize:13,fontWeight:800,color:"#0f172a"}}>{utilisateur.nom}</p>
                    <p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}>{utilisateur.label} · {schoolInfo.nom}</p>
                  </div>
                  {["admin","superadmin"].includes(utilisateur.role)&&(
                    <button onClick={()=>{setProfilOuvert(false);setPage("parametres");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"left",fontWeight:600}}>
                      🏫 <span>Paramètres école</span>
                    </button>
                  )}
                  <button onClick={()=>{setProfilOuvert(false);setAideOuverte(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"left",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
                    ⌨️ <span>Raccourcis clavier</span><kbd style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#94a3b8"}}>?</kbd>
                  </button>
                  <button onClick={()=>{setProfilOuvert(false);deconnecter();}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#ef4444",textAlign:"left",fontWeight:700}}>
                    ⬅ <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div style={{flex:1,overflowY:"auto"}}>
          <ErrorBoundary key={page}>
            {page==="superadmin_panel" && <SuperAdminPanel/>}
            {page==="accueil"         && <TableauDeBord annee={annee}/>}
            {page==="historique"      && <HistoriqueActions/>}
            {page==="parametres"      && <ParametresEcole/>}
            {page==="admin_panel" && <AdminPanel annee={annee} setAnnee={setAnnee} verrous={verrous} schoolId={schoolId}/>}
            {page==="fondation"   && <Fondation readOnly={readOnly} annee={annee} userRole={utilisateur.role}/>}
            {page==="compta"      && <Comptabilite readOnly={readOnly} annee={annee} userRole={utilisateur.role} verrouOuvert={!!verrous.comptable}/>}
            {page==="primaire"    && <Ecole titre="Direction du Primaire" couleur={C.green} cleClasses="classesPrimaire" cleEns="ensPrimaire" cleNotes="notesPrimaire" cleEleves="elevesPrimaire" avecEns={true} userRole={utilisateur.role} annee={annee} classesPredefinies={CLASSES_PRIMAIRE} maxNote={10} matieresPredefinies={MATIERES_PRIMAIRE} readOnly={readOnly} verrouOuvert={!!verrous.primaire}/>}
            {page==="secondaire"  && <Secondaire userRole={utilisateur.role} annee={annee} readOnly={readOnly} verrouOuvert={!!verrous.secondaire}/>}
            {page==="calendrier"  && <Calendrier annee={annee}/>}
            {page==="examens"     && <GestionExamens/>}
            {page==="messages"    && <MessagesParents readOnly={readOnly}/>}
          </ErrorBoundary>
        </div>
      </main>
    </div>

    {/* ── Bouton flottant guide de démarrage ── */}
    {estAdmin && (
      <button onClick={()=>setOnboardingOuvert(true)}
        title="Guide de démarrage"
        style={{position:"fixed",bottom:24,left:isMobile?16:244,zIndex:200,width:44,height:44,borderRadius:"50%",background:couleur2,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.2)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
        🚀
      </button>
    )}

    {/* ── Modal Onboarding guidé ── */}
    {onboardingOuvert && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"#fff",borderRadius:18,padding:"28px 28px 24px",maxWidth:520,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{fontSize:28}}>🚀</div>
            <div>
              <h2 style={{margin:0,fontSize:17,fontWeight:900,color:C.blue}}>Guide de démarrage</h2>
              <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>Suivez ces étapes pour configurer votre école</p>
            </div>
          </div>
          {[
            {done:schoolInfo.nom!=="EduGest"&&!!schoolInfo.nom, label:"Configurer l'identité de l'école", desc:"Nom, logo, couleurs, coordonnées", action:()=>{setPage("parametres");setOnboardingOuvert(false);}},
            {done:true, label:"Créer les classes", desc:"Primaire et/ou Secondaire selon votre établissement", action:()=>{setPage("primaire");setOnboardingOuvert(false);}},
            {done:true, label:"Ajouter les enseignants", desc:"Profil, matière, prime horaire", action:()=>{setPage("primaire");setOnboardingOuvert(false);}},
            {done:true, label:"Enrôler les élèves", desc:"Via le module Comptabilité → Élèves", action:()=>{setPage("compta");setOnboardingOuvert(false);}},
            {done:true, label:"Configurer les emplois du temps", desc:"Par classe, dans chaque section", action:()=>{setPage("primaire");setOnboardingOuvert(false);}},
            {done:true, label:"Générer les états de salaires", desc:"Via Comptabilité → Salaires → Auto-générer", action:()=>{setPage("compta");setOnboardingOuvert(false);}},
          ].map((step,i)=>(
            <div key={i} onClick={step.action} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,marginBottom:6,cursor:"pointer",border:`1px solid ${step.done?"#d1fae5":"#e5e7eb"}`,background:step.done?"#f0fdf4":"#fafafa",transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=step.done?"#dcfce7":"#f0f4ff"}
              onMouseLeave={e=>e.currentTarget.style.background=step.done?"#f0fdf4":"#fafafa"}>
              <div style={{width:26,height:26,borderRadius:"50%",background:step.done?"#00C48C":C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
                {step.done?"✓":i+1}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:step.done?C.greenDk:C.blue}}>{step.label}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{step.desc}</div>
              </div>
              <span style={{fontSize:12,color:"#9ca3af"}}>→</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
            <Btn onClick={()=>setOnboardingOuvert(false)}>Fermer</Btn>
          </div>
        </div>
      </div>
    )}

    {/* ── Fermer dropdowns au clic extérieur ── */}
    {(notifOuvert||profilOuvert)&&(
      <div style={{position:"fixed",inset:0,zIndex:150}} onClick={()=>{setNotifOuvert(false);setProfilOuvert(false);}}/>
    )}

    {/* ── Modal Aide raccourcis clavier ── */}
    {aideOuverte&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setAideOuverte(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,padding:"28px",maxWidth:480,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)",maxHeight:"80vh",overflowY:"auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:24}}>⌨️</span>
              <div>
                <h2 style={{margin:0,fontSize:16,fontWeight:900,color:C.blue}}>Raccourcis clavier</h2>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#6b7280"}}>Naviguez plus vite avec le clavier</p>
              </div>
            </div>
            <button onClick={()=>setAideOuverte(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#94a3b8"}}>✕</button>
          </div>
          {[
            {groupe:"Navigation",items:[
              {keys:["Ctrl","K"],desc:"Ouvrir la recherche globale"},
              {keys:["?"],desc:"Afficher cette aide"},
              {keys:["Escape"],desc:"Fermer modal / panneau ouvert"},
            ]},
            {groupe:"Partout",items:[
              {keys:["Tab"],desc:"Passer au champ suivant"},
              {keys:["Shift","Tab"],desc:"Champ précédent"},
              {keys:["Enter"],desc:"Valider / confirmer"},
            ]},
            {groupe:"Recherche globale",items:[
              {keys:["↑","↓"],desc:"Naviguer dans les résultats"},
              {keys:["Enter"],desc:"Ouvrir le résultat sélectionné"},
              {keys:["Escape"],desc:"Fermer la recherche"},
            ]},
          ].map(({groupe,items})=>(
            <div key={groupe} style={{marginBottom:18}}>
              <p style={{margin:"0 0 8px",fontSize:10,fontWeight:900,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1}}>{groupe}</p>
              {items.map(({keys,desc})=>(
                <div key={desc} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f8fafc"}}>
                  <span style={{fontSize:12,color:"#374151"}}>{desc}</span>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    {keys.map((k,i)=>(
                      <kbd key={i} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderBottomWidth:3,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,color:"#475569",fontFamily:"monospace"}}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={{marginTop:16,textAlign:"center"}}>
            <button onClick={()=>setAideOuverte(false)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    )}

    </SchoolContext.Provider>
  );
}

