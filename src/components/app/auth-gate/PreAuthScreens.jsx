import { Suspense } from "react";
import { signOutSession } from "../../../backend/session";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { GlobalStyles } from "../../../styles";
import {
  Connexion, DemoEduGest, Inscription, LandingEduGest, PortailPublic,
} from "../lazy-pages";
import { FullScreenFallback } from "../fallbacks";

// Écrans affichés tant qu'aucun utilisateur n'est connecté : inscription,
// landing produit, démo, portail public puis formulaire de connexion.
// Renvoie l'écran à afficher, ou null si un utilisateur est connecté.
export function PreAuthScreens({ utilisateur, page, schoolInfo, schoolContextValue, connecter, setPage, setUtilisateur }) {
  if (utilisateur) return null;

  if (page === "inscription") return (
    <Suspense fallback={<FullScreenFallback />}>
      <Inscription />
    </Suspense>
  );

  // 1. Landing EduGest (page produit, visible si aucune page sélectionnée)
  if (!page) return (
    <Suspense fallback={<FullScreenFallback />}>
      <LandingEduGest
        onDemo={() => setPage("demo")}
        onConnexion={() => setPage("login")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  if (page === "demo") return (
    <Suspense fallback={<FullScreenFallback />}>
      <DemoEduGest
        onRetour={() => setPage(null)}
        onConnexion={() => setPage("login")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  // 2. Portail public de l'école (si actif, avant le formulaire de connexion)
  if (page === "login" && schoolInfo.accueil?.active) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback />}>
        <PortailPublic onConnexion={() => setPage("connexion")} />
      </Suspense>
    </SchoolContext.Provider>
  );

  // 3. Formulaire de connexion
  return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles />
      <Suspense fallback={<FullScreenFallback />}>
        <Connexion onLogin={connecter} onInscription={() => { signOutSession().catch(() => {}); setUtilisateur(null); setPage("inscription"); }} />
      </Suspense>
    </SchoolContext.Provider>
  );
}
