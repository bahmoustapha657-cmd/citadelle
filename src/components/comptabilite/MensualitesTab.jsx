import { useTranslation } from "react-i18next";
import { C, getAnnee } from "../../constants";
import { TarifsClasses } from "../TarifsClasses";
import { AlertesCritiques } from "./mensualites-tab/AlertesCritiques";
import { MensualitesTable } from "./mensualites-tab/MensualitesTable";

// Onglet mensualités : tarifs par classe, alertes impayés, filtres niveau/classe
// puis tableau de suivi des paiements. Aiguille les données vers chaque bloc.
export function MensualitesTab({
  // tarifs
  tarifsClasses,
  saveTarif,
  getTarifBase,
  getTarifRevision,
  getTarifAutre,
  getTarifIns,
  getTarifReinsc,
  canEditEleves,
  // mensualités
  eleves,
  elevesFiltres,
  classesU,
  niveau,
  setNiveau,
  filtClasse,
  setFiltClasse,
  moisAnnee,
  annee,
  readOnly,
  canCreate,
  canEdit,
  schoolInfo,
  toggleMens,
  toggleFraisAnnexe,
  getTarifInscriptionEleve,
  getTarif,
  getTarifFraisDivers,
}) {
  const { t } = useTranslation();
  return (
    <div>
      <TarifsClasses
        tarifsClasses={tarifsClasses}
        saveTarif={saveTarif}
        getTarifBase={getTarifBase}
        getTarifRevision={getTarifRevision}
        getTarifAutre={getTarifAutre}
        getTarifIns={getTarifIns}
        getTarifReinsc={getTarifReinsc}
        getTarifFraisDivers={getTarifFraisDivers}
        canEdit={canEditEleves}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, flex: 1, color: C.blueDark }}>{t("accounting.monthly")} — {annee || getAnnee()}</strong>
        <select value={niveau} onChange={e => { setNiveau(e.target.value); setFiltClasse("all"); }}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark, fontWeight: 600 }}>
          <option value="college">{t("dashboard.secondary")}</option>
          <option value="lycee">{t("dashboard.lycee")}</option>
          <option value="primaire">{t("dashboard.primary")}</option>
        </select>
        {classesU.length > 0 && <select value={filtClasse} onChange={e => setFiltClasse(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark }}>
          <option value="all">{t("common.all")}</option>
          {classesU.map(c => <option key={c}>{c}</option>)}
        </select>}
      </div>

      {/* Alertes impayés : repliées derrière un bouton, filtrées cycle + classe. */}
      <AlertesCritiques eleves={elevesFiltres} moisAnnee={moisAnnee} />

      <MensualitesTable
        eleves={eleves}
        elevesFiltres={elevesFiltres}
        moisAnnee={moisAnnee}
        tarifsClasses={tarifsClasses}
        readOnly={readOnly}
        canCreate={canCreate}
        canEdit={canEdit}
        schoolInfo={schoolInfo}
        toggleMens={toggleMens}
        toggleFraisAnnexe={toggleFraisAnnexe}
        getTarifInscriptionEleve={getTarifInscriptionEleve}
        getTarifAutre={getTarifAutre}
        getTarif={getTarif}
        getTarifFraisDivers={getTarifFraisDivers}
      />
    </div>
  );
}
