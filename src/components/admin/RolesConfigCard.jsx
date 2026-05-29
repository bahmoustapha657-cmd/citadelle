import React, { useState, useEffect } from "react";
import {
  ACCES,
  ADMIN_WRITABLE_MODULES,
  C,
  ROLE_IDS_PERSONNALISABLES,
  getModuleOptionsForRole,
  getRoleSettingsForSchool,
  normalizeRoleLogin,
} from "../../constants";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { Badge, Btn, Card } from "../ui";
import { compteColor } from "./admin-helpers";

export function RolesConfigCard({ schoolInfo, setSchoolInfo, schoolId, toast, setMdpsInitiaux }) {
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
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await apiFetch("/account-manage", {
        method:"POST",
        headers,
        body:JSON.stringify({
          action:"sync_role_settings",
          schoolId,
          roleSettings: preparedRoleSettings,
        }),
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok||!data.ok) throw new Error(data.error||"Synchronisation des comptes impossible.");
      const roleSettings = getRoleSettingsForSchool(data.roleSettings || preparedRoleSettings);
      setRoleConfigForm(roleSettings);
      setSchoolInfo((prev) => ({ ...prev, roleSettings }));
      if(Array.isArray(data.generatedAccounts) && data.generatedAccounts.length > 0){
        setMdpsInitiaux(data.generatedAccounts);
      }
      toast("Configuration des comptes mise à jour.", "success");
    } catch(e) {
      toast(e.message || "Erreur de configuration des comptes.", "error");
    } finally {
      setSavingRoles(false);
    }
  };

  return (
    <Card style={{marginBottom:20,padding:"18px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <div>
          <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Organisation des comptes par école</p>
          <p style={{margin:0,fontSize:12,color:"#6b7280"}}>Vous personnalisez ici les intitulés, identifiants et modules visibles des comptes système. Les rôles techniques restent fixes pour la sécurité.</p>
        </div>
        <Btn onClick={sauvegarderRoles} disabled={savingRoles}>{savingRoles?"Enregistrement...":"Enregistrer la configuration"}</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {ROLE_IDS_PERSONNALISABLES.map((role) => {
          const config = roleConfigForm[role] || {};
          const modulesOptions = getModuleOptionsForRole(role);
          return (
            <div key={role} style={{border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px",background:"#f8fafc"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Badge color={compteColor(role)}>{config.label || role}</Badge>
                  <span style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>role: {role}</span>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:config.active!==false?C.greenDk:"#9ca3af",cursor:role==="direction"?"default":"pointer"}}>
                  <input type="checkbox" checked={config.active!==false} disabled={role==="direction"} onChange={(event)=>majRoleConfig(role,"active",event.target.checked)} />
                  {role==="direction"?"Toujours actif":"Compte actif"}
                </label>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Label affiché</label>
                  <input value={config.label||""} onChange={(event)=>majRoleConfig(role,"label",event.target.value)} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Nom du compte</label>
                  <input value={config.nom||""} onChange={(event)=>majRoleConfig(role,"nom",event.target.value)} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Identifiant</label>
                  <input value={config.login||""} onChange={(event)=>majRoleConfig(role,"login",normalizeRoleLogin(event.target.value, role))} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box",fontFamily:"monospace"}} />
                </div>
              </div>
              <div style={{marginTop:12}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:C.blueDark}}>
                  Modules visibles
                  {role === "admin" && <span style={{marginLeft:8,fontWeight:500,color:"#64748b"}}>(cochez ✏️ pour autoriser l'écriture)</span>}
                </p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {modulesOptions.map((moduleOption) => {
                    const isVisible = (config.modules||[]).includes(moduleOption.id);
                    const canWrite = role === "admin" && ADMIN_WRITABLE_MODULES.includes(moduleOption.id);
                    const writeChecked = canWrite && (config.writeModules||[]).includes(moduleOption.id);
                    return (
                      <div key={moduleOption.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,border:"1px solid #dbe4ee",background:"#fff",fontSize:12,color:C.blueDark}}>
                        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                          <input type="checkbox" checked={isVisible} onChange={()=>toggleModuleRole(role,moduleOption.id)} />
                          <span>{moduleOption.label}</span>
                        </label>
                        {canWrite && (
                          <label
                            title={isVisible ? "Autoriser l'écriture sur ce module" : "Activez d'abord le module pour autoriser l'écriture"}
                            style={{display:"flex",alignItems:"center",gap:3,paddingLeft:6,borderLeft:"1px solid #e5e7eb",cursor:isVisible?"pointer":"not-allowed",opacity:isVisible?1:0.4}}>
                            <input type="checkbox" disabled={!isVisible} checked={writeChecked} onChange={()=>toggleWriteModuleRole(role,moduleOption.id)} />
                            <span style={{fontSize:11,fontWeight:700,color:writeChecked?C.greenDk:"#94a3b8"}}>✏️</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                {role === "admin" && (
                  <p style={{margin:"8px 0 0",fontSize:11,color:"#64748b",lineHeight:1.5}}>
                    🔒 <strong>Modules système</strong> (toujours en lecture seule pour l'administrateur, même si cochés) : Comptabilité, Paramètres, Fondation, Gestion Accès, Historique. Garde-fou anti-auto-promotion et traçabilité.
                  </p>
                )}
                {role !== "admin" && ACCES[role]?.includes("admin_panel") && (
                  <p style={{margin:"8px 0 0",fontSize:11,color:"#9ca3af"}}>Les accès sensibles indispensables sont conservés automatiquement pour ce rôle.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
