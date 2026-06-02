import { PLANS } from "../../../constants";

// Badge de plan d'une école (gère l'état "expiré").
export function EcolePlanBadge({ ecole, now }) {
  const p = PLANS[ecole.plan] || PLANS.gratuit;
  const expired = ecole.plan !== "gratuit" && ecole.planExpiry && now > ecole.planExpiry;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <span style={{
        display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800,
        background: expired ? "#fee2e2" : p.bg, color: expired ? "#991b1b" : p.couleur,
      }}>
        {expired ? "Expire" : p.label}
      </span>
      {ecole.plan !== "gratuit" && ecole.planExpiry && (
        <span style={{ fontSize: 9, color: expired ? "#ef4444" : "#9ca3af" }}>
          Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
        </span>
      )}
    </div>
  );
}
