import { useTranslation } from "react-i18next";
import { Tabs } from "./ui";
import { useComptabilite } from "./comptabilite/use-comptabilite";
import { ComptaHeader } from "./comptabilite/ComptaHeader";
import { ComptaTabContent } from "./comptabilite/ComptaTabContent";
import { ONGLET_COMPTA_ECOLE_PUBLIQUE, estEcolePublique } from "../ecole-publique";
import { compterSignalementsParSection } from "../depart-signale";
import { AlerteDepartsSignales } from "./departs-signales/AlerteDepartsSignales";
import { demanderOuvertureDepartsSignales } from "./departs-signales/ouvrir-departs-signales";

// Orchestrateur du module Comptabilité : la logique vit dans useComptabilite,
// l'en-tête dans ComptaHeader et l'aiguillage des onglets dans ComptaTabContent.
function Comptabilite({ readOnly, annee, userRole, permissions = null, verrouOuvert = false, auteur = "" }) {
  const { t } = useTranslation();
  const c = useComptabilite({ readOnly, annee, userRole, permissions, verrouOuvert, auteur });

  // École publique : pas de comptabilité, seulement les présences du
  // personnel (src/ecole-publique.js) — un seul onglet, sans barre d'onglets.
  if (estEcolePublique(c.schoolInfo)) {
    const p = { ...c, tab: ONGLET_COMPTA_ECOLE_PUBLIQUE };
    return (
      <div style={{ padding: "22px 26px" }}>
        <ComptaHeader c={p} readOnly={readOnly} />
        <ComptaTabContent c={p} readOnly={readOnly} annee={annee} userRole={userRole} />
      </div>
    );
  }

  const tabs = [
    { id: "bilan", label: t("accounting.tabs.bilan") },
    // Journal de caisse : le bilan raisonne par période scolaire (T1/T2…),
    // la caisse répond à « combien est entré aujourd'hui / cette semaine ».
    { id: "caisse", label: t("accounting.tabs.cash") },
    // Paiements des parents en Mobile Money (imputés automatiquement).
    { id: "en-ligne", label: t("accounting.tabs.online") },
    { id: "recettes", label: `${t("accounting.tabs.revenues")} (${c.recettes.length})` },
    { id: "depenses", label: `${t("accounting.tabs.expenses")} (${c.depenses.length})` },
    { id: "salaires", label: t("accounting.tabs.salaries") },
    // Absences/retards du personnel → retenues sur la paie.
    { id: "presences", label: t("accounting.tabs.attendance") },
    { id: "enseignants", label: `${t("accounting.tabs.teachers")} (${c.ensPrimaire.length + c.ensCollege.length + c.ensLycee.length + c.ensPrescolaire.length})` },
    { id: "personnel", label: `${t("accounting.tabs.staff")} (${c.personnel.length})` },
    { id: "fondation", label: `${t("accounting.tabs.donations")} (${c.versements.length})` },
    // Toutes les sections, préscolaire compris (sinon le compteur excluait
    // silencieusement la maternelle : 404 affichés pour 501 inscrits).
    { id: "enrolment", label: `${t("accounting.tabs.students")} (${c.elevesC.length + c.elevesL.length + c.elevesP.length + c.elevesPre.length})` },
    { id: "mens", label: t("accounting.tabs.monthlyFees") },
    { id: "transferts", label: `🔄 ${t("accounting.tabs.transfers")}` },
  ];

  // Départs signalés par les chefs de section : le comptable les voit dès
  // l'entrée dans la Comptabilité (il n'a pas d'autre tableau de bord) ;
  // l'onglet Élèves a son bouton, qui ouvre la même fenêtre.
  const paquet = c.dispenses;
  const departsSignales = c.canEditEleves && paquet
    ? compterSignalementsParSection(Object.fromEntries(paquet.sections.map((s) => [s, paquet.elevesParSection[s] || []])), paquet.annee)
    : null;
  const voirDepartsSignales = () => { demanderOuvertureDepartsSignales(); c.setTab("enrolment"); };

  return (
    <div style={{ padding: "22px 26px" }}>
      <ComptaHeader c={c} readOnly={readOnly} />
      {c.tab !== "enrolment" && <AlerteDepartsSignales compte={departsSignales} ouvrir={voirDepartsSignales} style={{ marginBottom: 14 }} />}
      <Tabs items={tabs} actif={c.tab} onChange={c.setTab} />
      <ComptaTabContent c={c} readOnly={readOnly} annee={annee} userRole={userRole} />
    </div>
  );
}

export { Comptabilite };
