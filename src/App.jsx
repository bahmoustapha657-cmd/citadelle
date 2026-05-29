import ToastContainerView from "./components/ToastContainer";
import { apiFetch, getAuthHeaders } from "./apiClient";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentUser, signOutCurrentUser } from "./firebaseAuth";
import { db } from "./firebaseDb";
import {
  collection, addDoc, doc, setDoc, getDoc,
} from "firebase/firestore";
import {
  C,
  calcMoisAnnee, calcMoisSalaire,
  PLANS, MODULES,
  getModulesForRole, getPrimaryModuleForRole, getRoleLabelForSchool,
} from "./constants";
import { GlobalStyles } from "./styles";
import { usePwaState } from "./hooks/use-pwa-state";
import { useSchoolData } from "./hooks/use-school-data";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useAuthSession } from "./hooks/use-auth-session";
import {
  ChangerMotDePasseModal, Connexion, DemoEduGest, Inscription, LandingEduGest,
  MessagesEcole, PortailEnseignant, PortailParent, PortailPublic, RechercheGlobale,
} from "./components/app/lazy-pages";
import { FullScreenFallback, OverlayFallback, PageFallback } from "./components/app/fallbacks";
import { PageErrorBoundary } from "./components/app/PageErrorBoundary";
import { InstallBanner } from "./components/app/InstallBanner";
import { Sidebar } from "./components/app/Sidebar";
import { AppHeader } from "./components/app/AppHeader";
import { OnboardingModal } from "./components/app/OnboardingModal";
import { RaccourcisModal } from "./components/app/RaccourcisModal";
import { PageRouter } from "./components/app/PageRouter";

export default function App() {
  const { t } = useTranslation();
  const [page,setPage]=useState(null);
  // Onglet initial à afficher quand on entre dans ParametresEcole — permet
  // au TableauDeBord (alerte conformité) de pointer directement sur "officiel".
  const [paramInitialTab, setParamInitialTab] = useState(null);
  const [rechercheOuverte,setRechercheOuverte]=useState(false);
  const [notifOuvert,setNotifOuvert]=useState(false);
  // notifListe + notifNonLues : fournis par useSchoolData (cf. plus bas).
  const [profilOuvert,setProfilOuvert]=useState(false);
  const [aideOuverte,setAideOuverte]=useState(false);
  const [schoolId,setSchoolId]=useState(()=>{
    const params=new URLSearchParams(window.location.search);
    const fromUrl=params.get("school");
    if(fromUrl){localStorage.setItem("LC_schoolId",fromUrl);}
    return fromUrl||localStorage.getItem("LC_schoolId")||"citadelle";
  });
  const [annee,setAnneeState]=useState(()=>localStorage.getItem("LC_annee")||"2025-2026");
  const [toasts,setToasts]=useState([]);
  const toast=(msg,type="success")=>{
    const id=Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  };
  const logAction=(action,details="",auteur="")=>{
    try{
      const sid=localStorage.getItem("LC_schoolId")||"citadelle";
      // eslint-disable-next-line react-hooks/purity
      addDoc(collection(db,"ecoles",sid,"historique"),{action,details,auteur,date:Date.now()}).catch(()=>{});
    }catch{
      // Logging is best-effort only.
    }
  };
  const [onboardingOuvert,setOnboardingOuvert]=useState(false);
  const [sidebarOuvert,setSidebarOuvert]=useState(false);

  // Shell PWA : nowTs, online/offline, install prompt, isMobile, mode sombre.
  const {
    nowTs, estHorsLigne, installVisible, setInstallVisible, installerApp,
    isMobile, modeSombre, setModeSombre,
  } = usePwaState();

  // Auth Firebase + profil /users/{uid} → utilisateur courant.
  // Appelé avant useSchoolData qui dépend d'utilisateur (visibilité des
  // listeners back-office vs portails enseignant/parent).
  const { utilisateur, setUtilisateur } = useAuthSession({ setSchoolId, setPage });

  // Listeners Firestore liés à l'école courante (schoolInfo, verrous,
  // legal profile, badges messages/élèves/notifs).
  const {
    schoolInfoState, setSchoolInfo, verrous,
    msgsNonLus, totalElevesActifs, notifListe, notifNonLues, setNotifNonLues,
  } = useSchoolData({ schoolId, utilisateur });

  // Ctrl+K / ? / Escape — voir use-keyboard-shortcuts pour le détail.
  useKeyboardShortcuts({
    utilisateur, setRechercheOuverte, setAideOuverte, setNotifOuvert, setProfilOuvert,
  });

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

  // ── Calcul planInfo (freemium + periode de grâce 7 jours) ──
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
    planLabel: t(`plans.${planCourant}`, PLANS[planCourant]?.label ?? "Gratuit"),
  };

  // ── Push notifications helper ──
  useEffect(()=>{
    if(!utilisateur || !schoolId || schoolId==="superadmin") return;
    if(!["direction","admin"].includes(utilisateur.role)) return;
    let annule = false;
    (async()=>{
      try{
        const headers = await getAuthHeaders({"Content-Type":"application/json"});
        if(annule) return;
      await apiFetch("/ecole-public-sync",{
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
      apiFetch("/push",{
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
      const currentUser = await getCurrentUser();
      if(!currentUser?.uid) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      });
      // Sauvegarde la souscription dans Firestore
      await setDoc(doc(db,"ecoles",sid,"pushSubs",currentUser.uid),{
        subscription: sub.toJSON(),
        role: utilisateurCo.role,
        nom: utilisateurCo.nom,
        uid: currentUser.uid,
        // eslint-disable-next-line react-hooks/purity
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
        onDemo={()=>setPage("demo")}
        onConnexion={()=>setPage("login")}
        onInscription={()=>setPage("inscription")}
      />
    </Suspense>
  );

  if(!utilisateur && page==="demo") return (
    <Suspense fallback={<FullScreenFallback/>}>
      <DemoEduGest
        onRetour={()=>setPage(null)}
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
      <Suspense fallback={null}>
        <MessagesEcole utilisateur={utilisateur} schoolId={schoolId}/>
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
  const isAdmin = role === "admin";
  const isDirection = role === "direction";
  // estAdmin garde son sens initial pour l'onboarding (admin + direction voient le guide)
  const estAdmin = isAdmin || isDirection;
  // readOnly :
  //  - direction (DG) → false partout SAUF compta (le DG supervise, ne saisit
  //                     pas la trésorerie ; il contrôle l'ouverture du verrou
  //                     via AdminPanel pour autoriser les modifications)
  //  - admin          → true SAUF si le DG a coché ce module dans
  //                     roleSettings.admin.writeModules (cf. AdminPanel
  //                     "Modules visibles" + case ✏️). Aligné sur le
  //                     modèle granulaire firestore.rules + JWT claims.
  //  - autres rôles   → false (les rules Firestore restreignent leur périmètre métier)
  const adminCanWriteCurrentPage = isAdmin
    && (schoolInfo?.roleSettings?.admin?.writeModules || []).includes(page);
  const directionReadOnlyCurrentPage = isDirection && page === "compta";
  const readOnly = (isAdmin && !adminCanWriteCurrentPage) || directionReadOnlyCurrentPage;
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

    {installVisible&&<InstallBanner onInstall={installerApp} onDismiss={()=>setInstallVisible(false)}/>}

    <div className="lc-app-root" style={{overflow:"hidden",display:"flex",background:"var(--lc-bg)"}}>
      {/* Overlay mobile */}
      {sidebarOuvert&&<div onClick={()=>setSidebarOuvert(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:40}}/>}

      <Sidebar
        schoolInfo={schoolInfo} couleur2={couleur2} annee={annee}
        modulesVisibles={modulesVisibles} page={page} setPage={setPage}
        isMobile={isMobile} sidebarOuvert={sidebarOuvert} setSidebarOuvert={setSidebarOuvert}
        msgsNonLus={msgsNonLus} utilisateur={utilisateur} utilisateurLabel={utilisateurLabel}
        deconnecter={deconnecter} estHorsLigne={estHorsLigne} t={t}
      />

      <main style={{flex:1,marginInlineStart:isMobile?0:228,minWidth:0,display:"flex",flexDirection:"column",height:"100dvh",overflow:"hidden"}}>
        <AppHeader
          isMobile={isMobile} setSidebarOuvert={setSidebarOuvert}
          modulesVisibles={modulesVisibles} page={page} readOnly={readOnly} t={t}
          estHorsLigne={estHorsLigne} planInfo={planInfo}
          utilisateur={utilisateur} utilisateurLabel={utilisateurLabel} schoolInfo={schoolInfo}
          setRechercheOuverte={setRechercheOuverte} modeSombre={modeSombre} setModeSombre={setModeSombre}
          notifOuvert={notifOuvert} setNotifOuvert={setNotifOuvert}
          notifNonLues={notifNonLues} setNotifNonLues={setNotifNonLues} notifListe={notifListe} nowTs={nowTs}
          profilOuvert={profilOuvert} setProfilOuvert={setProfilOuvert}
          setPage={setPage} setAideOuverte={setAideOuverte} deconnecter={deconnecter}
        />
        <div style={{flex:1,overflowY:"auto"}}>
          <PageErrorBoundary key={page}>
            <Suspense fallback={<PageFallback/>}>
              <PageRouter
                page={page} annee={annee} setAnnee={setAnnee} verrous={verrous}
                schoolId={schoolId} utilisateur={utilisateur} readOnly={readOnly}
                schoolInfo={schoolInfo} paramInitialTab={paramInitialTab}
                setParamInitialTab={setParamInitialTab} setPage={setPage} deconnecter={deconnecter}
              />
            </Suspense>
          </PageErrorBoundary>
        </div>
      </main>
    </div>

    {/* ── Bouton flottant guide de demarrage ── */}
    {estAdmin && (
      <button onClick={()=>setOnboardingOuvert(true)}
        title="Guide de démarrage"
        style={{position:"fixed",bottom:24,insetInlineStart:isMobile?16:244,zIndex:200,width:44,height:44,borderRadius:"50%",background:couleur2,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.2)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
        🚀
      </button>
    )}

    {onboardingOuvert && (
      <OnboardingModal schoolInfo={schoolInfo} setPage={setPage} onClose={()=>setOnboardingOuvert(false)}/>
    )}

    {/* ── Fermer dropdowns au clic exterieur ── */}
    {(notifOuvert||profilOuvert)&&(
      <div style={{position:"fixed",inset:0,zIndex:150}} onClick={()=>{setNotifOuvert(false);setProfilOuvert(false);}}/>
    )}

    {aideOuverte&&<RaccourcisModal onClose={()=>setAideOuverte(false)}/>}

    {schoolId && schoolId !== "superadmin" && (
      <Suspense fallback={null}>
        <MessagesEcole utilisateur={utilisateur} schoolId={schoolId}/>
      </Suspense>
    )}

    </SchoolContext.Provider>
  );
}
