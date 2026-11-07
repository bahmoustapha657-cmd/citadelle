// Écriture au journal de caisse avec reprise des lignes gardées sur
// l'appareil (cf. journal-en-attente.js). Renvoie la fonction d'écriture à
// passer aux actions de paiement à la place du simple `ajouter`.
import { useEffect, useEffectEvent } from "react";
import i18n from "../../i18n";
import { inscrireAuJournal, lireAttente, renvoyerAttente } from "./journal-en-attente";

export function useJournalEnAttente(schoolId, ajouter, toast) {
  // Renvoie les lignes gardées et annonce celles qui sont parties.
  // `annoncerRestantes` : à l'ouverture, dire aussi ce qui attend encore.
  const renvoyer = async ({ annoncerRestantes = false } = {}) => {
    if (!schoolId || !lireAttente(schoolId).length) return;
    const { envoyees, restantes } = await renvoyerAttente(schoolId, ajouter);
    if (envoyees) {
      toast?.(i18n.t("accounting.journalPendingSent", { n: envoyees }), "success");
    }
    if (restantes && annoncerRestantes) {
      toast?.(i18n.t("accounting.journalPendingRemaining", { n: restantes }), "warning");
    }
  };
  const renvoyerDepuisEffet = useEffectEvent(renvoyer);

  // À l'ouverture de la Comptabilité, puis à chaque retour du réseau.
  useEffect(() => {
    if (!schoolId) return undefined;
    renvoyerDepuisEffet({ annoncerRestantes: true });
    const auRetour = () => { renvoyerDepuisEffet(); };
    window.addEventListener("online", auRetour);
    return () => window.removeEventListener("online", auRetour);
  }, [schoolId]);

  // Une ligne qui passe prouve que l'écriture refonctionne : on en profite
  // pour renvoyer celles qui attendaient.
  return async (ecriture) => {
    const resultat = await inscrireAuJournal(schoolId, ajouter, ecriture);
    if (!resultat.enAttente) renvoyer();
    return resultat;
  };
}
