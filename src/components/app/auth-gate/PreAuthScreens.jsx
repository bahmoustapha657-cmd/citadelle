import { Suspense } from "react";
import { signOutSession } from "../../../backend/session";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { GlobalStyles } from "../../../styles";
import {
  Connexion, DemoEduGest, Inscription, LandingEduGest, PortailPublic,
} from "../lazy-pages";
import { FullScreenFallback } from "../fallbacks";

// Écrans affichés tant qu'aucun utilisateur n'est connecté. Par défaut
// (aucune page sélectionnée) : portail public de l'école s'il est actif,
// sinon formulaire de connexion. La landing produit n'est ouverte que par
// le bouton « En savoir plus sur EduGest » de l'écran de connexion.
// Renvoie l'écran à afficher, ou null si un utilisateur est connecté.
export function PreAuthScreens({ utilisateur, page, schoolInfo, schoolContextValue, connecter, setPage, setUtilisateur }) {
  if (utilisateur) return null;

  if (page === "inscription") return (
    <Suspense fallback={<FullScreenFallback />}>
      <Inscription />
    </Suspense>
  );

  // Landing EduGest (page produit, sur demande depuis la connexion)
  if (page === "decouvrir") return (
    <Suspense fallback={<FullScreenFallback />}>
      <LandingEduGest
        onDemo={() => setPage("demo")}
        onConnexion={() => setPage("connexion")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  if (page === "demo") return (
    <Suspense fallback={<FullScreenFallback />}>
      <DemoEduGest
        onRetour={() => setPage("decouvrir")}
        onConnexion={() => setPage("connexion")}
        onInscription={() => setPage("inscription")}
      />
    </Suspense>
  );

  // Portail public de l'école (si actif, avant le formulaire de connexion)
  if (!page && schoolInfo.accueil?.active) return (
    <SchoolContext.Provider value={schoolContextValue}>
      <Suspense fallback={<FullScreenFallback />}>
        <PortailPublic onConnexion={() => setPage("connexion")} />
      </Suspense>
    </SchoolContext.Provider>
  );

  // Formulaire de connexion (écran par défaut)
  return (
    <SchoolContext.Provider value={schoolContextValue}>
      <GlobalStyles />
      <Suspense fallback={<FullScreenFallback />}>
        <Connexion
          onLogin={connecter}
          onInscription={() => { signOutSession().catch(() => {}); setUtilisateur(null); setPage("inscription"); }}
          onDecouvrir={() => { window.scrollTo(0, 0); setPage("decouvrir"); }}
        />
      </Suspense>
    </SchoolContext.Provider>
  );
}
