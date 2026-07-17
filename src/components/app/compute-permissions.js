import { C, MODULES, getModulesForRole, getRoleLabelForSchool } from "../../constants";
import { isSupabase } from "../../backend";
import {
  ROLES_HORS_POSTES,
  getSessionPermissions,
  hasRead,
  hasWrite,
} from "../../../shared/postes-config.js";

// Dérive les modules visibles et les droits d'écriture du compte courant.
//
// Mode Supabase (postes flexibles) : la carte de permissions du poste
// { module: "lecture"|"ecriture" } pilote tout — modules visibles = lecture,
// readOnly = pas d'écriture sur la page courante. Les comptes legacy (sans
// poste) retombent sur les capacités historiques de leur rôle via
// getSessionPermissions. Exceptions conservées :
//  - direction → toujours tous droits SAUF compta (le DG supervise, ne saisit
//    pas la trésorerie ; il contrôle l'ouverture du verrou via AdminPanel)
//  - superadmin / enseignant / parent → hors postes (portails dédiés)
//
// Mode Firebase (legacy, gelé) : comportement historique inchangé —
// direction writable sauf compta, admin readOnly sauf writeModules, autres
// rôles arbitrés par les rules Firestore.
//
// Abonnement expiré (planEstExpire, après la période de grâce) → tout
// l'établissement bascule en lecture seule, quel que soit le rôle (sauf
// superadmin). Le renouvellement reste possible depuis le tableau de bord,
// qui n'est pas soumis à readOnly.
export function computeAppPermissions({ utilisateur, schoolInfo, page, planInfo }) {
  const role = utilisateur.role;
  const isAdmin = role === "admin";
  const isDirection = role === "direction";
  // estAdmin garde son sens initial pour l'onboarding (admin + direction voient le guide)
  const estAdmin = isAdmin || isDirection;
  const surPostes = isSupabase && !ROLES_HORS_POSTES.includes(role);

  const permissions = surPostes ? getSessionPermissions(utilisateur, schoolInfo) : null;
  const modulesActifsIds = surPostes ? null : getModulesForRole(role, schoolInfo);
  const modulesVisibles = MODULES.filter((module) => (surPostes
    ? hasRead(permissions, module.id)
    : modulesActifsIds.includes(module.id)));

  const adminCanWriteCurrentPage = isAdmin
    && (schoolInfo?.roleSettings?.admin?.writeModules || []).includes(page);
  const directionReadOnlyCurrentPage = isDirection && page === "compta";
  const abonnementExpire = role !== "superadmin" && !!planInfo?.planEstExpire;
  // École migrée vers la version Supabase : l'ANCIENNE version (backend
  // Firebase) passe en lecture seule avec bannière de redirection. Le drapeau
  // est ignoré côté Supabase (il peut avoir été copié dans les données lors
  // de la migration) et pour le superadmin.
  const basculeSupabase = !isSupabase && role !== "superadmin" && schoolInfo?.basculeSupabase === true;
  const pageSansEcriture = surPostes
    ? (!isDirection && !hasWrite(permissions, page))
    : (isAdmin && !adminCanWriteCurrentPage);
  const readOnly = basculeSupabase
    || abonnementExpire
    || pageSansEcriture
    || directionReadOnlyCurrentPage;
  const couleur2 = schoolInfo.couleur2 || C.green;
  const utilisateurLabel = utilisateur.posteLabel
    || getRoleLabelForSchool(utilisateur.role, schoolInfo) || utilisateur.label || utilisateur.role;
  // Clé de comportement UI : postes système et rôles legacy partagent les
  // mêmes clés ('comptable', 'surveillant'…) ; un poste personnalisé porte la
  // sienne. Sert aux quelques cas particuliers par métier (onglets
  // surveillant, verrous…).
  const roleEffectif = utilisateur.posteCle || role;

  return {
    modulesVisibles, permissions, role, roleEffectif, estAdmin, readOnly,
    abonnementExpire, basculeSupabase, couleur2, utilisateurLabel,
  };
}
