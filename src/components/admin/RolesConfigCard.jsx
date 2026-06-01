import { C, ROLE_IDS_PERSONNALISABLES } from "../../constants";
import { Btn, Card } from "../ui";
import { useRolesConfig } from "./roles/use-roles-config";
import { RoleConfigItem } from "./roles/RoleConfigItem";

// Carte de configuration des comptes par rôle : consomme useRolesConfig et rend
// l'en-tête + le bouton d'enregistrement + une carte par rôle personnalisable.
export function RolesConfigCard({ schoolInfo, setSchoolInfo, schoolId, toast, setMdpsInitiaux }) {
  const r = useRolesConfig({ schoolInfo, setSchoolInfo, schoolId, toast, setMdpsInitiaux });
  return (
    <Card style={{ marginBottom: 20, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 14, color: C.blueDark }}>Organisation des comptes par école</p>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Vous personnalisez ici les intitulés, identifiants et modules visibles des comptes système. Les rôles techniques restent fixes pour la sécurité.</p>
        </div>
        <Btn onClick={r.sauvegarderRoles} disabled={r.savingRoles}>{r.savingRoles ? "Enregistrement..." : "Enregistrer la configuration"}</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ROLE_IDS_PERSONNALISABLES.map((role) => (
          <RoleConfigItem
            key={role}
            role={role}
            config={r.roleConfigForm[role] || {}}
            majRoleConfig={r.majRoleConfig}
            toggleModuleRole={r.toggleModuleRole}
            toggleWriteModuleRole={r.toggleWriteModuleRole}
          />
        ))}
      </div>
    </Card>
  );
}
