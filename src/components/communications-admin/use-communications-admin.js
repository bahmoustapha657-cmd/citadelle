import { useEffect, useMemo, useState } from "react";
import {
  subscribeMessages,
  fetchStatsLectures,
  envoyerMessage,
  supprimerMessageApi,
} from "./communications-admin-api";
import {
  computeEcolesParPlan,
  construireCibleSchools,
  validerMessage,
  messageSucces,
  buildPreviewCible,
} from "./communications-admin-logic";

// Logique du module Communications superadmin : flux Firestore des messages,
// calcul des statistiques de lecture, état du formulaire et envoi/suppression.
export function useCommunicationsAdmin({ ecoles, auteur }) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [niveau, setNiveau] = useState("info");
  const [modeCible, setModeCible] = useState("toutes"); // toutes | plan | selection
  const [planChoisi, setPlanChoisi] = useState("gratuit");
  const [schoolsChoisies, setSchoolsChoisies] = useState([]);
  const [rolesChoisis, setRolesChoisis] = useState(["direction", "admin"]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [messages, setMessages] = useState([]);
  const [statsLectures, setStatsLectures] = useState({});

  useEffect(() => {
    const unsub = subscribeMessages(setMessages);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    let annule = false;
    fetchStatsLectures(messages).then((stats) => {
      if (!annule) setStatsLectures(stats);
    });
    return () => {
      annule = true;
    };
  }, [messages]);

  const ecolesParPlan = useMemo(() => computeEcolesParPlan(ecoles), [ecoles]);

  const toggleRole = (id) => {
    setRolesChoisis((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const toggleSchool = (id) => {
    setSchoolsChoisies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const reinitFormulaire = () => {
    setTitre("");
    setCorps("");
    setNiveau("info");
    setModeCible("toutes");
    setSchoolsChoisies([]);
    setRolesChoisis(["direction", "admin"]);
  };

  const envoyer = async () => {
    setErreur("");
    const cibleSchools = construireCibleSchools({ modeCible, ecoles, planChoisi, schoolsChoisies });
    const invalide = validerMessage({ titre, corps, rolesChoisis, cibleSchools });
    if (invalide) {
      setErreur(invalide);
      return;
    }
    setEnvoiEnCours(true);
    try {
      await envoyerMessage({
        titre: titre.trim(),
        corps: corps.trim(),
        niveau,
        cibleSchools,
        cibleRoles: rolesChoisis,
        auteur,
      });
      setSucces(messageSucces(cibleSchools));
      reinitFormulaire();
      setTimeout(() => setSucces(""), 4000);
    } catch (e) {
      setErreur(`Échec de l'envoi : ${e?.message || "erreur inconnue"}.`);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const supprimerMessage = async (id) => {
    if (!confirm("Supprimer ce message ? Les destinataires ne le verront plus.")) return;
    try {
      await supprimerMessageApi(id);
    } catch (e) {
      alert(`Suppression impossible : ${e?.message || "erreur"}`);
    }
  };

  const previewCible = buildPreviewCible({ modeCible, ecoles, planChoisi, ecolesParPlan, schoolsChoisies });

  return {
    titre, setTitre, corps, setCorps, niveau, setNiveau,
    modeCible, setModeCible, planChoisi, setPlanChoisi,
    schoolsChoisies, rolesChoisis,
    envoiEnCours, erreur, succes, messages, statsLectures,
    ecolesParPlan, toggleRole, toggleSchool,
    envoyer, supprimerMessage, previewCible,
  };
}
