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
  const [schoolId, setSchoolId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("school");
    if (fromUrl) { localStorage.setItem("LC_schoolId", fromUrl); }
    return fromUrl || localStorage.getItem("LC_schoolId") || "citadelle";
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
    schoolId, setSchoolId,
    onboardingOuvert, setOnboardingOuvert,
    sidebarOuvert, setSidebarOuvert,
  };
}
