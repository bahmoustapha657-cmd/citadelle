import { useEffect, useState } from "react";

// Hook regroupant les état/effets liés au shell PWA :
// - tick "now" toutes les minutes (utile pour les checks d'expiration plan)
// - online/offline
// - prompt d'installation Android Chrome/Edge (beforeinstallprompt)
// - isMobile (resize listener < 768px)
// - mode sombre (toggle body class + persist localStorage)
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function usePwaState() {
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [estHorsLigne, setEstHorsLigne] = useState(!navigator.onLine);
  const [promptInstall, setPromptInstall] = useState(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [modeSombre, setModeSombre] = useState(() => localStorage.getItem("LC_theme") === "dark");

  // Tick chaque minute (recalcul des "X jours restants" sur le plan etc.)
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Online / offline
  useEffect(() => {
    const goOn = () => setEstHorsLigne(false);
    const goOff = () => setEstHorsLigne(true);
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => {
      window.removeEventListener("online", goOn);
      window.removeEventListener("offline", goOff);
    };
  }, []);

  // Prompt d'installation PWA (Android Chrome / Edge)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPromptInstall(e);
      setInstallVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Resize mobile
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Mode sombre
  useEffect(() => {
    document.body.classList.toggle("mode-sombre", modeSombre);
    localStorage.setItem("LC_theme", modeSombre ? "dark" : "light");
  }, [modeSombre]);

  const installerApp = async () => {
    if (!promptInstall) return;
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === "accepted") setInstallVisible(false);
    setPromptInstall(null);
  };

  return {
    nowTs,
    estHorsLigne,
    installVisible, setInstallVisible,
    installerApp,
    isMobile,
    modeSombre, setModeSombre,
  };
}
