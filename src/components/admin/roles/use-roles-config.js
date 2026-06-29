import { useState, useEffect } from "react";
import { getRoleSettingsForSchool } from "../../../constants";
import { apiFetch, getAuthHeaders } from "../../../apiClient";
import { isSupabase } from "../../../backend";
import { syncRoleSettings } from "../../../backend/account-manage-supabase";
import {
  applyModuleToggle,
  applyWriteToggle,
  prepareRoleSettings,
  findDuplicateLogins,
} from "./roles-config-logic";

// État et logique de la configuration des comptes par rôle : formulaire local
// resynchronisé sur schoolInfo.roleSettings, toggles modules/écriture, et la
// sauvegarde (sync_role_settings via /account-manage). Les transformations
// pures du formulaire vivent dans roles-config-logic.js.
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
      [role]: { ...prev[role], [field]: value },
    }));
  };
  const toggleModuleRole = (role, moduleId) =>
    setRoleConfigForm((prev) => applyModuleToggle(prev, role, moduleId));
  const toggleWriteModuleRole = (role, moduleId) =>
    setRoleConfigForm((prev) => applyWriteToggle(prev, role, moduleId));

  const sauvegarderRoles = async () => {
    const preparedRoleSettings = prepareRoleSettings(roleConfigForm);
    const doublons = findDuplicateLogins(preparedRoleSettings);
    if (doublons.length > 0) {
      toast(`Identifiants en doublon : ${doublons.join(", ")}`, "warning");
      return;
    }

    setSavingRoles(true);
    try {
      let data;
      if (isSupabase) {
        // Supabase : on enregistre les réglages (RLS staff). Pas de génération
        // auto de comptes — l'admin crée les comptes manquants manuellement.
        await syncRoleSettings(schoolId, preparedRoleSettings);
        data = { ok: true, roleSettings: preparedRoleSettings };
      } else {
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
        data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Synchronisation des comptes impossible.");
      }
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
