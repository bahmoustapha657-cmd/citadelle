import { useCallback, useEffect } from "react";
import { isSupabase } from "../../backend";
import { messagerieOuverteA } from "./messagerie-logic";
import { useMessagerieEtat } from "./use-messagerie-etat";
import { useAppels } from "./audio/use-appels";
import { AppelOverlay } from "./AppelOverlay";
import { MessagerieContext } from "./messagerie-contexte";

// Lien d'une notification push : /?messagerie=<discussion> ou /?annonce=<id>.
function demandeDepuisUrl(url) {
  try {
    const params = new URL(url, window.location.origin).searchParams;
    if (params.get("messagerie")) return { onglet: "discussions", id: params.get("messagerie") };
    if (params.get("annonce")) return { onglet: "annonces", id: params.get("annonce") };
  } catch { /* URL invalide */ }
  return null;
}

// ══════════════════════════════════════════════════════════════
//  Fournisseur de la messagerie interne (personnel + enseignants)
// ══════════════════════════════════════════════════════════════
// Monté autour du shell (personnel) et du portail enseignant. Porte l'état
// partagé (badge, boîte, annonces), les appels, et affiche l'écran d'appel
// par-dessus n'importe quelle page. `onOuvrir` : navigation vers la page
// Messagerie (module du shell ou onglet du portail).
export function MessagerieProvider({ utilisateur, schoolCode, onOuvrir, children }) {
  const actif = isSupabase && messagerieOuverteA(utilisateur) && !!schoolCode;
  const etat = useMessagerieEtat({ utilisateur, schoolCode, actif });
  const appels = useAppels({
    actif, moi: etat.moi, schoolCode, annuaire: etat.annuaire, nomMoi: etat.nomMoi,
  });
  const { appliquerDemande } = etat;

  const ouvrirMessagerie = useCallback((demande = null) => {
    if (demande) appliquerDemande(demande);
    onOuvrir?.();
  }, [onOuvrir, appliquerDemande]);

  // Ouverture depuis une notification : au démarrage (lien de la
  // notification) ou app déjà ouverte (message du service worker).
  useEffect(() => {
    if (!actif) return undefined;
    const initiale = demandeDepuisUrl(window.location.href);
    if (initiale) {
      ouvrirMessagerie(initiale);
      const propre = new URL(window.location.href);
      propre.searchParams.delete("messagerie");
      propre.searchParams.delete("annonce");
      window.history.replaceState(null, "", propre.pathname + propre.search + propre.hash);
    }
    const surMessageSw = (e) => {
      if (e.data?.type !== "notification-click") return;
      const demande = demandeDepuisUrl(e.data.url || "");
      if (demande) ouvrirMessagerie(demande);
    };
    navigator.serviceWorker?.addEventListener("message", surMessageSw);
    return () => navigator.serviceWorker?.removeEventListener("message", surMessageSw);
  }, [actif]); // eslint-disable-line react-hooks/exhaustive-deps

  const valeur = actif ? { ...etat, appels, ouvrirMessagerie } : null;

  return (
    <MessagerieContext.Provider value={valeur}>
      {children}
      {actif && appels.appel && (
        <AppelOverlay appels={appels} annuaire={etat.annuaire} />
      )}
    </MessagerieContext.Provider>
  );
}
