import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext, SCHOOL_INFO_DEFAUT } from "./contexts/SchoolContext";
import { calcMoisAnnee, calcMoisSalaire, getModulesForRole } from "./constants";
import { isSupabase } from "./backend";
import { ROLES_HORS_POSTES, getSessionPermissions, readableModules } from "../shared/postes-config.js";
import { usePwaState } from "./hooks/use-pwa-state";
import { usePowerSyncStatus } from "./hooks/use-powersync-status";
import { useSchoolData } from "./hooks/use-school-data";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useAuthSession } from "./hooks/use-auth-session";
import { useRecovery } from "./hooks/use-recovery";
import { useAppUiState } from "./components/app/use-app-ui-state";
import { useAppShell } from "./components/app/use-app-shell";
import { computeAppPermissions } from "./components/app/compute-permissions";
import { AuthGate } from "./components/app/AuthGate";
import { AppShell } from "./components/app/AppShell";
import { ResetPasswordScreen } from "./components/connexion/ResetPasswordScreen";

export default function App() {
  const { t } = useTranslation();

  // Retour d'un lien « mot de passe oublié » : prime sur tout le reste.
  const { recoveryActif, recoveryPret, terminerRecovery } = useRecovery();
  const {
    page, setPage, paramInitialTab, setParamInitialTab,
    rechercheOuverte, setRechercheOuverte, notifOuvert, setNotifOuvert,
    profilOuvert, setProfilOuvert, aideOuverte, setAideOuverte,
    centreAideOuvert, setCentreAideOuvert,
    schoolId, setSchoolId, onboardingOuvert, setOnboardingOuvert,
    sidebarOuvert, setSidebarOuvert,
  } = useAppUiState();

  // Shell PWA : nowTs, online/offline, install prompt, isMobile, mode sombre.
  const {
    nowTs, estHorsLigne, installVisible, setInstallVisible, installerApp,
    isMobile, modeSombre, setModeSombre,
  } = usePwaState();

  // Nb de changements locaux (notes/absences saisies hors ligne) en attente
  // de synchronisation — no-op hors mode Supabase/PowerSync.
  const { syncPendantes } = usePowerSyncStatus();

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

  // Garde-fou : si la page courante n'est pas un module du compte, on rabat
  // sur son premier module. En mode Supabase (postes flexibles), la référence
  // est la carte de permissions du poste — MÊME source que la sidebar
  // (compute-permissions). getModulesForRole (rôle enum) sous-évaluait les
  // modules des comptes à poste (role_settings vide ⇒ seuls les modules
  // requis) et éjectait la direction des pages académiques.
  useEffect(() => {
    if (!utilisateur) return;
    const modulesCourants = isSupabase && !ROLES_HORS_POSTES.includes(utilisateur.role)
      ? readableModules(getSessionPermissions(utilisateur, schoolInfo))
      : getModulesForRole(utilisateur.role, schoolInfo);
    const fallbackPage = modulesCourants[0] || null;
    if (fallbackPage && !modulesCourants.includes(page)) {
      setPage(fallbackPage);
    }
  }, [page, schoolInfo, utilisateur, setPage]);

  // Récupération de mot de passe : écran dédié avant tout le reste.
  if (recoveryActif) {
    return recoveryPret
      ? <ResetPasswordScreen onTermine={terminerRecovery} />
      : <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontFamily: "sans-serif" }}>Ouverture du lien de réinitialisation…</div>;
  }

  // Écrans avant le shell : landing/démo, portail public, connexion,
  // changement de mot de passe, portails enseignant/parent.
  const ecranAuth = AuthGate({
    utilisateur, page, schoolInfo, schoolId, schoolContextValue,
    annee, connecter, deconnecter, setPage, setUtilisateur,
  });
  if (ecranAuth) return ecranAuth;

  const { modulesVisibles, permissions, roleEffectif, estAdmin, readOnly, abonnementExpire, basculeSupabase, couleur2, utilisateurLabel } =
    computeAppPermissions({ utilisateur, schoolInfo, page, planInfo });

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
        deconnecter={deconnecter} estHorsLigne={estHorsLigne} syncPendantes={syncPendantes} t={t}
        readOnly={readOnly} permissions={permissions} roleEffectif={roleEffectif} abonnementExpire={abonnementExpire} basculeSupabase={basculeSupabase} planInfo={planInfo} modeSombre={modeSombre} setModeSombre={setModeSombre}
        notifOuvert={notifOuvert} setNotifOuvert={setNotifOuvert}
        notifNonLues={notifNonLues} setNotifNonLues={setNotifNonLues} notifListe={notifListe} nowTs={nowTs}
        profilOuvert={profilOuvert} setProfilOuvert={setProfilOuvert}
        setAideOuverte={setAideOuverte} aideOuverte={aideOuverte}
        centreAideOuvert={centreAideOuvert} setCentreAideOuvert={setCentreAideOuvert}
        verrous={verrous} schoolId={schoolId}
        paramInitialTab={paramInitialTab} setParamInitialTab={setParamInitialTab}
        estAdmin={estAdmin} onboardingOuvert={onboardingOuvert} setOnboardingOuvert={setOnboardingOuvert}
      />
    </SchoolContext.Provider>
  );
}
