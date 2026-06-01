import { Card } from "./ui";
import { useComplianceWidget } from "./compliance/use-compliance-widget";
import { ComplianceCard } from "./compliance/ComplianceCard";
import { LegalEditModal } from "./compliance/LegalEditModal";

// Widget Conformité affiché sur le tableau de bord directeur. Consomme le hook
// useComplianceWidget et rend la carte en lecture seule + la modale d'édition.
//
// Props :
//  - profile?: LegalProfile — override explicite (utile en preview / tests)
//  - canEdit?: boolean — masque le bouton "Modifier" si false
export default function ComplianceWidget({ profile: profileOverride, canEdit = true }) {
  const c = useComplianceWidget(profileOverride);
  return (
    <Card style={{ marginBottom: 16 }}>
      <ComplianceCard
        profile={c.profile}
        status={c.status}
        days={c.days}
        expDate={c.expDate}
        canEdit={canEdit}
        onEdit={c.openModal}
      />
      {c.modalOpen && (
        <LegalEditModal
          profile={c.profile}
          schoolInfo={c.schoolInfo}
          saving={c.saving}
          error={c.error}
          onClose={c.closeModal}
          onSave={c.save}
        />
      )}
    </Card>
  );
}
