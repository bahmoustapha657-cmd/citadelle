import React from "react";
import { C, TOUS_MOIS_LONGS, calcMoisAnnee } from "../../constants";
import ComplianceWidget from "../ComplianceWidget";

// Onglet "Officiel" de ParametresEcole.
// Conformité légale (widget ComplianceWidget réservé direction/admin)
// + sélection du mois de début d'année scolaire. Les anciens champs
// libres ministere/agrement/ire/dpe ont été migrés vers le profil
// légal structuré (`/ecoles/{schoolId}/config/legal`).
export function OfficielTab({
  form,
  chg,
  peutEditerLegal,
  inp,
  lbl,
  sec,
}) {
  return (
    <>
      {/* Conformité légale */}
      {peutEditerLegal && <ComplianceWidget canEdit={true}/>}

      {/* Année scolaire */}
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📅 Année scolaire</h3>
        <div>
          <label style={lbl}>Mois de début de l'année scolaire</label>
          <select style={{...inp,cursor:"pointer"}} value={form.moisDebut} onChange={chg("moisDebut")}>
            {TOUS_MOIS_LONGS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <p style={{margin:"6px 0 0",fontSize:11,color:"#9ca3af"}}>
            L'année scolaire couvre 9 mois à partir du mois choisi. Actuellement&nbsp;:&nbsp;
            <strong style={{color:C.blue}}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
          </p>
        </div>
      </div>
    </>
  );
}
