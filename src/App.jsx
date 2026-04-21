import ToastContainerView from "./components/ToastContainer";
import Logo from "./Logo";
import { getAuthHeaders } from "./apiClient";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { signOutCurrentUser, watchAuthState } from "./firebaseAuth";
import { db } from "./firebaseDb";
import {
  collection, onSnapshot, addDoc, doc, setDoc, getDoc, getDocFromServer, query, orderBy, limit
} from "firebase/firestore";
import {
  C,
  calcMoisAnnee, calcMoisSalaire, getAnnee,
  CLASSES_PRIMAIRE,
  MATIERES_PRIMAIRE, PLANS, MODULES,
  getModulesForRole, getPrimaryModuleForRole, getRoleLabelForSchool, getRoleSettingsForSchool,
} from "./constants";
import { GlobalStyles } from "./styles";
import {
  Badge, Btn, Chargement,
} from "./components/ui";

const lazyNamedExport = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const Inscription = lazy(() => import("./Inscription"));
const Connexion = lazyNamedExport(() => import("./components/Connexion"), "Connexion");
const RechercheGlobale = lazyNamedExport(() => import("./components/RechercheGlobale"), "RechercheGlobale");
const PortailPublic = lazyNamedExport(() => import("./components/PortailPublic"), "PortailPublic");
const ChangerMotDePasseModal = lazyNamedExport(() => import("./components/ChangerMotDePasseModal"), "ChangerMotDePasseModal");
const PortailEnseignant = lazyNamedExport(() => import("./components/PortailEnseignant"), "PortailEnseignant");
const PortailParent = lazyNamedExport(() => import("./components/PortailParent"), "PortailParent");
const SuperAdminPanel = lazyNamedExport(() => import("./components/SuperAdminPanel"), "SuperAdminPanel");
const TableauDeBord = lazyNamedExport(() => import("./components/TableauDeBord"), "TableauDeBord");
const HistoriqueActions = lazyNamedExport(() => import("./components/HistoriqueActions"), "HistoriqueActions");
const ParametresEcole = lazyNamedExport(() => import("./components/ParametresEcole"), "ParametresEcole");
const AdminPanel = lazyNamedExport(() => import("./components/AdminPanel"), "AdminPanel");
const Fondation = lazyNamedExport(() => import("./components/Fondation"), "Fondation");
const Comptabilite = lazyNamedExport(() => import("./components/Comptabilite"), "Comptabilite");
const Ecole = lazyNamedExport(() => import("./components/Ecole"), "Ecole");
const Secondaire = lazyNamedExport(() => import("./components/Secondaire"), "Secondaire");
const Calendrier = lazyNamedExport(() => import("./components/Calendrier"), "Calendrier");
const GestionExamens = lazyNamedExport(() => import("./components/GestionExamens"), "GestionExamens");
const MessagesParents = lazyNamedExport(() => import("./components/MessagesParents"), "MessagesParents");
const LandingEduGest = lazyNamedExport(() => import("./components/LandingEduGest"), "LandingEduGest");

function FullScreenFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#0A1628",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "#fff",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <Chargement type="liste" rows={4} />
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div style={{ padding: "22px 26px" }}>
      <Chargement rows={6} />
    </div>
  );
}

function OverlayFallback() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(10,22,40,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "84px 16px 16px",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
        }}
      >
        <Chargement type="liste" rows={4} />
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  static getDerivedStateFromError(e) { return { erreur: e }; }
  componentDidCatch(e, info) { console.error("ErrorBoundary:", e, info); }
  render() {
    if (this.state.erreur) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        height:"100%",padding:40,fontFamily:"'Segoe UI',system-ui,sans-serif",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>Attention</div>
        <h2 style={{color:"#0A1628",marginBottom:8}}>Une erreur est survenue</h2>
        <p style={{color:"#6b7280",fontSize:14,marginBottom:24,maxWidth:400}}>
          {this.state.erreur.message||"Erreur inattendue dans ce module."}
        </p>
        <button onClick={()=>this.setState({erreur:null})}
          style={{background:"#0A1628",color:"#fff",border:"none",padding:"10px 24px",
            borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:12}}>
          🔄 Reessayer
        </button>
        <button onClick={()=>window.location.reload()}
          style={{background:"none",border:"1px solid #d1d5db",color:"#6b7280",
            padding:"8px 20px",borderRadius:8,fontSize:13,cursor:"pointer"}}>
          Recharger la page
        </button>
      </div>
    );
    return this.props.children;
  }
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

  // ── PWA : detection hors ligne ───────────────────────────────
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

  // Charger l'annee depuis Firestore au demarrage
  useEffect(()=>{
    getDoc(doc(db,"config","annee")).then(snap=>{
      if(snap.exists())setAnneeState(snap.data().valeur||"2025-2026");
    }).catch(()=>{});
  },[]);

  // Charger les infos de l'école depuis Firestore (temps réel)
  useEffect(()=>{
    let actif = true;
    let accepterCache = false;
    const schoolRef = schoolId ? doc(db,"ecoles",schoolId) : null;
    const reinitialiserBranding = () => {
      setSchoolInfo(SCHOOL_INFO_DEFAUT);
      setVerrous({comptable:false,primaire:false,secondaire:false});
      document.documentElement.style.setProperty("--sc1","#0A1628");
      document.documentElement.style.setProperty("--sc2","#00C48C");
    };
    const appliquerDonneesEcole = (d) => {
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
        roleSettings: getRoleSettingsForSchool(d.roleSettings || D.roleSettings),
      });
      setVerrous(d.verrous || {comptable:false,primaire:false,secondaire:false});
      const r = document.documentElement.style;
      r.setProperty("--sc1", d.couleur1 || "#0A1628");
      r.setProperty("--sc2", d.couleur2 || "#00C48C");
    };

    reinitialiserBranding();
    if(!schoolId||schoolId==="superadmin"){
      return;
    }

    getDocFromServer(schoolRef).then((snap)=>{
      if(!actif) return;
      accepterCache = true;
      if(snap.exists()) appliquerDonneesEcole(snap.data());
      else reinitialiserBranding();
    }).catch(()=>{
      if(!actif) return;
      accepterCache = true;
    });

    const unsub = onSnapshot(schoolRef,(snap)=>{
      if(!actif) return;
      if(!accepterCache && snap.metadata?.fromCache) return;
      if(snap.exists()) appliquerDonneesEcole(snap.data());
      else reinitialiserBranding();
    });

    return ()=>{
      actif = false;
      unsub();
    };
  },[schoolId]);
  // Badge messages non lus (côte ecole) — ecoute en temps reel
  useEffect(()=>{
    if(!schoolId||schoolId==="superadmin") return;
    const unsub = onSnapshot(collection(db,"ecoles",schoolId,"messages"),(snap)=>{
      const nonLus = snap.docs.filter(d=>d.data().expediteur==="parent"&&!d.data().lu).length;
      setMsgsNonLus(nonLus);
    });
    return ()=>unsub();
  },[schoolId]);

  // Comptage eleves actifs toutes sections (pour verification plan)
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

  // Centre de notifications — 10 dernieres actions de l'historique
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

  // Écoute l'etat Firebase Auth — charge le profil depuis /users/{uid}
  useEffect(()=>{
    let actif = true;
    let unsub = () => {};

    watchAuthState(async(firebaseUser)=>{
      if(!actif) return;
      if(!firebaseUser){
        // Session Firebase expiree ou deconnexion - vider l'etat
        setUtilisateur(null);
        setPage(null);
        return;
      }
      try{
        const profil=await getDoc(doc(db,"users",firebaseUser.uid));
        if(profil.exists() && actif){
          const d=profil.data();
          if(d.statut && d.statut!=="Actif"){
            signOutCurrentUser().catch(()=>{});
            setUtilisateur(null);
            setPage(null);
            return;
          }
          const sid=d.schoolId;
          setSchoolId(sid);
          localStorage.setItem("LC_schoolId",sid);
          const premiereCo=!!d.premiereCo;
          const compteDocId=d.compteDocId||null;
          setUtilisateur({uid:firebaseUser.uid, login:d.login, nom:d.nom, role:d.role, label:d.label||d.role, premiereCo, compteDocId, schoolId:sid});
          setPage(p=>p||getPrimaryModuleForRole(d.role));
          // Prefetch des pages les plus utilisees pendant que le dashboard se rend
          import("./components/Comptabilite").catch(()=>{});
          import("./components/Ecole").catch(()=>{});
        }
      }catch(e){
        console.error("Erreur chargement profil:", e);
      }
    }).then((cleanup)=>{
      if(actif) unsub = cleanup;
      else cleanup();
    }).catch(()=>{});

    return ()=>{
      actif = false;
      unsub();
    };
  },[]);

  // ── Calcul planInfo (freemium + periode de grâce 7 jours) ───
  const GRACE_MS      = 7 * 86400000; // 7 jours de grâce apres expiration
  const planCourant   = schoolInfoState.plan || "gratuit";
  const planExpiry    = schoolInfoState.planExpiry || null;
  const now           = nowTs;
  const planExpiryBrut = planCourant !== "gratuit" && planExpiry && now > planExpiry;
  const enPeriodeGrace = planExpiryBrut && now < planExpiry + GRACE_MS;
  const planEstExpire  = planExpiryBrut && !enPeriodeGrace; // vraiment expire (apres grâce)
  const joursGrace     = enPeriodeGrace ? Math.ceil((planExpiry + GRACE_MS - now) / 86400000) : null;
  const joursRestants  = planExpiry && !planExpiryBrut ? Math.ceil((planExpiry - now) / 86400000) : null;
  // Pendant la periode de grâce : on garde les limites du plan payant
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
  useEffect(()=>{
    if(!utilisateur || !schoolId || schoolId==="superadmin") return;
    if(!["direction","admin"].includes(utilisateur.role)) return;
    let annule = false;
    (async()=>{
      try{
        const headers = await getAuthHeaders({"Content-Type":"application/json"});
        if(annule) return;
        await fetch("/api/ecole-public-sync",{
          method:"POST",
          headers,
          body:JSON.stringify({ action:"sync", schoolId }),
        });
      }catch{
        // Best effort only: keep the public school profile aligned.
      }
    })();
    return ()=>{ annule = true; };
  },[schoolId, utilisateur]);
  const envoyerPush = async(cibles, titre, corps, url="/") => {
    const sid = localStorage.getItem("LC_schoolId")||"citadelle";
    const headers = await getAuthHeaders({"Content-Type":"application/json"});
    fetch("/api/push",{
      method:"POST",
      headers,
      body:JSON.stringify({schoolId:sid,cibles,titre,corps,url}),
    }).catch(()=>{});
  };

  // Abonnement push apres login (silencieux si refus)
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
    setPage(getPrimaryModuleForRole(c.role, schoolInfo));
    const labelConnexion = getRoleLabelForSchool(c.role, schoolInfo) || c.label || c.role;
    logAction("Connexion",`${c.nom} (${labelConnexion})`,c.nom);
    // Abonnement push en arriere-plan
    const schoolIdEffectif = sid || localStorage.getItem("LC_schoolId") || "citadelle";
    sAbonnerAuxPush(c, schoolIdEffectif);
  };
  const deconnecter=()=>{
    signOutCurrentUser().catch(()=>{});
    setUtilisateur(null);
    setPage(null);
  };

  const schoolInfo = (!schoolId || schoolId === "superadmin") ? SCHOOL_INFO_DEFAUT : schoolInfoState;
  const moisAnnee   = calcMoisAnnee(schoolInfo.moisDebut||"Octobre");
  const moisSalaire = calcMoisSalaire(schoolInfo.moisDebut||"Octobre");
  const schoolContextValue = {schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo};
  useEffect(()=>{
    if(!utilisateur) return;
    const modulesCourants = getModulesForRole(utilisateur.role, schoolInfo);
    const fallbackPage = modulesCourants[0] || null;
    if(fallbackPage && !modulesCourants.includes(page)){
      setPage(fallbackPage);
    }
  },[page, schoolInfo, utilisateur]);

  if(!utilisateur && page==="inscription")return (
    <Suspense fallback={<FullScreenFallback/>}>
      <Inscription/>
    </Suspense>
  );

  // 1. Landing EduGest (page produit, visible si aucune page selectionnee)
  if(!utilisateur && !page) return (
    <Suspense fallback={<FullScreenFallback/>}>
      <LandingEduGest
        onConnexion={()=>setPage("login")}
        onInscription={()=>setPage("inscription")}
      />
    </Suspense>
  );

  // 2. Portail public de l'ecole (si active, avant le formulaire de connexion)
  if(!utilisateur && page==="login" && schoolInfo.accueil?.active) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback/>}>
        <PortailPublic onConnexion={()=>setPage("connexion")}/>
      </Suspense>
    </SchoolContext.Provider>
  );

  // 3. Formulaire de connexion
  if(!utilisateur)return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles/>
      <Suspense fallback={<FullScreenFallback/>}>
        <Connexion onLogin={connecter} onInscription={()=>{ signOutCurrentUser().catch(()=>{}); setUtilisateur(null); setPage("inscription"); }}/>
      </Suspense>
    </SchoolContext.Provider>
  );

  // Forcer le changement de mot de passe a la premiere connexion
  if(utilisateur.premiereCo) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback/>}>
        <ChangerMotDePasseModal
          utilisateur={utilisateur}
          onDone={()=>setUtilisateur(u=>({...u,premiereCo:false}))}
        />
      </Suspense>
    </SchoolContext.Provider>
  );

  // Portail dedie aux enseignants — interface separee du shell principal
  if(utilisateur.role==="enseignant") return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles/>
      <Suspense fallback={<FullScreenFallback/>}>
        <PortailEnseignant utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo}/>
      </Suspense>
    </SchoolContext.Provider>
  );

  // Portail dedie aux parents
  if(utilisateur.role==="parent") return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles/>
      <Suspense fallback={<FullScreenFallback/>}>
        <PortailParent utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo}/>
      </Suspense>
    </SchoolContext.Provider>
  );

  const modulesActifsIds = getModulesForRole(utilisateur.role, schoolInfo);
  const modulesVisibles = MODULES.filter((module) => modulesActifsIds.includes(module.id));
  const role = utilisateur.role;
  const estAdmin = role==="admin" || role==="direction";
  // Admin/direction : lecture seule totale (ni créer ni modifier)
  // Les autres rôles : peuvent toujours créer ; modifier/supprimer selon le verrou de l'admin
  const readOnly = estAdmin;
  const couleur2 = schoolInfo.couleur2 || C.green;
  const utilisateurLabel = getRoleLabelForSchool(utilisateur.role, schoolInfo) || utilisateur.label || utilisateur.role;

  return (
    <SchoolContext.Provider value={schoolContextValue}>
    <GlobalStyles/>

    <ToastContainerView toasts={toasts}/>

    {rechercheOuverte&&(
      <Suspense fallback={<OverlayFallback/>}>
        <RechercheGlobale
          modules={modulesVisibles}
          onNaviguer={id=>{setPage(id);setRechercheOuverte(false);}}
          onFermer={()=>setRechercheOuverte(false)}
        />
      </Suspense>
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
              <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)"}}>{utilisateurLabel}</p>
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
                  <Badge color={utilisateur.role==="admin"?"purple":utilisateur.role==="comptable"?"teal":"blue"}>{utilisateurLabel}</Badge>
                </>}
              </button>
              {profilOuvert&&(
                <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:220,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
                    <p style={{margin:0,fontSize:13,fontWeight:800,color:"#0f172a"}}>{utilisateur.nom}</p>
                    <p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}>{utilisateurLabel} · {schoolInfo.nom}</p>
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
            <Suspense fallback={<PageFallback/>}>
              {page==="superadmin_panel" && <SuperAdminPanel/>}
              {page==="accueil"         && <TableauDeBord annee={annee}/>}
              {page==="historique"      && <HistoriqueActions/>}
              {page==="parametres"      && <ParametresEcole/>}
              {page==="admin_panel" && <AdminPanel annee={annee} setAnnee={setAnnee} verrous={verrous} schoolId={schoolId}/>}
              {page==="fondation"   && <Fondation readOnly={readOnly} annee={annee} userRole={utilisateur.role}/>}
              {page==="compta"      && <Comptabilite readOnly={readOnly} annee={annee} userRole={utilisateur.role} verrouOuvert={!!verrous.comptable}/>}
              {page==="primaire"    && <Ecole titre={getRoleLabelForSchool("primaire", schoolInfo)} couleur={C.green} cleClasses="classesPrimaire" cleEns="ensPrimaire" cleNotes="notesPrimaire" cleEleves="elevesPrimaire" avecEns={true} userRole={utilisateur.role} annee={annee} classesPredefinies={CLASSES_PRIMAIRE} maxNote={10} matieresPredefinies={MATIERES_PRIMAIRE} readOnly={readOnly} verrouOuvert={!!verrous.primaire}/>}
              {page==="secondaire"  && <Secondaire userRole={utilisateur.role} annee={annee} readOnly={readOnly} verrouOuvert={!!verrous.secondaire} collegeLabel={getRoleLabelForSchool("college", schoolInfo)}/>}
              {page==="calendrier"  && <Calendrier annee={annee}/>}
              {page==="examens"     && <GestionExamens/>}
              {page==="messages"    && <MessagesParents readOnly={readOnly}/>}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>

    {/* ── Bouton flottant guide de demarrage ── */}
    {estAdmin && (
      <button onClick={()=>setOnboardingOuvert(true)}
        title="Guide de démarrage"
        style={{position:"fixed",bottom:24,left:isMobile?16:244,zIndex:200,width:44,height:44,borderRadius:"50%",background:couleur2,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.2)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
        🚀
      </button>
    )}

    {/* ── Modal Onboarding guide ── */}
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
            {done:true, label:"Creer les classes", desc:"Primaire et/ou Secondaire selon votre etablissement", action:()=>{setPage("primaire");setOnboardingOuvert(false);}},
            {done:true, label:"Ajouter les enseignants", desc:"Profil, matiere, prime horaire", action:()=>{setPage("primaire");setOnboardingOuvert(false);}},
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

    {/* ── Fermer dropdowns au clic exterieur ── */}
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







