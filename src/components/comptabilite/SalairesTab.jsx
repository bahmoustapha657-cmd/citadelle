import React from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn, Chargement } from "../ui";
import { getFifthWeekDays } from "../../salary-utils";
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
  const { t } = useTranslation();

  return (
    <div>
      {/* Barre de navigation interne */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[{id:"etats",label:t("accounting.salaryHeader")},{id:"bons",label:`${t("accounting.salaryBonus")}s (${bonsMois.length})`}].map(tab=>(
          <button key={tab.id} onClick={()=>setSousTabSal(tab.id)} style={{
            padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:sousTabSal===tab.id?C.blueDark:"#e0ebf8",
            color:sousTabSal===tab.id?"#fff":C.blueDark,
          }}>{tab.label}</button>
        ))}
        <div style={{flex:1}}/>
        <select value={moisSel} onChange={e=>setMoisSel(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",color:C.blueDark,fontWeight:700}}>
          <option value="__TOUS__">Tous les mois (prévision)</option>
          {moisSalaire.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        {sousTabSal==="etats"&&<>
          {canCreate&&<label title="Appliquée uniquement aux enseignants sans prime définie sur leur fiche" style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.blueDark,background:"#f0f7ff",border:"1px solid #b0c4d8",borderRadius:7,padding:"4px 10px",cursor:"help"}}>
            Prime/h par défaut
            <input type="number" min="0" value={primeDefaut||""} placeholder="0"
              onChange={e=>setPrimeDefaut(Number(e.target.value))}
              style={{width:80,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:C.blueDark,outline:"none"}}/>
            GNF
          </label>}
          {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires()}>⚡ {t("accounting.generateSalaries")}</Btn>}
          {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires({resync:true})} title="Recalcule V/H et prime horaire des lignes existantes à partir de la fiche enseignant et de l'EDT actuels (bons et révisions préservés)">🔄 {t("common.refresh")}</Btn>}
          {canCreate&&bonsMois.length>0&&<Btn v="amber" onClick={appliquerBons}>✔ {t("accounting.applyBonus")}</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({section:"Secondaire",mois:moisModale,nonExecute:0,cinqSem:0,bon:0,revision:0});setModal("add_s");}}>+ {t("common.add")}</Btn>}
          <Btn v="vert" onClick={imprimerSalaires}>🖨️ {t("accounting.printSalaries")}</Btn>
        </>}
        {(()=>{const j5=getFifthWeekDays(moisSel);return j5.length>0&&(
          <div style={{width:"100%",marginTop:6,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:8,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:15}}>📅</span>
            <strong style={{color:"#92400e"}}>{moisSel} — 5ème semaine :</strong>
            {j5.map(j=><span key={j} style={{background:"#f59e0b",color:"#fff",fontWeight:700,padding:"2px 9px",borderRadius:10,fontSize:11}}>{j}</span>)}
            <span style={{color:"#92400e",fontSize:11}}>→ Les enseignants qui ont cours ces jours ont des heures supplémentaires. Cliquez sur ⚡ Auto-générer pour les calculer automatiquement.</span>
          </div>
        );})()}
        {sousTabSal==="bons"&&canCreate&&<Btn onClick={()=>{setForm({mois:moisModale,section:"Secondaire"});setModal("add_b");}}>+ Nouveau bon</Btn>}
      </div>

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
          annee={annee}
        />
      }

      {cS?<Chargement/>:<>
        {moisSel==="__TOUS__"&&<div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#92400e"}}>
          <strong>📊 Mode prévision annuelle</strong> — Sélectionnez un mois précis pour consulter ou modifier ses salaires.
          Cliquez sur <strong>⚡ Auto-générer</strong> pour remplir d'un coup les {moisSalaire.length} mois de l'année scolaire.
        </div>}

        <SecondaireTable
          salairesSec={salairesSec} canEdit={canEdit} readOnly={readOnly}
          calcExecute={calcExecute} calcMontant={calcMontant} calcNet={calcNet}
          modS={modS} supS={supS} setForm={setForm} setModal={setModal}
          totNetSec={totNetSec} moisLabel={moisLabel} annee={annee}
        />

        <PrimaireTable
          salairesPrim={salairesPrim}
          filtrePrimNom={filtrePrimNom} setFiltrePrimNom={setFiltrePrimNom}
          filtrePrimClasse={filtrePrimClasse} setFiltrePrimClasse={setFiltrePrimClasse}
          canEdit={canEdit} modS={modS} supS={supS} setForm={setForm} setModal={setModal}
          moisLabel={moisLabel} annee={annee}
        />

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
        saveSalaire={saveSalaire}
      />

      <BonModale
        modal={modal} canCreate={canCreate} canEdit={canEdit}
        form={form} setForm={setForm} setModal={setModal}
        moisModale={moisModale} moisSalaire={moisSalaire} salaires={salaires}
        ensCollege={ensCollege} ensLycee={ensLycee} ensPrimaire={ensPrimaire} personnel={personnel}
        ajBon={ajBon} modBon={modBon} enreg={enreg}
      />
    </div>
  );
}
