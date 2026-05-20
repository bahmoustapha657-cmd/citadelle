// ══════════════════════════════════════════════════════════════
//  Reports — point d'entrée (barrel)
// ══════════════════════════════════════════════════════════════
// Le fichier monolithique de 1883 LOC a été éclaté en modules
// thématiques sous `src/reports/` (refactor 2026-05-20). Ce barrel
// conserve les imports historiques (`import { X } from "../reports"`)
// inchangés. Pour ajouter une nouvelle fonction d'impression :
// 1. Créer / éditer le sous-module concerné dans `src/reports/`.
// 2. Re-exporter ici si l'API doit rester sur le chemin `./reports`.

export {
  // Constantes & helpers partagés
  MINISTERE_DEFAUT,
  PRINT_NOTICE,
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  watermarkHtml,
} from "./reports/print-helpers.js";

export { getRecuTotals, imprimerRecu } from "./reports/recus.js";
export { imprimerCartesEleves, imprimerListeClasse } from "./reports/cartes-listes.js";
export { genererRapportMensuel } from "./reports/rapport-mensuel.js";
export { genererRapportAnnuel } from "./reports/rapport-annuel.js";
export { exportExcel, telechargerExcel } from "./reports/excel.js";
export { imprimerAttestation } from "./reports/attestation.js";
export {
  imprimerBulletin,
  imprimerBulletinsGroupes,
  imprimerFicheCompositions,
} from "./reports/bulletins.js";
export {
  imprimerCertificatRadiation,
  imprimerOrdreMutation,
} from "./reports/mutation-radiation.js";
export { imprimerLivret } from "./reports/livret.js";
