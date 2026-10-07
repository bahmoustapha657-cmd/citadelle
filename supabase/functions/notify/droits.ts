// ════════════════════════════════════════════════════════════════════════
//  notify — qui peut déclencher un SMS / WhatsApp vers les tuteurs
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (ni Deno, ni supabase-js) : index.ts l'importe, et
// les tests Node (tests/notify-droits.test.js) le chargent tel quel.
// `supabase functions deploy notify` l'embarque avec index.ts.

// Rôles qui ne sont pas du personnel : AuthGate.jsx les envoie sur leurs
// portails, où rien n'appelle notifierParents.
export const ROLES_HORS_PERSONNEL = ["parent", "enseignant"];

export type Appelant = { role: string | null; ecole_id: string | null; statut: string | null };
export type Refus = { statut: number; error: string };

// null = envoi autorisé. Sinon le refus à renvoyer tel quel.
// - Compte inconnu ou inactif : refus.
// - Superadmin : toute école.
// - Sinon l'appelant doit appartenir à l'école visée (`ecoleId`, résolue
//   depuis le `schoolId` du corps) : les messages partent vers SES tuteurs
//   et lui sont facturés.
// - Personnel seulement : les déclencheurs (absence — onglet Discipline,
//   paiement — Comptabilité, annonce — Messages parents) sont tous dans le
//   shell du personnel. Rôle absent = refus.
export function refusEnvoi(appelant: Appelant | null, ecoleId: string): Refus | null {
  if (!appelant) return { statut: 403, error: "Compte introuvable." };
  if (appelant.statut && appelant.statut !== "Actif") return { statut: 403, error: "Compte inactif." };
  if (appelant.role === "superadmin") return null;
  if (!appelant.ecole_id || appelant.ecole_id !== ecoleId) return { statut: 403, error: "Accès refusé." };
  if (!appelant.role || ROLES_HORS_PERSONNEL.includes(appelant.role)) {
    return { statut: 403, error: "Envoi réservé au personnel." };
  }
  return null;
}
