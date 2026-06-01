import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import { calcMoisAnnee, calcMoisSalaire, getModulesForRole } from "./constants";
import { usePwaState } from "./hooks/use-pwa-state";
import { useSchoolData } from "./hooks/use-school-data";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useAuthSession } from "./hooks/use-auth-session";
import { useAppShell } from "./components/app/use-app-shell";
import { computeAppPermissions } from "./components/app/compute-permissions";
import { AuthGate } from "./components/app/AuthGate";
import { AppShell } from "./components/app/AppShell";

export default function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState(null);
  // Onglet initial à afficher quand on entre dans ParametresEcole — permet
  // au TableauDeBord (alerte conformité) de pointer directement sur "officiel".
  const [paramInitialTab, setParamInitialTab] = useState(null);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [notifOuvert, setNotifOuvert] = useState(false);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  const [schoolId, setSchoolId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("school");
    if (fromUrl) { localStorage.setItem("LC_schoolId", fromUrl); }
    return fromUrl || localStorage.getItem("LC_schoolId") || "citadelle";
  });
  const [onboardingOuvert, setOnboardingOuvert] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(false);

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
  const moisAnnee = calcMoisAnnee(schoolInfo.moisDebut || "Octobre");
  const moisSalaire = calcMoisSalaire(schoolInfo.moisDebut || "Octobre");

  // Logique transverse : toasts, journal, push, plan, année, connexion.
  const {
    toasts, toast, logAction, annee, setAnnee, planInfo, envoyerPush, connecter, deconnecter,
  } = useAppShell({
    schoolId, setSchoolId, schoolInfo, schoolInfoState,
    utilisateur, setUtilisateur, setPage, nowTs, totalElevesActifs, t,
  });

  const schoolContextValue = { schoolId, setSchoolId, schoolInfo, setSchoolInfo, moisAnnee, moisSalaire, toast, logAction, envoyerPush, planInfo };

  // Ctrl+K / ? / Escape — voir use-keyboard-shortcuts pour le détail.
  useKeyboardShortcuts({
    utilisateur, setRechercheOuverte, setAideOuverte, setNotifOuvert, setProfilOuvert,
  });

  useEffect(() => {
    if (!utilisateur) return;
    const modulesCourants = getModulesForRole(utilisateur.role, schoolInfo);
    const fallbackPage = modulesCourants[0] || null;
    if (fallbackPage && !modulesCourants.includes(page)) {
      setPage(fallbackPage);
    }
  }, [page, schoolInfo, utilisateur]);

  // Écrans avant le shell : landing/démo, portail public, connexion,
  // changement de mot de passe, portails enseignant/parent.
  const ecranAuth = AuthGate({
    utilisateur, page, schoolInfo, schoolId, schoolContextValue,
    annee, connecter, deconnecter, setPage, setUtilisateur,
  });
  if (ecranAuth) return ecranAuth;

  const { modulesVisibles, estAdmin, readOnly, couleur2, utilisateurLabel } =
    computeAppPermissions({ utilisateur, schoolInfo, page });

  return (
    <SchoolContext.Provider value={schoolContextValue}>
      <AppShell
        toasts={toasts}
        rechercheOuverte={rechercheOuverte} setRechercheOuverte={setRechercheOuverte}
        modulesVisibles={modulesVisibles}
        installVisible={installVisible} setInstallVisible={setInstallVisible} installerApp={installerApp}
        sidebarOuvert={sidebarOuvert} setSidebarOuvert={setSidebarOuvert}
        schoolInfo={schoolInfo} couleur2={couleur2} annee={annee} setAnnee={setAnnee}
        page={page} setPage={setPage} isMobile={isMobile}
        msgsNonLus={msgsNonLus} utilisateur={utilisateur} utilisateurLabel={utilisateurLabel}
        deconnecter={deconnecter} estHorsLigne={estHorsLigne} t={t}
        readOnly={readOnly} planInfo={planInfo} modeSombre={modeSombre} setModeSombre={setModeSombre}
        notifOuvert={notifOuvert} setNotifOuvert={setNotifOuvert}
        notifNonLues={notifNonLues} setNotifNonLues={setNotifNonLues} notifListe={notifListe} nowTs={nowTs}
        profilOuvert={profilOuvert} setProfilOuvert={setProfilOuvert}
        setAideOuverte={setAideOuverte} aideOuverte={aideOuverte}
        verrous={verrous} schoolId={schoolId}
        paramInitialTab={paramInitialTab} setParamInitialTab={setParamInitialTab}
        estAdmin={estAdmin} onboardingOuvert={onboardingOuvert} setOnboardingOuvert={setOnboardingOuvert}
      />
    </SchoolContext.Provider>
  );
}
