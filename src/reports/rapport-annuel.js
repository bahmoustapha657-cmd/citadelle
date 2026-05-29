// ══════════════════════════════════════════════════════════════
//  Rapport annuel — point d'entrée (Bilan de fin d'année · DG)
// ══════════════════════════════════════════════════════════════
// Consolide effectifs, finances, mensualités, masse salariale et absences
// sur toute l'année scolaire. Les calculs vivent dans
// rapport-annuel/rapport-data.js et le gabarit dans
// rapport-annuel/rapport-html.js. Lancé depuis TableauDeBord.

import { tr } from "./print-helpers.js";
import { computeRapportAnnuel } from "./rapport-annuel/rapport-data.js";
import { buildRapportAnnuelHTML } from "./rapport-annuel/rapport-html.js";

// data = { annee, moisAnnee, eleves[], absences[], notes[], recettes[],
//          depenses[], salaires[], ensC[], ensL[], ensP[] }
export const genererRapportAnnuel = (data = {}, schoolInfo = {}) => {
  const { eleves = [], recettes = [], salaires = [] } = data;
  if (!eleves.length && !recettes.length && !salaires.length) {
    alert(tr("reports.annualReport.noData") || "Pas assez de données pour générer un rapport annuel.");
    return;
  }

  const model = computeRapportAnnuel(data);
  const w = window.open("", "_blank");
  w.document.write(buildRapportAnnuelHTML(model, schoolInfo));
  w.document.close();
};
