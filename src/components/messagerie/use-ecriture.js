import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ouvrirCanalEcriture } from "../../backend/messagerie-supabase";
import { creerEmetteur, creerSuivi } from "./ecriture-logic";

// « En train d'écrire… » de la discussion ouverte : écoute le canal privé de
// la discussion et y signale sa propre frappe. Canal refusé ou hors réseau :
// pas d'indication, la discussion fonctionne comme avant.
export function useEcriture({ convId, moi }) {
  const [enTrainDEcrire, setEnTrainDEcrire] = useState([]);
  const suiviRef = useRef(null);
  const emetteurRef = useRef(null);

  useEffect(() => {
    if (!convId || !moi) return undefined;
    const suivi = creerSuivi();
    suiviRef.current = suivi;
    let minuteur = null;
    const rafraichir = () => {
      clearTimeout(minuteur);
      const actifs = suivi.actifs();
      setEnTrainDEcrire((avant) => (avant.join() === actifs.join() ? avant : actifs));
      const echeance = suivi.prochaineEcheance();
      if (echeance) minuteur = setTimeout(rafraichir, Math.max(200, echeance - Date.now() + 50));
    };
    const canal = ouvrirCanalEcriture(convId, (evenement, charge) => {
      if (!charge?.de || charge.de === moi) return;
      suivi.recevoir(evenement, charge.de);
      rafraichir();
    });
    const emetteur = creerEmetteur((evenement) => canal.envoyer(evenement, { de: moi }));
    emetteurRef.current = emetteur;
    suivi.rafraichir = rafraichir;
    return () => {
      clearTimeout(minuteur);
      emetteur.arret();
      canal.fermer();
      suiviRef.current = null;
      emetteurRef.current = null;
      setEnTrainDEcrire([]);
    };
  }, [convId, moi]);

  // Fonctions stables : un effet qui en dépend ne se relance pas à chaque
  // changement de l'indication (il l'effacerait aussitôt réapparue).
  const signalerFrappe = useCallback((texte) => emetteurRef.current?.frappe(texte), []);
  const signalerArret = useCallback(() => emetteurRef.current?.arret(), []);
  // Son message est arrivé : l'indication tombe tout de suite.
  const oublier = useCallback((de) => { suiviRef.current?.oublier(de); suiviRef.current?.rafraichir?.(); }, []);

  return useMemo(() => ({ enTrainDEcrire, signalerFrappe, signalerArret, oublier }),
    [enTrainDEcrire, signalerFrappe, signalerArret, oublier]);
}
