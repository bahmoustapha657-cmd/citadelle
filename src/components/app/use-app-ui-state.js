import { useState } from "react";

// Regroupe l'état d'interface transverse de App : page courante, panneaux
// ouverts (recherche/notifs/profil/aide/sidebar/onboarding), onglet initial
// des paramètres, et l'école courante (initialisée depuis l'URL/localStorage).
export function useAppUiState() {
  const [page, setPage] = useState(null);
  // Onglet initial à afficher quand on entre dans ParametresEcole — permet
  // au TableauDeBord (alerte conformité) de pointer directement sur "officiel".
  const [paramInitialTab, setParamInitialTab] = useState(null);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [notifOuvert, setNotifOuvert] = useState(false);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  const [centreAideOuvert, setCentreAideOuvert] = useState(false);
  // Pas d'école par défaut : un nouveau visiteur (ni ?school= dans l'URL,
  // ni école mémorisée) arrive sur l'écran de connexion neutre et saisit
  // son code école — il ne doit jamais tomber sur l'école d'un tiers.
  const [schoolId, setSchoolId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("school");
    if (fromUrl) { localStorage.setItem("LC_schoolId", fromUrl); }
    return fromUrl || localStorage.getItem("LC_schoolId") || "";
  });
  const [onboardingOuvert, setOnboardingOuvert] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(false);

  return {
    page, setPage,
    paramInitialTab, setParamInitialTab,
    rechercheOuverte, setRechercheOuverte,
    notifOuvert, setNotifOuvert,
    profilOuvert, setProfilOuvert,
    aideOuverte, setAideOuverte,
    centreAideOuvert, setCentreAideOuvert,
    schoolId, setSchoolId,
    onboardingOuvert, setOnboardingOuvert,
    sidebarOuvert, setSidebarOuvert,
  };
}
