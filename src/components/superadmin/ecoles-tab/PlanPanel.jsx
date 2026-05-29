import { C, PLANS, PLAN_DUREES } from "../../../constants";

// Panneau inline d'édition du plan d'une école (choix du plan, durée,
// confirmation de downgrade, sauvegarde).
export function PlanPanel({
  planModal, setPlanModal,
  planChoix, setPlanChoix,
  planDuree, setPlanDuree,
  planSaving,
  confirmDowngrade, setConfirmDowngrade,
  msgSucces,
  sauvegarderPlan,
  planPanelRef,
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expirationFutureLabel = new Date(now + planDuree * 86400000).toLocaleDateString("fr-FR");

  return (
    <div ref={planPanelRef} style={{ background: "#fff", border: `2px solid ${PLANS[planChoix]?.couleur || C.blue}`, borderRadius: 14, padding: "24px 28px", marginTop: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.blueDark }}>Gerer le plan - {planModal.nom}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Plan actuel : <strong>{PLANS[planModal.plan]?.label || "Gratuit"}</strong></p>
        </div>
        <button onClick={() => setPlanModal(null)}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#6b7280" }}>
          Fermer
        </button>
      </div>

      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Choisir le plan</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {Object.entries(PLANS).map(([key, info]) => (
          <button key={key} onClick={() => { setPlanChoix(key); setConfirmDowngrade(false); }}
            style={{
              border: `2px solid ${planChoix === key ? info.couleur : "#e5e7eb"}`, borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "left",
              background: planChoix === key ? info.bg : "#f9fafb", transition: "all 0.15s",
            }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: info.couleur }}>{info.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{info.eleveLimit === Infinity ? "Illimite" : `<= ${info.eleveLimit} eleves`}</div>
          </button>
        ))}
      </div>

      {planChoix !== "gratuit" && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Duree de l'abonnement</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PLAN_DUREES.map(d => (
              <button key={d.jours} onClick={() => setPlanDuree(d.jours)}
                style={{
                  border: `2px solid ${planDuree === d.jours ? C.blue : "#e5e7eb"}`, borderRadius: 8, padding: "8px 18px", cursor: "pointer",
                  background: planDuree === d.jours ? "#e0f2fe" : "#fff", color: planDuree === d.jours ? C.blue : "#374151",
                  fontWeight: planDuree === d.jours ? 700 : 400, fontSize: 13,
                }}>
                {d.label}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6b7280" }}>
            Expiration : <strong style={{ color: C.blueDark }}>{expirationFutureLabel}</strong>
          </p>
        </div>
      )}

      {msgSucces && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#065f46", fontWeight: 700 }}>
          {msgSucces}
        </div>
      )}
      {confirmDowngrade && (
        <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 13, color: "#991b1b" }}>Confirmer la desactivation du plan payant ?</p>
          <p style={{ margin: 0, fontSize: 12, color: "#7f1d1d" }}>Cette ecole passera au plan Gratuit (max 50 eleves). Cette action ne peut pas etre annulee automatiquement.</p>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
        <button onClick={() => setPlanModal(null)}
          style={{ background: "#f3f4f6", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, color: "#6b7280", fontSize: 13 }}>
          Annuler
        </button>
        <button onClick={sauvegarderPlan} disabled={planSaving || !!msgSucces}
          style={{
            background: confirmDowngrade ? `linear-gradient(90deg,#ef4444,#dc2626)` : `linear-gradient(90deg,${C.blue},${C.green})`,
            border: "none", color: "#fff", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
            opacity: (planSaving || !!msgSucces) ? 0.7 : 1,
          }}>
          {planSaving ? "Sauvegarde en cours..." : confirmDowngrade ? "Oui, desactiver" : "Confirmer le plan"}
        </button>
      </div>
    </div>
  );
}
