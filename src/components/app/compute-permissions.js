import { C, MODULES, getModulesForRole, getRoleLabelForSchool } from "../../constants";
import { isSupabase } from "../../backend";

// Dérive les modules visibles et les droits d'écriture du rôle courant.
//
// readOnly :
//  - direction (DG) → false partout SAUF compta (le DG supervise, ne saisit
//                     pas la trésorerie ; il contrôle l'ouverture du verrou
//                     via AdminPanel pour autoriser les modifications)
//  - admin          → true SAUF si le DG a coché ce module dans
//                     roleSettings.admin.writeModules (cf. AdminPanel
//                     "Modules visibles" + case ✏️). Aligné sur le
//                     modèle granulaire firestore.rules + JWT claims.
//  - autres rôles   → false (les rules Firestore restreignent leur périmètre métier)
//
// Abonnement expiré (planEstExpire, après la période de grâce) → tout
// l'établissement bascule en lecture seule, quel que soit le rôle (sauf
// superadmin). Le renouvellement reste possible depuis le tableau de bord,
// qui n'est pas soumis à readOnly.
export function computeAppPermissions({ utilisateur, schoolInfo, page, planInfo }) {
  const modulesActifsIds = getModulesForRole(utilisateur.role, schoolInfo);
  const modulesVisibles = MODULES.filter((module) => modulesActifsIds.includes(module.id));
  const role = utilisateur.role;
  const isAdmin = role === "admin";
  const isDirection = role === "direction";
  // estAdmin garde son sens initial pour l'onboarding (admin + direction voient le guide)
  const estAdmin = isAdmin || isDirection;
  const adminCanWriteCurrentPage = isAdmin
    && (schoolInfo?.roleSettings?.admin?.writeModules || []).includes(page);
  const directionReadOnlyCurrentPage = isDirection && page === "compta";
  const abonnementExpire = role !== "superadmin" && !!planInfo?.planEstExpire;
  // École migrée vers la version Supabase : l'ANCIENNE version (backend
  // Firebase) passe en lecture seule avec bannière de redirection. Le drapeau
  // est ignoré côté Supabase (il peut avoir été copié dans les données lors
  // de la migration) et pour le superadmin.
  const basculeSupabase = !isSupabase && role !== "superadmin" && schoolInfo?.basculeSupabase === true;
  const readOnly = basculeSupabase
    || abonnementExpire
    || (isAdmin && !adminCanWriteCurrentPage)
    || directionReadOnlyCurrentPage;
  const couleur2 = schoolInfo.couleur2 || C.green;
  const utilisateurLabel = getRoleLabelForSchool(utilisateur.role, schoolInfo) || utilisateur.label || utilisateur.role;

  return { modulesVisibles, role, estAdmin, readOnly, abonnementExpire, basculeSupabase, couleur2, utilisateurLabel };
}
