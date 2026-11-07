import React, { useState } from "react";
import { Btn, Input, Modale } from "../../ui";
import { JOURS_SEMAINE } from "./presences-utils";

// Réglages du calcul de la retenue : jours travaillés de la semaine (pour
// compter les jours ouvrables du mois) et nombre de retards valant une
// demi-journée. Enregistrés dans l'école (RPC maj_reglages_compta).
export function ReglagesPresencesModale({ reglages, fermer, enregistrer }) {
  const [jours, setJours] = useState(reglages.joursTravail);
  const [retards, setRetards] = useState(reglages.retardsParDemiJournee);
  const [enCours, setEnCours] = useState(false);
  const basculer = (n) => setJours((j) => (j.includes(n) ? j.filter((x) => x !== n) : [...j, n].sort((a, b) => a - b)));
  const nbRetards = Number(retards);
  const valide = jours.length > 0 && Number.isInteger(nbRetards) && nbRetards >= 1 && nbRetards <= 20;
  const valider = async () => {
    setEnCours(true);
    try { await enregistrer({ joursTravail: jours, retardsParDemiJournee: nbRetards }); } finally { setEnCours(false); }
  };
  return (
    <Modale titre="⚙️ Réglages des retenues" fermer={fermer}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Jours travaillés</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {JOURS_SEMAINE.map((j) => (
          <label key={j.n} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "4px 10px", border: "1px solid var(--lc-border)", borderRadius: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={jours.includes(j.n)} onChange={() => basculer(j.n)} />{j.court}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 14 }}>
        Retenue d'une journée = salaire du mois ÷ nombre de jours travaillés du mois.
      </div>
      <Input label="Nombre de retards injustifiés = une demi-journée" type="number" min="1" max="20" value={retards} onChange={(e) => setRetards(e.target.value)} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={!valide || enCours} onClick={valider}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
