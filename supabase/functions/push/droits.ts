// ════════════════════════════════════════════════════════════════════════
//  push — qui peut envoyer une notification, et à qui
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (ni Deno, ni supabase-js) : index.ts l'importe, et
// les tests Node (tests/push-droits.test.js) le chargent tel quel.
// `supabase functions deploy push` l'embarque avec index.ts.

// Rôles qui ne sont pas du personnel (même découpage que le ciblage
// `tousStaff` d'index.ts).
export const ROLES_HORS_PERSONNEL = ["parent", "enseignant"];

export type Appelant = { role: string | null; ecole_id: string | null; statut: string | null };
export type Demande = { cibles: string[]; userIds: string[]; tousStaff: boolean };
export type Refus = { statut: number; error: string };

// Cibles nettoyées (rôles ou clés de poste) : elles sont interpolées dans le
// filtre PostgREST `role.in.(…)`, d'où la liste blanche de caractères.
export function nettoyerCibles(cibles: unknown): string[] {
  if (!Array.isArray(cibles)) return [];
  return cibles.map((c) => String(c).replace(/[^a-z0-9._-]/gi, "")).filter(Boolean);
}

export function nettoyerUserIds(userIds: unknown): string[] {
  if (!Array.isArray(userIds)) return [];
  return userIds.map((u) => String(u).replace(/[^a-f0-9-]/gi, "")).filter(Boolean);
}

// null = envoi autorisé. Sinon le refus à renvoyer tel quel.
// - Compte inconnu ou inactif : refus.
// - Superadmin : toute école, toute cible.
// - Sinon l'appelant doit appartenir à l'école visée (`ecoleId`, résolue
//   depuis le `schoolId` du corps).
// - Cibles par rôle / `tousStaff` : personnel seulement — à une exception
//   près, l'enseignant qui prévient les parents d'un signalement (portail
//   enseignant, incidents-actions.js : cibles ["parent"]).
// - `userIds` : tout membre de l'école (messagerie interne, parents et
//   enseignants compris) ; index.ts ne lit que les abonnements de CETTE école.
export function refusEnvoi(appelant: Appelant | null, ecoleId: string, demande: Demande): Refus | null {
  if (!appelant) return { statut: 403, error: "Compte introuvable." };
  if (appelant.statut && appelant.statut !== "Actif") return { statut: 403, error: "Compte inactif." };
  if (appelant.role === "superadmin") return null;
  if (!appelant.ecole_id || appelant.ecole_id !== ecoleId) return { statut: 403, error: "Accès refusé." };

  const parRole = demande.tousStaff || demande.cibles.length > 0;
  if (!parRole) return null;
  const role = appelant.role || "";
  if (!ROLES_HORS_PERSONNEL.includes(role)) return null;
  const enseignantVersParents = role === "enseignant" && !demande.tousStaff
    && demande.cibles.every((c) => c === "parent");
  if (enseignantVersParents) return null;
  return { statut: 403, error: "Envoi réservé au personnel." };
}
