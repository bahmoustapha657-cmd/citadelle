// ════════════════════════════════════════════════════════════════════════
//  Espace d'un enseignant indépendant : actions refusées
// ════════════════════════════════════════════════════════════════════════
// Un espace enseignant (ecoles.type_espace = 'enseignant') est gratuit et
// sans limite d'élèves. Il n'a qu'un compte, celui de l'enseignant : ni
// comptes parents, ni comptes pour d'autres personnes, ni liaison de comptes.
// Sans cette règle côté serveur, une école entière pourrait tourner
// gratuitement dans l'espace d'un de ses enseignants — masquer les boutons
// ne suffit pas.
//
// Module SANS dépendance : index.ts l'importe, tests/espace-enseignant.test.js
// le charge tel quel.

export const ACTIONS_FERMEES_ESPACE_ENSEIGNANT = new Set([
  "create", "rattacher_parent", "fusionner_parents", "relier_comptes",
]);

export function refusEspaceEnseignant(
  typeEspace: unknown, action: unknown, roleAppelant: unknown,
): { error: string; status: number } | null {
  if (typeEspace !== "enseignant") return null;
  if (roleAppelant === "superadmin") return null;
  if (!ACTIONS_FERMEES_ESPACE_ENSEIGNANT.has(String(action))) return null;
  return {
    error: "Un espace enseignant n'a qu'un compte, celui de l'enseignant : ni comptes parents, ni comptes pour d'autres personnes.",
    status: 403,
  };
}
