// Custom claims portés par le JWT Firebase — UNIQUE point de construction.
// Pour l'admin, on injecte adminReadModules + adminWriteModules pour que les
// rules Firestore appliquent le périmètre exact décidé par le DG sans get()
// additionnel. Les autres rôles n'ont pas besoin de ce détail (leur périmètre
// est codé en dur dans les rules).
//
// IMPORTANT : login.js posait avant des claims réduits ({ role, schoolId }),
// écrasant à chaque connexion les modules délégués par le DG — l'admin
// perdait ses droits Firestore au relogin. Tout passage par setRoleClaims
// garantit des claims complets et cohérents.
import { getRoleSettingsMap, ADMIN_WRITABLE_MODULES } from "../../shared/role-config.js";

export async function buildClaimsForRole({ db, role, schoolId, roleSettings = null }) {
  const claims = { role, schoolId };
  if (role !== "admin") return claims;

  let adminConfig = roleSettings?.admin;
  if (!adminConfig) {
    const snap = await db.collection("ecoles").doc(schoolId).get();
    adminConfig = getRoleSettingsMap(snap.exists ? snap.data() : {}).admin;
  }

  const readModules = Array.isArray(adminConfig?.modules) ? adminConfig.modules : [];
  const rawWriteModules = Array.isArray(adminConfig?.writeModules) ? adminConfig.writeModules : [];
  const writeModules = rawWriteModules.filter(
    (moduleId) => ADMIN_WRITABLE_MODULES.includes(moduleId) && readModules.includes(moduleId),
  );

  return {
    ...claims,
    adminReadModules: readModules,
    adminWriteModules: writeModules,
  };
}

export async function setRoleClaims(authAdmin, uid, params) {
  const claims = await buildClaimsForRole(params);
  await authAdmin.setCustomUserClaims(uid, claims);
  return claims;
}
