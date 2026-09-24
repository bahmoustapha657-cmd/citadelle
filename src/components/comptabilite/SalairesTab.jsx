import { useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { isGroupeActif } from "../../constants";
import { Chargement } from "../ui";
import { SalairesToolbar } from "./salaires/SalairesToolbar";
import { BonsSousOnglet } from "./salaires/BonsSousOnglet";
import { SalairesBilan } from "./salaires/SalairesBilan";
import { SecondaireTable } from "./salaires/SecondaireTable";
import { PrimaireTable } from "./salaires/PrimaireTable";
import { PersonnelTable } from "./salaires/PersonnelTable";
import { SalaireModale } from "./salaires/SalaireModale";
import { BonModale } from "./salaires/BonModale";

export function SalairesTab({
  // sous-onglet
  sousTabSal,
  setSousTabSal,
  // sélection mois
  moisSel,
  setMoisSel,
  moisSalaire,
  moisLabel,
  moisModale,
  annee,
  // prime défaut
  primeDefaut,
  setPrimeDefaut,
  // form / modal
  form,
  setForm,
  modal,
  setModal,
  // permissions
  canCreate,
  canEdit,
  readOnly,
  // données salaires
  salaires,
  cS,
  modS,
  supS,
  salairesMois,
  salairesSec,
  salairesPrim,
  salairesPers,
  totNetSec,
  totNetPrim,
  totNetPers,
  // données bons
  bonsMois,
  ajBon,
  modBon,
  supBon,
  // listes enseignants actuelles (pour filtrer le sélecteur de bons
  // sur les profs encore présents — évite que des noms renommés ou
  // supprimés restent visibles via les anciens salaires)
  ensPrimaire = [],
  ensCollege = [],
  ensLycee = [],
  personnel = [],
  // filtres primaire
  filtrePrimNom,
  setFiltrePrimNom,
  filtrePrimClasse,
  setFiltrePrimClasse,
  // helpers de calcul
  calcExecute,
  calcMontant,
  calcNet,
  calcNetF,
  // actions
  autoGenererSalaires,
  appliquerBons,
  imprimerSalaires,
  enreg,
  saveSalaire,
}) {
  const { schoolInfo } = useContext(SchoolContext);
  // Groupes de paie affichés et proposés : ceux que l'école a ouverts
  // (Paramètres → Identité)… ou qui ont déjà des fiches cette année — une
  // fiche de paie compte dans la masse salariale, elle ne doit pas disparaître
  // de l'écran.
  const groupesPaie = {
    secondaire: isGroupeActif(schoolInfo, "secondaire") || salaires.some((s) => s.section === "Secondaire"),
    primaire: isGroupeActif(schoolInfo, "primaire") || salaires.some((s) => s.section === "Primaire"),
  };
  return (
    <div>
      <SalairesToolbar
        sousTabSal={sousTabSal} setSousTabSal={setSousTabSal}
        moisSel={moisSel} setMoisSel={setMoisSel} moisSalaire={moisSalaire} bonsMois={bonsMois}
        canCreate={canCreate} primeDefaut={primeDefaut} setPrimeDefaut={setPrimeDefaut}
        autoGenererSalaires={autoGenererSalaires} appliquerBons={appliquerBons}
        imprimerSalaires={imprimerSalaires} setForm={setForm} setModal={setModal} moisModale={moisModale}
        groupesPaie={groupesPaie}
      />

      {/* ── SOUS-ONGLET BONS ── */}
      {sousTabSal==="bons"&&
        <BonsSousOnglet bonsMois={bonsMois} moisLabel={moisLabel} canEdit={canEdit} supBon={supBon} setForm={setForm} setModal={setModal}/>
      }

      {/* ── SOUS-ONGLET ÉTATS ── */}
      {sousTabSal==="etats"&&<>

      {/* ── BILAN SALAIRES ── */}
      {!cS&&
        <SalairesBilan
          totNetSec={totNetSec} totNetPrim={totNetPrim} totNetPers={totNetPers}
          salairesMois={salairesMois} moisSalaire={moisSalaire} salaires={salaires}
          calcNet={calcNet} moisLabel={moisLabel}
          salairesSec={salairesSec} salairesPrim={salairesPrim} salairesPers={salairesPers}
          annee={annee} groupesPaie={groupesPaie}
        />
      }

      {cS?<Chargement/>:<>
        {moisSel==="__TOUS__"&&<div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#92400e"}}>
          <strong>📊 Mode prévision annuelle</strong> — Sélectionnez un mois précis pour consulter ou modifier ses salaires.
          Cliquez sur <strong>⚡ Auto-générer</strong> pour remplir d'un coup les {moisSalaire.length} mois de l'année scolaire.
        </div>}

        {groupesPaie.secondaire&&<SecondaireTable
          salairesSec={salairesSec} canEdit={canEdit} readOnly={readOnly}
          calcExecute={calcExecute} calcMontant={calcMontant} calcNet={calcNet}
          modS={modS} supS={supS} setForm={setForm} setModal={setModal}
          totNetSec={totNetSec} moisLabel={moisLabel} annee={annee}
        />}

        {groupesPaie.primaire&&<PrimaireTable
          salairesPrim={salairesPrim}
          filtrePrimNom={filtrePrimNom} setFiltrePrimNom={setFiltrePrimNom}
          filtrePrimClasse={filtrePrimClasse} setFiltrePrimClasse={setFiltrePrimClasse}
          canEdit={canEdit} modS={modS} supS={supS} setForm={setForm} setModal={setModal}
          moisLabel={moisLabel} annee={annee}
        />}

        <PersonnelTable
          salairesPers={salairesPers} canEdit={canEdit} calcNetF={calcNetF}
          supS={supS} setForm={setForm} setModal={setModal}
          totNetSec={totNetSec} totNetPrim={totNetPrim} totNetPers={totNetPers}
          moisLabel={moisLabel} annee={annee}
        />
      </>}

      </>}

      <SalaireModale
        modal={modal} canCreate={canCreate} canEdit={canEdit}
        form={form} setForm={setForm} setModal={setModal}
        moisModale={moisModale} moisSalaire={moisSalaire}
        calcExecute={calcExecute} calcMontant={calcMontant} calcNet={calcNet}
        saveSalaire={saveSalaire} groupesPaie={groupesPaie}
      />

      <BonModale
        modal={modal} canCreate={canCreate} canEdit={canEdit}
        form={form} setForm={setForm} setModal={setModal}
        moisModale={moisModale} moisSalaire={moisSalaire}
        ensCollege={ensCollege} ensLycee={ensLycee} ensPrimaire={ensPrimaire} personnel={personnel}
        ajBon={ajBon} modBon={modBon} enreg={enreg} groupesPaie={groupesPaie}
      />
    </div>
  );
}
