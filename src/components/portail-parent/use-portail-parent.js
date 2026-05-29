import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { CLASSES_PRIMAIRE, getTarifAutreValue, getTarifMensuelTotal } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { SchoolContext } from "../../contexts/SchoolContext";
import { normalizeText } from "./helpers";

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
  const sectionPeriode = CLASSES_PRIMAIRE.includes(eleve.classe) ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);
  const section = eleve.section || utilisateur.section || "college";

  const mesNotes = useMemo(
    () => notes.filter((item) => item.eleveId === eleveId),
    [notes, eleveId],
  );
  const mesAbsences = useMemo(
    () => absences.filter((item) => item.eleveId === eleveId),
    [absences, eleveId],
  );
  const mesMessages = useMemo(
    () => [...messages]
      .filter((item) => item.eleveId === eleveId)
      .sort((left, right) => Number(right.date || 0) - Number(left.date || 0)),
    [messages, eleveId],
  );
  const nonLus = mesMessages.filter((item) => item.expediteur === "ecole" && !item.lu).length;

  const tarifEleve = tarifs.find((item) => item.classe === eleve.classe) || null;
  const montantMensuel = getTarifMensuelTotal(tarifEleve, eleve.classe);
  const montantAutre = getTarifAutreValue(tarifEleve);
  const typeInscription = normalizeText(eleve.typeInscription);
  const estReinscription = typeInscription === "reinscription";
  const montantInscription = estReinscription
    ? Number(tarifEleve?.reinscription || 0)
    : Number(tarifEleve?.inscription || 0);
  const matieres = [...new Set(mesNotes.map((item) => item.matiere).filter(Boolean))];

  const blocageActif = !!schoolInfo.blocageParentImpaye;
  const moisImpayes = moisAnnee.filter((mois) => normalizeText((eleve.mens || {})[mois]) !== "paye");
  const accesBloqueParPaiement = blocageActif && moisImpayes.length > 0;

  const chargerPortail = async () => {
    setChargement(true);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch("/parent-portal", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Chargement impossible.");
      }

      setPortalData({
        eleves: Array.isArray(data.eleves) ? data.eleves : [],
        notes: Array.isArray(data.notes) ? data.notes : [],
        absences: Array.isArray(data.absences) ? data.absences : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        tarifs: Array.isArray(data.tarifs) ? data.tarifs : [],
        annonces: Array.isArray(data.annonces) ? data.annonces : [],
      });
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
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/parent-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eleveId,
          sujet: sujet.trim(),
          corps: corps.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Envoi impossible.");
      }
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
