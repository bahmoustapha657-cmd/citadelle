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
// `eleveId` : l'élève concerné quand `cibles` vise les parents (refusParents).
export type Demande = { cibles: string[]; userIds: string[]; tousStaff: boolean; eleveId?: string };
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

// Identifiant d'élève (eleves.id, un uuid) ; "" s'il est absent ou mal formé
// — un uuid invalide ferait échouer la requête PostgREST (22P02).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function nettoyerEleveId(eleveId: unknown): string {
  const id = typeof eleveId === "string" ? eleveId.trim().toLowerCase() : "";
  return UUID.test(id) ? id : "";
}

// Les parents ne se ciblent plus en bloc : les notifications qui les visent
// concernent toutes UN élève (mensualité, absence, message, signalement) et
// ne partent qu'aux comptes rattachés à cet élève (parent_eleves, cf.
// destinataires.ts). La cible « parent » seule servait TOUTES les familles
// de l'école : chacune recevait les paiements et absences des enfants des
// autres. Sans `eleveId` (ancien client), la demande est donc refusée : une
// notification perdue plutôt qu'une fuite.
export function refusParents(demande: Demande): Refus | null {
  if (!demande.cibles.includes("parent") || demande.eleveId) return null;
  return { statut: 400, error: "eleveId requis pour notifier des parents." };
}

// Classe d'un élève, ou d'une ligne enseignant_classes (section, classe).
export type Classe = { section: string | null; classe: string | null };

// L'enseignant ne prévient que les parents d'un élève de SES classes
// (enseignant_classes) : le même périmètre que my_teacher_eleve_ids()
// (teacher-security.sql), qui borne déjà ses signalements (absences_write).
// Sans ce contrôle, il pouvait écrire aux parents de n'importe quel élève de
// l'école. Le personnel n'est pas concerné.
export function refusEnseignantEleve(appelant: Appelant | null, eleve: Classe, classes: Classe[]): Refus | null {
  if (appelant?.role !== "enseignant") return null;
  const sienne = !!eleve.classe
    && classes.some((c) => c.section === eleve.section && c.classe === eleve.classe);
  return sienne ? null : { statut: 403, error: "Élève hors de vos classes." };
}

// null = envoi autorisé. Sinon le refus à renvoyer tel quel.
// - Compte inconnu ou inactif : refus.
// - Superadmin : toute école, toute cible.
// - Sinon l'appelant doit appartenir à l'école visée (`ecoleId`, résolue
//   depuis le `schoolId` du corps).
// - Cibles par rôle / `tousStaff` : personnel seulement — à une exception
//   près, l'enseignant qui prévient les parents d'un élève d'un signalement
//   (portail enseignant, incidents-actions.js : cibles ["parent"] + eleveId ;
//   l'élève doit être de ses classes, cf. refusEnseignantEleve).
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
