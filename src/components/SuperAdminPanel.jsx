import { useState } from "react";

import { SuperAdminTabs } from "./superadmin/SuperAdminTabs";
import { EcolesTab } from "./superadmin/EcolesTab";
import { PlansTab } from "./superadmin/PlansTab";
import { DemandesTab } from "./superadmin/DemandesTab";
import { OutilsTab } from "./superadmin/OutilsTab";
import { LIFECYCLE_LABELS, S_STYLES } from "./superadmin/constants";
import { useEcolesAdmin } from "./superadmin/useEcolesAdmin";

// =============================================================
//  PANEL SUPER-ADMIN — orchestrateur
// =============================================================
// La logique métier (écoles/plans/demandes) vit dans useEcolesAdmin. Ce
// composant ne garde que le feedback transverse (msgSucces) et la navigation
// entre onglets. Chaque onglet vit dans src/components/superadmin/.
function SuperAdminPanel() {
  const [msgSucces, setMsgSucces] = useState("");
  const [ongletSA, setOngletSA] = useState("ecoles");
  const [outilsTab, setOutilsTab] = useState("communications");

  const ea = useEcolesAdmin(setMsgSucces);

  const S = S_STYLES;

  return (
    <div style={S.page}>
      <h2 style={S.titre}>Panel Super-Admin</h2>
      <p style={S.sous}>Gestion de toutes les ecoles enregistrees sur la plateforme</p>

      {msgSucces && (
        <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:18,fontSize:13,color:"#065f46",fontWeight:600}}>
          {msgSucces}
        </div>
      )}

      <SuperAdminTabs
        ongletSA={ongletSA} setOngletSA={setOngletSA} demandes={ea.demandes}
        setPlanModal={ea.setPlanModal} setConfirmDowngrade={ea.setConfirmDowngrade}
      />

      {ongletSA==="outils" && (
        <OutilsTab outilsTab={outilsTab} setOutilsTab={setOutilsTab} ecoles={ea.ecoles}/>
      )}

      {ongletSA==="demandes" && (
        <DemandesTab
          demandes={ea.demandes}
          validerDemande={ea.validerDemande}
          rejeterDemande={ea.rejeterDemande}
          S={S}
        />
      )}

      {ongletSA==="plans" && (
        <PlansTab
          ecoles={ea.ecoles}
          recherche={ea.recherche}
          chargement={ea.chargement}
          planModal={ea.planModal} setPlanModal={ea.setPlanModal}
          planChoix={ea.planChoix} setPlanChoix={ea.setPlanChoix}
          planDuree={ea.planDuree} setPlanDuree={ea.setPlanDuree}
          planSaving={ea.planSaving}
          confirmDowngrade={ea.confirmDowngrade} setConfirmDowngrade={ea.setConfirmDowngrade}
          msgSucces={msgSucces}
          sauvegarderPlan={ea.sauvegarderPlan}
          planPanelRef={ea.planPanelRef}
        />
      )}

      {ongletSA==="ecoles" && (
        <EcolesTab
          ecoles={ea.ecoles}
          ecolesFiltrees={ea.ecolesFiltrees}
          stats={ea.stats}
          chargement={ea.chargement}
          recherche={ea.recherche} setRecherche={ea.setRecherche}
          creationOuverte={ea.creationOuverte} setCreationOuverte={ea.setCreationOuverte}
          nouvelleEcole={ea.nouvelleEcole} setNouvelleEcole={ea.setNouvelleEcole}
          genSlug={ea.genSlug}
          creerEcole={ea.creerEcole}
          confirmation={ea.confirmation} setConfirmation={ea.setConfirmation}
          confirmationValue={ea.confirmationValue} setConfirmationValue={ea.setConfirmationValue}
          confirmationLoading={ea.confirmationLoading}
          executerCycleVie={ea.executerCycleVie}
          ouvrirConfirmation={ea.ouvrirConfirmation}
          lifecycleLabels={LIFECYCLE_LABELS}
          planModal={ea.planModal} setPlanModal={ea.setPlanModal}
          planChoix={ea.planChoix} setPlanChoix={ea.setPlanChoix}
          planDuree={ea.planDuree} setPlanDuree={ea.setPlanDuree}
          planSaving={ea.planSaving}
          confirmDowngrade={ea.confirmDowngrade} setConfirmDowngrade={ea.setConfirmDowngrade}
          msgSucces={msgSucces}
          sauvegarderPlan={ea.sauvegarderPlan}
          planPanelRef={ea.planPanelRef}
          chargerEcoles={ea.chargerEcoles}
          S={S}
        />
      )}
    </div>
  );
}

export default SuperAdminPanel;
