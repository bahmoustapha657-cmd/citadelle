// ════════════════════════════════════════════════════════════════════════
//  account-manage — qui peut créer / réinitialiser quel compte
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (ni Deno, ni supabase-js) : index.ts l'importe, et
// les tests Node (tests/portail-prescolaire.test.js) le chargent tel quel.
// `supabase functions deploy account-manage` l'embarque avec index.ts.

export const ROLES_SYSTEME = new Set(["direction", "admin", "comptable", "surveillant", "primaire", "college"]);

// Mêmes règles d'autorisation que api/_lib/handlers/account-manage.js, à un
// écart près : la maternelle (« prescolaire »), que ce handler du chemin
// Firebase historique ne connaît pas. Elle relève de la Direction primaire
// (module « Dir. Primaire », section_module() → 'primaire').
// `callerAdminPanel` : le poste de l'appelant écrit-il le module admin_panel ?
// (postes flexibles — permet de gérer les comptes de personnel `staff`).
export function peutGererRole(callerRole: string, targetRole: string, targetSection?: string, callerAdminPanel = false): boolean {
  if (callerRole === "superadmin" || callerRole === "direction") return true;
  // Personne d'autre ne touche à la direction (anti-escalade).
  if (targetRole === "direction") return false;
  if (targetRole === "staff" || ROLES_SYSTEME.has(targetRole)) return callerAdminPanel;
  if (callerRole === "admin") return ["enseignant", "parent"].includes(targetRole);
  if (callerRole === "comptable") return targetRole === "parent";
  if (callerRole === "primaire") return targetRole === "enseignant" && (targetSection === "prescolaire" || targetSection === "primaire");
  if (callerRole === "college") return targetRole === "enseignant" && (targetSection === "college" || targetSection === "lycee");
  // Poste flexible : parents/enseignants gérables avec l'écriture admin_panel.
  if (callerRole === "staff") return callerAdminPanel && ["enseignant", "parent"].includes(targetRole);
  return false;
}
