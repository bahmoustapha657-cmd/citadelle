// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de génération automatique des salaires (barrel)
// ══════════════════════════════════════════════════════════════
// Logique pure répartie en modules : génération mensuelle des fiches
// (salary-generation), orchestration "auto-générer" avec messages UI
// (salary-orchestration) et choix de la 5ème semaine (cinquieme-semaine).
// Ce barrel préserve les imports existants.
export { genererSalairesPourMois } from "./salary-actions/salary-generation";
export { appliquerCinquiemeSemaine } from "./salary-actions/cinquieme-semaine";
export {
  verifierFichesPaie,
  formatNomsListe,
  autoGenererSalairesAction,
} from "./salary-actions/salary-orchestration";
