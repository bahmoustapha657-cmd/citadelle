import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { messagerieOuverteA, titreConversation } from "./messagerie-logic";
import { useReunion } from "./audio/use-reunion";
import { usePresence } from "./use-presence";
import { ReunionOverlay } from "./ReunionOverlay";
import { notifier } from "../../backend/messagerie-supabase";
import { etatNotifications } from "../../backend/push-navigateur";
import { rafraichirAbonnementPush, sAbonnerAuxPush } from "../../backend/push-supabase";
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
  const actif = messagerieOuverteA(utilisateur) && !!schoolCode;
  const etat = useMessagerieEtat({ utilisateur, schoolCode, actif });
  // Un seul appel à la fois par appareil : direct OU de groupe.
  const occupation = useRef({ appel: false, reunion: false });
  const appels = useAppels({
    actif, moi: etat.moi, schoolCode, annuaire: etat.annuaire, nomMoi: etat.nomMoi,
    occupe: () => occupation.current.reunion,
  });
  // Appel de groupe lancé : les membres (hors sourdine) sont prévenus.
  const prevenirMembres = (conversationId) => {
    const conv = etat.boiteParId.get(conversationId);
    if (!conv) return;
    notifier((conv.membres || []).filter((x) => x.id !== etat.moi && !x.sourdine).map((x) => etat.annuaire.get(x.id)?.user_id),
      `📞 Appel de groupe — ${titreConversation(conv, etat.annuaire, etat.moi)}`,
      `${etat.nomMoi} vous invite à rejoindre l'appel.`,
      `/?messagerie=${conversationId}`);
  };
  const reunions = useReunion({
    actif, moi: etat.moi, schoolCode,
    occupe: () => occupation.current.appel,
    surNouvelleReunion: prevenirMembres,
  });
  useLayoutEffect(() => {
    occupation.current = { appel: !!appels.appel && appels.appel.phase !== "fin", reunion: reunions.enCours };
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

  // Notifications de cet appareil : elles seules préviennent d'un appel quand
  // l'application est fermée.
  const [etatPush, setEtatPush] = useState(() => etatNotifications());
  const compte = utilisateur?.compteDocId;
  useEffect(() => {
    if (actif) rafraichirAbonnementPush(utilisateur, schoolCode);
  }, [actif, compte, schoolCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const notifications = {
    etat: etatPush,
    activer: async () => setEtatPush(await sAbonnerAuxPush(utilisateur, schoolCode)),
  };

  const presences = usePresence({ actif });
  const valeur = actif ? { ...etat, appels, reunions, presences, notifications, ouvrirMessagerie } : null;
  const convReunion = reunions.reunion ? etat.boiteParId.get(reunions.reunion.conversationId) : null;

  return (
    <MessagerieContext.Provider value={valeur}>
      {children}
      {actif && appels.appel && (
        <AppelOverlay appels={appels} annuaire={etat.annuaire} />
      )}
      {actif && reunions.reunion && (
        <ReunionOverlay r={reunions} annuaire={etat.annuaire} moi={etat.moi}
          titre={convReunion ? titreConversation(convReunion, etat.annuaire, etat.moi) : "Appel de groupe"} />
      )}
    </MessagerieContext.Provider>
  );
}
