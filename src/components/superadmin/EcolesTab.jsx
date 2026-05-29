import { EcolesToolbar } from "./ecoles-tab/EcolesToolbar";
import { EcolesStats } from "./ecoles-tab/EcolesStats";
import { EcolesTable } from "./ecoles-tab/EcolesTable";
import { PlanPanel } from "./ecoles-tab/PlanPanel";
import { CreationEcoleModal } from "./ecoles-tab/CreationEcoleModal";
import { ConfirmationCycleVie } from "./ecoles-tab/ConfirmationCycleVie";

// Onglet "Ecoles" du Panel Super-Admin : toolbar + KPIs + table, puis
// panneau plan / modale création / confirmation cycle de vie rendus en bas.
// Les blocs sont dans ecoles-tab/. Logique dans useEcolesAdmin.
export function EcolesTab({
  ecoles,
  ecolesFiltrees,
  stats,
  chargement,
  recherche, setRecherche,
  creationOuverte, setCreationOuverte,
  nouvelleEcole, setNouvelleEcole,
  genSlug,
  creerEcole,
  confirmation, setConfirmation,
  confirmationValue, setConfirmationValue,
  confirmationLoading,
  executerCycleVie,
  ouvrirConfirmation,
  lifecycleLabels,
  planModal, setPlanModal,
  planChoix, setPlanChoix,
  planDuree, setPlanDuree,
  planSaving,
  confirmDowngrade, setConfirmDowngrade,
  msgSucces,
  sauvegarderPlan,
  planPanelRef,
  chargerEcoles,
  lancerBackfillPublic, backfillEnCours,
  lancerMigrationAnnee, migrationAnneeEnCours,
  S,
}) {
  return (
    <>
      <EcolesToolbar
        recherche={recherche} setRecherche={setRecherche}
        setCreationOuverte={setCreationOuverte}
        chargerEcoles={chargerEcoles}
        lancerBackfillPublic={lancerBackfillPublic} backfillEnCours={backfillEnCours}
        lancerMigrationAnnee={lancerMigrationAnnee} migrationAnneeEnCours={migrationAnneeEnCours}
        S={S}
      />

      <EcolesStats ecoles={ecoles} chargement={chargement} />

      <EcolesTable
        ecolesFiltrees={ecolesFiltrees}
        stats={stats}
        chargement={chargement}
        recherche={recherche}
        planModal={planModal} setPlanModal={setPlanModal}
        setPlanChoix={setPlanChoix} setPlanDuree={setPlanDuree}
        setConfirmDowngrade={setConfirmDowngrade}
        planPanelRef={planPanelRef}
        ouvrirConfirmation={ouvrirConfirmation}
        S={S}
      />

      {planModal && (
        <PlanPanel
          planModal={planModal} setPlanModal={setPlanModal}
          planChoix={planChoix} setPlanChoix={setPlanChoix}
          planDuree={planDuree} setPlanDuree={setPlanDuree}
          planSaving={planSaving}
          confirmDowngrade={confirmDowngrade} setConfirmDowngrade={setConfirmDowngrade}
          msgSucces={msgSucces}
          sauvegarderPlan={sauvegarderPlan}
          planPanelRef={planPanelRef}
        />
      )}

      {creationOuverte && (
        <CreationEcoleModal
          nouvelleEcole={nouvelleEcole} setNouvelleEcole={setNouvelleEcole}
          genSlug={genSlug}
          creerEcole={creerEcole}
          setCreationOuverte={setCreationOuverte}
          S={S}
        />
      )}

      {confirmation && (
        <ConfirmationCycleVie
          confirmation={confirmation} setConfirmation={setConfirmation}
          confirmationValue={confirmationValue} setConfirmationValue={setConfirmationValue}
          confirmationLoading={confirmationLoading}
          executerCycleVie={executerCycleVie}
          lifecycleLabels={lifecycleLabels}
          S={S}
        />
      )}
    </>
  );
}
