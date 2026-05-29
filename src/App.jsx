import ToastContainerView from "./components/ToastContainer";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  C,
  calcMoisAnnee, calcMoisSalaire,
  MODULES,
  getModulesForRole, getRoleLabelForSchool,
} from "./constants";
import { GlobalStyles } from "./styles";
import { usePwaState } from "./hooks/use-pwa-state";
import { useSchoolData } from "./hooks/use-school-data";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useAuthSession } from "./hooks/use-auth-session";
import { useAppShell } from "./components/app/use-app-shell";
import { MessagesEcole, RechercheGlobale } from "./components/app/lazy-pages";
import { OverlayFallback, PageFallback } from "./components/app/fallbacks";
import { PageErrorBoundary } from "./components/app/PageErrorBoundary";
import { InstallBanner } from "./components/app/InstallBanner";
import { Sidebar } from "./components/app/Sidebar";
import { AppHeader } from "./components/app/AppHeader";
import { OnboardingModal } from "./components/app/OnboardingModal";
import { RaccourcisModal } from "./components/app/RaccourcisModal";
import { PageRouter } from "./components/app/PageRouter";
import { AuthGate } from "./components/app/AuthGate";

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

  const schoolInfo = (!schoolId || schoolId === "superadmin") ? SCHOOL_INFO_DEFAUT : schoolInfoState;
  const moisAnnee   = calcMoisAnnee(schoolInfo.moisDebut||"Octobre");
  const moisSalaire = calcMoisSalaire(schoolInfo.moisDebut||"Octobre");

  // Logique transverse : toasts, journal, push, plan, année, connexion.
  const {
    toasts, toast, logAction, annee, setAnnee, planInfo, envoyerPush, connecter, deconnecter,
  } = useAppShell({
    schoolId, setSchoolId, schoolInfo, schoolInfoState,
    utilisateur, setUtilisateur, setPage, nowTs, totalElevesActifs, t,
  });

  const schoolContextValue = {schoolId,setSchoolId,schoolInfo,setSchoolInfo,moisAnnee,moisSalaire,toast,logAction,envoyerPush,planInfo};

  // Ctrl+K / ? / Escape — voir use-keyboard-shortcuts pour le détail.
  useKeyboardShortcuts({
    utilisateur, setRechercheOuverte, setAideOuverte, setNotifOuvert, setProfilOuvert,
  });

  useEffect(()=>{
    if(!utilisateur) return;
    const modulesCourants = getModulesForRole(utilisateur.role, schoolInfo);
    const fallbackPage = modulesCourants[0] || null;
    if(fallbackPage && !modulesCourants.includes(page)){
      setPage(fallbackPage);
    }
  },[page, schoolInfo, utilisateur]);

  // Écrans avant le shell : landing/démo, portail public, connexion,
  // changement de mot de passe, portails enseignant/parent.
  const ecranAuth = AuthGate({
    utilisateur, page, schoolInfo, schoolId, schoolContextValue,
    annee, connecter, deconnecter, setPage, setUtilisateur,
  });
  if (ecranAuth) return ecranAuth;

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
