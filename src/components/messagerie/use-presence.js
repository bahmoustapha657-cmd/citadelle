import { useEffect, useState } from "react";
import { chargerPresences, signalerPresence } from "../../backend/messagerie-supabase";

const BATTEMENT_MS = 60000;
const DELAI_DEMARRAGE_MS = 2500;

const etatCourant = () => (document.visibilityState === "visible" ? "actif" : "absent");

// Présence des comptes de l'école (supabase/historique/presence.sql) : l'application
// signale la sienne chaque minute — « actif » à l'écran, « absent » en
// arrière-plan, « hors_ligne » à la fermeture — et relit celle des autres.
// Renvoie Map compteId → { etat, depuis } (depuis : secondes, heure serveur).
export function usePresence({ actif }) {
  const [presences, setPresences] = useState(() => new Map());

  useEffect(() => {
    if (!actif) return undefined;
    let arrete = false;
    const signaler = (etat) => signalerPresence(etat).catch(() => { /* hors réseau : prochain battement */ });
    const charger = async () => {
      try {
        const liste = await chargerPresences();
        if (!arrete) setPresences(new Map(liste.map((p) => [p.compte_id, { etat: p.etat, depuis: p.depuis }])));
      } catch { /* presence.sql absent ou hors réseau : pas d'indicateur */ }
    };
    const battement = async () => {
      if (navigator.onLine === false) return;
      await signaler(etatCourant());
      charger();
    };
    const demarrage = setTimeout(battement, DELAI_DEMARRAGE_MS);
    const minuteur = setInterval(battement, BATTEMENT_MS);
    // Retour à l'écran / passage en arrière-plan : signalé tout de suite.
    const surVisibilite = () => battement();
    const surFermeture = () => { signaler("hors_ligne"); };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pagehide", surFermeture);
    window.addEventListener("online", battement);
    return () => {
      arrete = true;
      clearTimeout(demarrage);
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pagehide", surFermeture);
      window.removeEventListener("online", battement);
      signaler("hors_ligne");
    };
  }, [actif]);

  return presences;
}
