import { useEffect, useState } from "react";
import { isSupabase } from "../backend";
import { lireJetonRecovery, ouvrirSessionRecovery } from "../backend/password-reset-supabase";

// Détecte un retour de lien « mot de passe oublié » (jeton dans l'URL), ouvre
// la session de récupération et signale à App d'afficher l'écran de nouveau
// mot de passe — avant tout le reste de l'application.
export function useRecovery() {
  // Lu synchroniquement au 1er rendu : le hash est présent dès le chargement.
  const [jeton] = useState(() => (isSupabase ? lireJetonRecovery() : null));
  const [actif, setActif] = useState(!!jeton);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!jeton) return;
    ouvrirSessionRecovery(jeton).then(() => setPret(true)).catch(() => setActif(false));
  }, [jeton]);

  const terminerRecovery = () => {
    setActif(false);
    if (typeof window !== "undefined") window.location.replace(window.location.pathname);
  };

  return { recoveryActif: actif, recoveryPret: pret, terminerRecovery };
}
