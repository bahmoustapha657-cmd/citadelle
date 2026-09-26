import { useState } from "react";
import { isSupabase } from "../backend";
import { lireRetourRecovery, nettoyerUrlRecovery } from "../backend/password-reset-supabase";

// Détecte un retour de lien « mot de passe oublié » et signale à App
// d'afficher l'écran de nouveau mot de passe — avant tout le reste. Le jeton
// n'est PAS consommé ici, seulement au clic « Enregistrer »
// (ResetPasswordScreen) : un simple chargement de la page — analyseur de
// liens d'une messagerie compris — ne l'invalide donc pas.
//
// Le jeton reste dans l'URL tant que l'écran est ouvert : à la première
// visite sur un appareil, le service worker recharge la page en prenant la
// main (sw-register.js), et l'écran disparaissait avec un jeton déjà retiré.
// Il ne quitte la barre d'adresse qu'une fois inutile : mot de passe
// enregistré, lien refusé (password-reset-supabase.js) ou sortie de l'écran.
export function useRecovery() {
  // Lu synchroniquement au 1er rendu : le fragment est présent dès le chargement.
  const [retour, setRetour] = useState(() => (isSupabase ? lireRetourRecovery() : null));

  const terminerRecovery = () => {
    nettoyerUrlRecovery();
    setRetour(null);
  };

  return { recovery: retour, terminerRecovery };
}
