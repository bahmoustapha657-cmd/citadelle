import { useTranslation } from "react-i18next";
import { Chargement } from "./ui";
import ComplianceAlert from "./ComplianceAlert";
import { useTableauDeBord } from "./tableau-de-bord/use-tableau-de-bord";
import { DashboardHeader } from "./tableau-de-bord/DashboardHeader";
import { KpiGrid } from "./tableau-de-bord/KpiGrid";
import { ChartsRow } from "./tableau-de-bord/ChartsRow";
import { TrendsCard } from "./tableau-de-bord/TrendsCard";
import { EventsAlerts } from "./tableau-de-bord/EventsAlerts";
import { AbonnementBloc } from "./tableau-de-bord/AbonnementBloc";

// Orchestrateur du tableau de bord : les données et calculs vivent dans
// useTableauDeBord, chaque bloc visuel dans tableau-de-bord/*.jsx.
function TableauDeBord({ annee, userRole, onOpenLegalSettings }) {
  const { t } = useTranslation();
  const d = useTableauDeBord();

  if (d.enChargement) return <Chargement type="kpi" cols={6} />;

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1200 }}>
      <DashboardHeader
        t={t} c1={d.c1} schoolInfo={d.schoolInfo} annee={annee} moisAnnee={d.moisAnnee}
        moisRapport={d.moisRapport} setMoisRapport={d.setMoisRapport}
        elevesC={d.elevesC} elevesL={d.elevesL} elevesP={d.elevesP}
        absences={d.absences} absL={d.absL} absP={d.absP}
        notesC={d.notesC} notesL={d.notesL} notesP={d.notesP}
        recettes={d.recettes} depenses={d.depenses} salaires={d.salaires}
        ensC={d.ensC} ensL={d.ensL} ensP={d.ensP}
      />

      <KpiGrid
        t={t} c1={d.c1} c2={d.c2}
        totalEleves={d.totalEleves} elevesC={d.elevesC} elevesL={d.elevesL} elevesP={d.elevesP}
        totalEns={d.totalEns} ensC={d.ensC} ensL={d.ensL} ensP={d.ensP}
        tauxPay={d.tauxPay} solde={d.solde} totalRec={d.totalRec} totalDep={d.totalDep}
        masseSal={d.masseSal} salMois={d.salMois} moisActuel={d.moisActuel} totalAbs={d.totalAbs}
      />

      {/* Alerte Conformité légale (compact) — réservé directeur/admin.
          Le widget complet d'édition vit dans Paramètres → onglet Officiel. */}
      {["direction", "admin", "superadmin"].includes(userRole) && (
        <ComplianceAlert onOpenSettings={onOpenLegalSettings} />
      )}

      <ChartsRow
        t={t} c1={d.c1} c2={d.c2}
        elevesC={d.elevesC} elevesL={d.elevesL} elevesP={d.elevesP}
        tauxPayC={d.tauxPayC} tauxPayL={d.tauxPayL} tauxPayP={d.tauxPayP} tauxPay={d.tauxPay}
      />

      <TrendsCard c1={d.c1} c2={d.c2} annee={annee} dataTendance={d.dataTendance} />

      <EventsAlerts
        c1={d.c1} c2={d.c2} evAVenir={d.evAVenir}
        tauxPay={d.tauxPay} solde={d.solde} masseSal={d.masseSal} totalRec={d.totalRec}
      />

      <AbonnementBloc
        planInfo={d.planInfo} schoolInfo={d.schoolInfo}
        demandeOuverte={d.demandeOuverte} setDemandeOuverte={d.setDemandeOuverte}
        demandePlan={d.demandePlan} setDemandePlan={d.setDemandePlan}
        demandeForm={d.demandeForm} setDemandeForm={d.setDemandeForm}
        demandeEnvoi={d.demandeEnvoi} demandeSucces={d.demandeSucces} envoyerDemande={d.envoyerDemande}
      />
    </div>
  );
}

export { TableauDeBord };
