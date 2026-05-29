import { Suspense } from "react";
import { signOutCurrentUser } from "../../firebaseAuth";
import { SchoolContext } from "../../contexts/SchoolContext";
import { GlobalStyles } from "../../styles";
import {
  ChangerMotDePasseModal, Connexion, DemoEduGest, Inscription, LandingEduGest,
  MessagesEcole, PortailEnseignant, PortailParent, PortailPublic,
} from "./lazy-pages";
import { FullScreenFallback } from "./fallbacks";

// Écrans affichés avant le shell principal : pages produit (landing/démo),
// portail public, connexion, changement de mot de passe à la première
// connexion, et portails dédiés enseignant/parent.
// Renvoie l'écran à afficher, ou null si le shell principal doit prendre le relais.
export function AuthGate({
  utilisateur, page, schoolInfo, schoolId, schoolContextValue,
  annee, connecter, deconnecter, setPage, setUtilisateur,
}) {
  if (!utilisateur && page === "inscription") return (
    <Suspense fallback={<FullScreenFallback />}>
      <Inscription />
    </Suspense>
  );

  // 1. Landing EduGest (page produit, visible si aucune page sélectionnée)
  if (!utilisateur && !page) return (
    <Suspense fallback={<FullScreenFallback />}>
      <LandingEduGest
        onDemo={() => setPage("demo")}
        onConnexion={() => setPage("login")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  if (!utilisateur && page === "demo") return (
    <Suspense fallback={<FullScreenFallback />}>
      <DemoEduGest
        onRetour={() => setPage(null)}
        onConnexion={() => setPage("login")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  // 2. Portail public de l'école (si actif, avant le formulaire de connexion)
  if (!utilisateur && page === "login" && schoolInfo.accueil?.active) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback />}>
        <PortailPublic onConnexion={() => setPage("connexion")} />
      </Suspense>
    </SchoolContext.Provider>
  );

  // 3. Formulaire de connexion
  if (!utilisateur) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles />
      <Suspense fallback={<FullScreenFallback />}>
        <Connexion onLogin={connecter} onInscription={() => { signOutCurrentUser().catch(() => {}); setUtilisateur(null); setPage("inscription"); }} />
      </Suspense>
    </SchoolContext.Provider>
  );

  // Forcer le changement de mot de passe à la première connexion
  if (utilisateur.premiereCo) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback />}>
        <ChangerMotDePasseModal
          utilisateur={utilisateur}
          onDone={() => setUtilisateur((u) => ({ ...u, premiereCo: false }))}
        />
      </Suspense>
    </SchoolContext.Provider>
  );

  // Portail dédié aux enseignants — interface séparée du shell principal
  if (utilisateur.role === "enseignant") return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles />
      <Suspense fallback={<FullScreenFallback />}>
        <PortailEnseignant utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo} />
      </Suspense>
      <Suspense fallback={null}>
        <MessagesEcole utilisateur={utilisateur} schoolId={schoolId} />
      </Suspense>
    </SchoolContext.Provider>
  );

  // Portail dédié aux parents
  if (utilisateur.role === "parent") return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles />
      <Suspense fallback={<FullScreenFallback />}>
        <PortailParent utilisateur={utilisateur} deconnecter={deconnecter} annee={annee} schoolInfo={schoolInfo} />
      </Suspense>
    </SchoolContext.Provider>
  );

  return null;
}
