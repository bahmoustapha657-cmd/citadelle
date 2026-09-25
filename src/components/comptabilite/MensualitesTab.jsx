import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, getAnnee, getSectionLabel, isSectionActive } from "../../constants";
import { Btn } from "../ui";
import { TarifsClasses } from "../TarifsClasses";
import { AlertesCritiques } from "./mensualites-tab/AlertesCritiques";
import { EncaisserModale } from "./mensualites-tab/EncaisserModale";
import { ExonerationsModale } from "./mensualites-tab/ExonerationsModale";
import { MensualitesTable } from "./mensualites-tab/MensualitesTable";
import { TranchesPaiement } from "./mensualites-tab/TranchesPaiement";

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
  // Année des fiches affichées : la consultée (archive) ou la courante.
  anneeScolarite,
  readOnly,
  canCreate,
  canEdit,
  schoolInfo,
  toggleMens,
  toggleFraisAnnexe,
  getTarifInscriptionEleve,
  getTarifFraisDivers,
  estDirection,
  exonerationDeps,
  // paiements libres et tranches
  encaisserVersement,
  retirerAcompte,
  tranchesPaiement = [],
  peutReglerTranches = false,
  sauverTranches,
  toast,
}) {
  const { t } = useTranslation();
  const [exonerations, setExonerations] = useState(false);
  // Élève dont la fenêtre d'encaissement est ouverte. On garde son id et on
  // relit la fiche dans la liste : après un versement, la fenêtre montre
  // l'état à jour.
  const [encaisseId, setEncaisseId] = useState(null);
  const eleveEncaisse = encaisseId ? eleves.find((e) => e._id === encaisseId) : null;
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
      <TranchesPaiement
        tranches={tranchesPaiement}
        moisAnnee={moisAnnee}
        peutRegler={peutReglerTranches}
        sauverTranches={sauverTranches}
        toast={toast}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, flex: 1, color: C.blueDark }}>{t("accounting.monthly")} — {annee || getAnnee()}</strong>
        <select value={niveau} onChange={e => { setNiveau(e.target.value); setFiltClasse("all"); }}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark, fontWeight: 600 }}>
          {/* Seules les sections ouvertes dans l'école (Paramètres → Identité). */}
          {[
            ["college", t("dashboard.secondary")],
            ["lycee", t("dashboard.lycee")],
            ["primaire", t("dashboard.primary")],
            ["prescolaire", getSectionLabel("prescolaire")],
          ].filter(([section]) => isSectionActive(schoolInfo, section)).map(([section, label]) => (
            <option key={section} value={section}>{label}</option>
          ))}
        </select>
        {classesU.length > 0 && <select value={filtClasse} onChange={e => setFiltClasse(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark }}>
          <option value="all">{t("common.all")}</option>
          {classesU.map(c => <option key={c}>{c}</option>)}
        </select>}
        {/* Élèves dispensés de payer : la Direction les accorde, la
            comptabilité les consulte (cf. exoneration-actions). */}
        <Btn sm v="ghost" onClick={() => setExonerations(true)}>🎓 Dispenses</Btn>
      </div>

      {exonerations && <ExonerationsModale
        eleves={eleves} moisAnnee={moisAnnee} tarifsClasses={tarifsClasses}
        annee={annee || getAnnee()} estDirection={estDirection}
        deps={exonerationDeps} fermer={() => setExonerations(false)}
      />}

      {eleveEncaisse && <EncaisserModale
        eleve={eleveEncaisse} moisAnnee={moisAnnee} annee={anneeScolarite} tarifsClasses={tarifsClasses}
        tranches={tranchesPaiement} schoolInfo={schoolInfo} canEdit={canEdit}
        encaisserVersement={encaisserVersement} retirerAcompte={retirerAcompte}
        fermer={() => setEncaisseId(null)}
      />}

      {/* Alertes impayés : repliées derrière un bouton, filtrées cycle + classe. */}
      <AlertesCritiques eleves={elevesFiltres} moisAnnee={moisAnnee} annee={anneeScolarite} />

      <MensualitesTable
        eleves={eleves}
        elevesFiltres={elevesFiltres}
        moisAnnee={moisAnnee}
        annee={anneeScolarite}
        tarifsClasses={tarifsClasses}
        readOnly={readOnly}
        canCreate={canCreate}
        canEdit={canEdit}
        schoolInfo={schoolInfo}
        toggleMens={toggleMens}
        toggleFraisAnnexe={toggleFraisAnnexe}
        getTarifInscriptionEleve={getTarifInscriptionEleve}
        ouvrirEncaissement={encaisserVersement ? (e) => setEncaisseId(e._id) : null}
        tranches={tranchesPaiement}
      />
    </div>
  );
}
