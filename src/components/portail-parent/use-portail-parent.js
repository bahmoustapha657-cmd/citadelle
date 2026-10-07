import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSectionForClasse } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { SchoolContext } from "../../contexts/SchoolContext";
import { MSG_LECTURE_SEULE_PORTAIL } from "../app/app-shell-plan";
import { tranchesValides } from "../../paiements-scolarite";
import { fetchParentPortal, envoyerMessageParent } from "./portail-parent-api";
import {
  filtrerNotes,
  filtrerAbsences,
  trierMessages,
  computeTarifInfos,
  computeBlocage,
  resumeFamille,
  sectionDeLEleve,
} from "./portail-parent-derive";

// Logique du portail parent : chargement des données via /parent-portal,
// dérivations par enfant courant (notes/absences/messages/tarifs/blocage),
// vue « famille » (tous les enfants), envoi de message et onglets.
export function usePortailParent({ utilisateur, schoolInfo }) {
  const { t } = useTranslation();
  const { toast, moisAnnee, planInfo } = useContext(SchoolContext);

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
  const sectionPeriode = getSectionForClasse(eleve.classe);
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);
  const section = sectionDeLEleve(eleve);

  const mesNotes = useMemo(() => filtrerNotes(notes, eleveId), [notes, eleveId]);
  const mesAbsences = useMemo(() => filtrerAbsences(absences, eleveId), [absences, eleveId]);
  const mesMessages = useMemo(() => trierMessages(messages, eleveId), [messages, eleveId]);
  const nonLus = mesMessages.filter((item) => item.expediteur === "ecole" && !item.lu).length;

  const { montantMensuel, estReinscription, montantInscription } = computeTarifInfos(tarifs, eleve);
  // Tranches de paiement de l'école : l'onglet Paiements y regroupe les mois.
  const tranches = tranchesValides(schoolInfo?.tranchesPaiement, moisAnnee);
  const matieres = [...new Set(mesNotes.map((item) => item.matiere).filter(Boolean))];

  const { moisImpayes, accesBloqueParPaiement } = computeBlocage(schoolInfo, eleve, moisAnnee, schoolInfo?.anneeScolaire);

  // Tous les enfants du compte, toutes sections confondues : total à payer
  // pour la famille (Aperçu, Paiements).
  const famille = useMemo(() => resumeFamille({
    eleves: portalData.eleves || [],
    absences: portalData.absences || [],
    messages: portalData.messages || [],
    tarifs: portalData.tarifs || [],
    moisAnnee,
    annee: schoolInfo?.anneeScolaire,
    schoolInfo,
  }), [portalData, moisAnnee, schoolInfo]);
  // Depuis la vue famille : passer à un enfant, et à l'un de ses onglets.
  const voirEnfant = (id, onglet) => {
    setEleveActifId(id);
    if (onglet) setTab(onglet);
  };

  const chargerPortail = async () => {
    setChargement(true);
    try {
      const data = await fetchParentPortal({ annee: schoolInfo?.anneeScolaire || "" });
      setPortalData(data);
      setEleveActifId((current) => current || utilisateur.eleveId || data.eleves?.[0]?._id || "");
    } catch (error) {
      toast(error.message || "Erreur de chargement du portail parent.", "error");
    } finally {
      setChargement(false);
    }
  };

  // Relu quand l'année officielle de l'école arrive ou change (clôture).
  useEffect(() => {
    chargerPortail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolInfo?.anneeScolaire]);

  const envoyer = async () => {
    // Abonnement de l'école expiré : les parents gardent la consultation,
    // pas l'écriture (refusée aussi par la base, ecole-hors-service.sql).
    if (planInfo?.planEstExpire) {
      toast(MSG_LECTURE_SEULE_PORTAIL, "error");
      return;
    }
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
    { id: "messages", label: `${t("parent.tabs.messages")}${nonLus > 0 ? ` (${nonLus})` : ""}`, labelBase: t("parent.tabs.messages") },
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
    tarifs,
    tranches,
    estReinscription,
    montantInscription,
    matieres,
    moisImpayes,
    accesBloqueParPaiement,
    moisAnnee,
    famille,
    voirEnfant,
    envoyer,
    tabs,
  };
}
