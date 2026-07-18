import { useCallback, useEffect, useRef, useState } from "react";
import {
  chargerDestinataires, chargerMessagerie, envoyerMessageInterne,
  marquerMessageLu, supprimerMessageInterne,
} from "../../backend/messagerie-interne-supabase";

// Boîte de messages interne du personnel : chargement, badge de non-lus,
// composeur (individuel / postes / tout le personnel) et accusés de lecture.
export function useMessagerie({ utilisateur, actif }) {
  const [ouvert, setOuvert] = useState(false);
  const [vue, setVue] = useState("boite"); // "boite" | "nouveau"
  const [messages, setMessages] = useState([]);
  const [lusIds, setLusIds] = useState(new Set());
  const [destinataires, setDestinataires] = useState({ comptes: [], postes: [] });
  const [messageOuvertId, setMessageOuvertId] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState({ cibleType: "tous", posteCles: [], compteId: "", sujet: "", corps: "" });
  const moi = utilisateur?.compteDocId;
  const chargeRef = useRef(false);

  const charger = useCallback(async () => {
    try {
      const { messages: liste, lusIds: lus } = await chargerMessagerie();
      setMessages(liste);
      setLusIds(lus);
    } catch { /* messagerie non disponible (SQL pas encore appliqué) : silencieux */ }
  }, []);

  // Premier chargement + rafraîchissement périodique léger (badge).
  useEffect(() => {
    if (!actif || chargeRef.current) return undefined;
    chargeRef.current = true;
    charger();
    const timer = setInterval(charger, 120000);
    return () => clearInterval(timer);
  }, [actif, charger]);

  const basculer = async () => {
    const prochain = !ouvert;
    setOuvert(prochain);
    setVue("boite");
    setErreur("");
    if (prochain) {
      charger();
      if (!destinataires.comptes.length) {
        try { setDestinataires(await chargerDestinataires()); } catch { /* réessaiera */ }
      }
    }
  };

  const nonLus = messages.filter((m) => m.de_compte_id !== moi && !lusIds.has(m.id)).length;

  const ouvrirMessage = (message) => {
    setMessageOuvertId((prev) => (prev === message.id ? null : message.id));
    if (message.de_compte_id !== moi && !lusIds.has(message.id) && moi) {
      marquerMessageLu(message.id, moi).catch(() => {});
      setLusIds((prev) => new Set([...prev, message.id]));
    }
  };

  const supprimer = async (message) => {
    try {
      await supprimerMessageInterne(message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (e) {
      setErreur(e.message || "Suppression impossible.");
    }
  };

  const chg = (champ) => (e) => setForm((prev) => ({ ...prev, [champ]: e.target.value }));
  const basculerPoste = (cle) => setForm((prev) => ({
    ...prev,
    posteCles: prev.posteCles.includes(cle)
      ? prev.posteCles.filter((c) => c !== cle)
      : [...prev.posteCles, cle],
  }));

  const envoyer = async () => {
    setErreur("");
    if (!form.corps.trim()) { setErreur("Le message est vide."); return; }
    const cible = form.cibleType === "tous" ? { tous: true }
      : form.cibleType === "poste" ? { posteCles: form.posteCles }
        : (() => {
          const compte = destinataires.comptes.find((c) => c.id === form.compteId);
          return { compteId: form.compteId, userId: compte?.user_id };
        })();
    if (form.cibleType === "poste" && !cible.posteCles.length) { setErreur("Choisissez au moins un poste."); return; }
    if (form.cibleType === "compte" && !cible.compteId) { setErreur("Choisissez un destinataire."); return; }
    setEnvoiEnCours(true);
    try {
      await envoyerMessageInterne({
        schoolCode: localStorage.getItem("LC_schoolId"),
        expediteur: {
          compteId: moi, nom: utilisateur.nom,
          posteLabel: utilisateur.posteLabel || utilisateur.label,
        },
        cible, sujet: form.sujet, corps: form.corps,
      });
      setForm({ cibleType: "tous", posteCles: [], compteId: "", sujet: "", corps: "" });
      setVue("boite");
      await charger();
    } catch (e) {
      setErreur(e.message || "Envoi impossible.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return {
    ouvert, basculer, vue, setVue, messages, lusIds, nonLus, moi,
    destinataires, messageOuvertId, ouvrirMessage, supprimer,
    form, chg, basculerPoste, envoyer, envoiEnCours, erreur,
  };
}
