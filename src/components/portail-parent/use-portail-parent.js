import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSectionForClasse } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { SchoolContext } from "../../contexts/SchoolContext";
import { fetchParentPortal, envoyerMessageParent } from "./portail-parent-api";
import {
  filtrerNotes,
  filtrerAbsences,
  trierMessages,
  computeTarifInfos,
  computeBlocage,
} from "./portail-parent-derive";

// Logique du portail parent : chargement des données via /parent-portal,
// dérivations par enfant courant (notes/absences/messages/tarifs/blocage),
// envoi de message et définition des onglets.
export function usePortailParent({ utilisateur, schoolInfo }) {
  const { t } = useTranslation();
  const { toast, moisAnnee } = useContext(SchoolContext);

  const [tab, setTab] = useState("dashboard");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [portalData, setPortalData] = useState({
    eleves: [],
    notes: [],
    absences: [],
    messages: [],
    tarifs: [],
    annonces: [],
  });
  const [eleveActifId, setEleveActifId] = useState(utilisateur.eleveId || "");

  const eleves = portalData.eleves || [];
  const notes = portalData.notes;
  const absences = portalData.absences;
  const messages = portalData.messages;
  const tarifs = portalData.tarifs || [];
  const annonces = portalData.annonces || [];

  const eleve = eleves.find((item) => item._id === eleveActifId) || eleves[0] || {};
  const eleveId = eleve._id || utilisateur.eleveId || null;
  const eleveNom = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim() || utilisateur.eleveNom || "";
  // Périodicité dépend de la section de l'enfant courant (primaire vs secondaire).
  // Détection par motif : fonctionne aussi pour les classes hors listes (3ème Année E…).
  const sectionPeriode = getSectionForClasse(eleve.classe) === "primaire" ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);
  const section = eleve.section || utilisateur.section || "college";

  const mesNotes = useMemo(() => filtrerNotes(notes, eleveId), [notes, eleveId]);
  const mesAbsences = useMemo(() => filtrerAbsences(absences, eleveId), [absences, eleveId]);
  const mesMessages = useMemo(() => trierMessages(messages, eleveId), [messages, eleveId]);
  const nonLus = mesMessages.filter((item) => item.expediteur === "ecole" && !item.lu).length;

  const { montantMensuel, montantAutre, estReinscription, montantInscription } = computeTarifInfos(tarifs, eleve);
  const matieres = [...new Set(mesNotes.map((item) => item.matiere).filter(Boolean))];

  const { moisImpayes, accesBloqueParPaiement } = computeBlocage(schoolInfo, eleve, moisAnnee);

  const chargerPortail = async () => {
    setChargement(true);
    try {
      const data = await fetchParentPortal();
      setPortalData(data);
      setEleveActifId((current) => current || utilisateur.eleveId || data.eleves?.[0]?._id || "");
    } catch (error) {
      toast(error.message || "Erreur de chargement du portail parent.", "error");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerPortail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const envoyer = async () => {
    if (!sujet.trim() || !corps.trim()) {
      toast("Sujet et message requis.", "warning");
      return;
    }
    if (!eleveId) {
      toast("Eleve introuvable pour ce compte parent.", "warning");
      return;
    }

    setEnvoi(true);
    try {
      await envoyerMessageParent({ eleveId, sujet: sujet.trim(), corps: corps.trim() });
      setSujet("");
      setCorps("");
      await chargerPortail();
    } catch (error) {
      toast(error.message || "Erreur d'envoi.", "error");
    } finally {
      setEnvoi(false);
    }
  };

  const tabs = [
    { id: "dashboard", label: t("parent.tabs.overview") },
    { id: "notes", label: t("parent.tabs.grades"), bloque: accesBloqueParPaiement },
    { id: "absences", label: t("parent.tabs.absences") },
    { id: "bulletins", label: t("parent.tabs.bulletin"), bloque: accesBloqueParPaiement },
    { id: "paiements", label: t("parent.tabs.fees") },
    { id: "messages", label: `${t("parent.tabs.messages")}${nonLus > 0 ? ` (${nonLus})` : ""}` },
  ];

  return {
    tab, setTab,
    sujet, setSujet,
    corps, setCorps,
    envoi,
    chargement,
    eleves,
    annonces,
    eleve,
    eleveId,
    eleveNom,
    eleveActifId, setEleveActifId,
    periodes,
    section,
    mesNotes,
    mesAbsences,
    mesMessages,
    nonLus,
    montantMensuel,
    montantAutre,
    estReinscription,
    montantInscription,
    matieres,
    moisImpayes,
    accesBloqueParPaiement,
    moisAnnee,
    envoyer,
    tabs,
  };
}
