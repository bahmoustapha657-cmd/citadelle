import { Suspense } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { GlobalStyles } from "../../styles";
import {
  ChangerMotDePasseModal, MessagesEcole, PortailEnseignant, PortailParent,
} from "./lazy-pages";
import { FullScreenFallback } from "./fallbacks";
import { PreAuthScreens } from "./auth-gate/PreAuthScreens";

// Écrans affichés avant le shell principal : pages produit (landing/démo),
// portail public, connexion (dans PreAuthScreens), changement de mot de passe
// à la première connexion, et portails dédiés enseignant/parent.
// Renvoie l'écran à afficher, ou null si le shell principal doit prendre le relais.
export function AuthGate({
  utilisateur, page, schoolInfo, schoolId, schoolContextValue,
  annee, connecter, deconnecter, setPage, setUtilisateur,
}) {
  const preAuth = PreAuthScreens({ utilisateur, page, schoolInfo, schoolContextValue, connecter, setPage, setUtilisateur });
  if (preAuth) return preAuth;

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
