import { Suspense } from "react";
import ToastContainerView from "../ToastContainer";
import { GlobalStyles } from "../../styles";
import { RechercheGlobale } from "./lazy-pages";
import { OverlayFallback, PageFallback } from "./fallbacks";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { InstallBanner } from "./InstallBanner";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { PageRouter } from "./PageRouter";
import { AppShellOverlays } from "./app-shell/AppShellOverlays";

// Coquille de l'application après authentification : toasts, recherche globale,
// bannière d'installation, sidebar, en-tête, routeur de pages et modales/dropdowns.
export function AppShell(p) {
  return (
    <>
      <GlobalStyles />

      <ToastContainerView toasts={p.toasts} />

      {p.rechercheOuverte && (
        <Suspense fallback={<OverlayFallback />}>
          <RechercheGlobale
            modules={p.modulesVisibles}
            onNaviguer={id => { p.setPage(id); p.setRechercheOuverte(false); }}
            onFermer={() => p.setRechercheOuverte(false)}
          />
        </Suspense>
      )}

      {p.installVisible && <InstallBanner onInstall={p.installerApp} onDismiss={() => p.setInstallVisible(false)} />}

      <div className="lc-app-root" style={{ overflow: "hidden", display: "flex", background: "var(--lc-bg)" }}>
        {/* Overlay mobile */}
        {p.sidebarOuvert && <div onClick={() => p.setSidebarOuvert(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />}

        <Sidebar
          schoolInfo={p.schoolInfo} couleur2={p.couleur2} annee={p.annee}
          modulesVisibles={p.modulesVisibles} page={p.page} setPage={p.setPage}
          isMobile={p.isMobile} sidebarOuvert={p.sidebarOuvert} setSidebarOuvert={p.setSidebarOuvert}
          msgsNonLus={p.msgsNonLus} utilisateur={p.utilisateur} utilisateurLabel={p.utilisateurLabel}
          deconnecter={p.deconnecter} estHorsLigne={p.estHorsLigne} t={p.t}
        />

        <main style={{ flex: 1, marginInlineStart: p.isMobile ? 0 : 228, minWidth: 0, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
          <AppHeader
            isMobile={p.isMobile} setSidebarOuvert={p.setSidebarOuvert}
            modulesVisibles={p.modulesVisibles} page={p.page} readOnly={p.readOnly} t={p.t}
            estHorsLigne={p.estHorsLigne} planInfo={p.planInfo}
            utilisateur={p.utilisateur} utilisateurLabel={p.utilisateurLabel} schoolInfo={p.schoolInfo}
            setRechercheOuverte={p.setRechercheOuverte} modeSombre={p.modeSombre} setModeSombre={p.setModeSombre}
            notifOuvert={p.notifOuvert} setNotifOuvert={p.setNotifOuvert}
            notifNonLues={p.notifNonLues} setNotifNonLues={p.setNotifNonLues} notifListe={p.notifListe} nowTs={p.nowTs}
            profilOuvert={p.profilOuvert} setProfilOuvert={p.setProfilOuvert}
            setPage={p.setPage} setAideOuverte={p.setAideOuverte} deconnecter={p.deconnecter}
          />
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PageErrorBoundary key={p.page}>
              <Suspense fallback={<PageFallback />}>
                <PageRouter
                  page={p.page} annee={p.annee} setAnnee={p.setAnnee} verrous={p.verrous}
                  schoolId={p.schoolId} utilisateur={p.utilisateur} readOnly={p.readOnly}
                  schoolInfo={p.schoolInfo} paramInitialTab={p.paramInitialTab}
                  setParamInitialTab={p.setParamInitialTab} setPage={p.setPage} deconnecter={p.deconnecter}
                />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>

      <AppShellOverlays p={p} />
    </>
  );
}
