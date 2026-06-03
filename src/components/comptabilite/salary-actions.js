// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de génération automatique des salaires (barrel)
// ══════════════════════════════════════════════════════════════
// Logique pure répartie en deux modules : génération mensuelle des fiches
// (salary-generation) et orchestration "auto-générer" avec messages UI
// (salary-orchestration). Ce barrel préserve les imports existants.
export { genererSalairesPourMois } from "./salary-actions/salary-generation";
export {
  verifierFichesPaie,
  formatNomsListe,
  autoGenererSalairesAction,
} from "./salary-actions/salary-orchestration";
