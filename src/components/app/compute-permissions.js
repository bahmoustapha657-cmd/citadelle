import { C, MODULES, getModulesForRole, getRoleLabelForSchool } from "../../constants";

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
export function computeAppPermissions({ utilisateur, schoolInfo, page }) {
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
  const readOnly = (isAdmin && !adminCanWriteCurrentPage) || directionReadOnlyCurrentPage;
  const couleur2 = schoolInfo.couleur2 || C.green;
  const utilisateurLabel = getRoleLabelForSchool(utilisateur.role, schoolInfo) || utilisateur.label || utilisateur.role;

  return { modulesVisibles, role, estAdmin, readOnly, couleur2, utilisateurLabel };
}
