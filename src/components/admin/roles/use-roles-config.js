import { useState, useEffect } from "react";
import {
  ADMIN_WRITABLE_MODULES,
  ROLE_IDS_PERSONNALISABLES,
  getRoleSettingsForSchool,
  normalizeRoleLogin,
} from "../../../constants";
import { apiFetch, getAuthHeaders } from "../../../apiClient";

// État et logique de la configuration des comptes par rôle : formulaire local
// resynchronisé sur schoolInfo.roleSettings, toggles modules/écriture, et la
// sauvegarde (sync_role_settings via /account-manage).
export function useRolesConfig({ schoolInfo, setSchoolInfo, schoolId, toast, setMdpsInitiaux }) {
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleConfigForm, setRoleConfigForm] = useState(() => getRoleSettingsForSchool(schoolInfo));

  const schoolRoleSettings = schoolInfo.roleSettings;
  useEffect(() => {
    setRoleConfigForm(getRoleSettingsForSchool({ roleSettings: schoolRoleSettings }));
  }, [schoolRoleSettings]);

  const majRoleConfig = (role, field, value) => {
    setRoleConfigForm((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
  };
  const toggleModuleRole = (role, moduleId) => {
    setRoleConfigForm((prev) => {
      const currentModules = prev[role]?.modules || [];
      const willInclude = !currentModules.includes(moduleId);
      const nextModules = willInclude
        ? [...currentModules, moduleId]
        : currentModules.filter((currentModuleId) => currentModuleId !== moduleId);
      // Si on retire la lecture, on retire aussi l'ecriture (pas d'ecriture
      // sans lecture). Pour le role admin uniquement, writeModules existe.
      const currentWrite = prev[role]?.writeModules || [];
      const nextWrite = willInclude
        ? currentWrite
        : currentWrite.filter((currentModuleId) => currentModuleId !== moduleId);
      return {
        ...prev,
        [role]: {
          ...prev[role],
          modules: nextModules,
          writeModules: nextWrite,
        },
      };
    });
  };

  // Toggle ecriture pour un module de l'admin. N'a de sens que pour role==="admin"
  // ET module dans ADMIN_WRITABLE_MODULES (compta/admin_panel/parametres/fondation/
  // historique restent en lecture seule par construction).
  const toggleWriteModuleRole = (role, moduleId) => {
    if (role !== "admin" || !ADMIN_WRITABLE_MODULES.includes(moduleId)) return;
    setRoleConfigForm((prev) => {
      const currentWrite = prev[role]?.writeModules || [];
      const currentModules = prev[role]?.modules || [];
      // Garde-fou : impossible d'autoriser l'ecriture sur un module pas visible.
      if (!currentModules.includes(moduleId)) return prev;
      const nextWrite = currentWrite.includes(moduleId)
        ? currentWrite.filter((currentModuleId) => currentModuleId !== moduleId)
        : [...currentWrite, moduleId];
      return {
        ...prev,
        [role]: {
          ...prev[role],
          writeModules: nextWrite,
        },
      };
    });
  };

  const sauvegarderRoles = async () => {
    const preparedRoleSettings = ROLE_IDS_PERSONNALISABLES.reduce((accumulator, role) => {
      const config = roleConfigForm[role];
      accumulator[role] = {
        ...config,
        login: normalizeRoleLogin(config?.login, role),
      };
      return accumulator;
    }, {});

    const loginsActifs = Object.values(preparedRoleSettings)
      .filter((config) => config.active !== false)
      .map((config) => config.login);
    const doublons = loginsActifs.filter((login, index) => loginsActifs.indexOf(login) !== index);
    if (doublons.length > 0) {
      toast(`Identifiants en doublon : ${[...new Set(doublons)].join(", ")}`, "warning");
      return;
    }

    setSavingRoles(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/account-manage", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "sync_role_settings",
          schoolId,
          roleSettings: preparedRoleSettings,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Synchronisation des comptes impossible.");
      const roleSettings = getRoleSettingsForSchool(data.roleSettings || preparedRoleSettings);
      setRoleConfigForm(roleSettings);
      setSchoolInfo((prev) => ({ ...prev, roleSettings }));
      if (Array.isArray(data.generatedAccounts) && data.generatedAccounts.length > 0) {
        setMdpsInitiaux(data.generatedAccounts);
      }
      toast("Configuration des comptes mise à jour.", "success");
    } catch (e) {
      toast(e.message || "Erreur de configuration des comptes.", "error");
    } finally {
      setSavingRoles(false);
    }
  };

  return { savingRoles, roleConfigForm, majRoleConfig, toggleModuleRole, toggleWriteModuleRole, sauvegarderRoles };
}
