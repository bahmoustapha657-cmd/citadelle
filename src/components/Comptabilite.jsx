import { useTranslation } from "react-i18next";
import { Tabs } from "./ui";
import { useComptabilite } from "./comptabilite/use-comptabilite";
import { ComptaHeader } from "./comptabilite/ComptaHeader";
import { ComptaTabContent } from "./comptabilite/ComptaTabContent";

// Orchestrateur du module Comptabilité : la logique vit dans useComptabilite,
// l'en-tête dans ComptaHeader et l'aiguillage des onglets dans ComptaTabContent.
function Comptabilite({ readOnly, annee, userRole, permissions = null, verrouOuvert = false }) {
  const { t } = useTranslation();
  const c = useComptabilite({ readOnly, annee, userRole, permissions, verrouOuvert });

  const tabs = [
    { id: "bilan", label: t("accounting.tabs.bilan") },
    { id: "recettes", label: `${t("accounting.tabs.revenues")} (${c.recettes.length})` },
    { id: "depenses", label: `${t("accounting.tabs.expenses")} (${c.depenses.length})` },
    { id: "salaires", label: t("accounting.tabs.salaries") },
    { id: "enseignants", label: `${t("accounting.tabs.teachers")} (${c.ensPrimaire.length + c.ensCollege.length + c.ensLycee.length})` },
    { id: "personnel", label: `${t("accounting.tabs.staff")} (${c.personnel.length})` },
    { id: "fondation", label: `${t("accounting.tabs.donations")} (${c.versements.length})` },
    { id: "enrolment", label: `${t("accounting.tabs.students")} (${c.elevesC.length + c.elevesL.length + c.elevesP.length})` },
    { id: "mens", label: t("accounting.tabs.monthlyFees") },
    { id: "transferts", label: `🔄 ${t("accounting.tabs.transfers")}` },
  ];

  return (
    <div style={{ padding: "22px 26px" }}>
      <ComptaHeader c={c} readOnly={readOnly} />
      <Tabs items={tabs} actif={c.tab} onChange={c.setTab} />
      <ComptaTabContent c={c} readOnly={readOnly} annee={annee} userRole={userRole} />
    </div>
  );
}

export { Comptabilite };
