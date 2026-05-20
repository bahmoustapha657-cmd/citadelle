import { useEffect } from "react";

// Raccourcis clavier globaux de l'app :
// - Ctrl/Cmd+K : toggle recherche globale (back-office uniquement)
// - ? : toggle panneau d'aide (si user loggé, hors champ texte)
// - Escape : ferme tous les dropdowns/panneaux
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useKeyboardShortcuts({
  utilisateur,
  setRechercheOuverte,
  setAideOuverte,
  setNotifOuvert,
  setProfilOuvert,
}) {
  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (utilisateur && !["enseignant", "parent"].includes(utilisateur.role)) {
          setRechercheOuverte((o) => !o);
        }
      }
      // ? — aide clavier (seulement si pas de champ texte actif)
      if (e.key === "?" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        if (utilisateur) setAideOuverte((o) => !o);
      }
      if (e.key === "Escape") {
        setNotifOuvert(false);
        setProfilOuvert(false);
        setAideOuverte(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [utilisateur, setRechercheOuverte, setAideOuverte, setNotifOuvert, setProfilOuvert]);
}
