import { Trans, useTranslation } from "react-i18next";
import { C, PLANS } from "../../../constants";

// Opérateurs proposés ; la valeur envoyée reste ce libellé (« Autre » compris).
const OPERATEURS = ["Orange Money", "MTN Mobile Money", "Moov Money", "Wave", "Autre"];

// Formulaire de demande formelle d'abonnement : choix du plan, infos de
// paiement Mobile Money et envoi (ou écran de succès).
export function AbonnementDemandeForm({
  demandePlan, setDemandePlan, demandeForm, setDemandeForm,
  demandeEnvoi, demandeSucces, envoyerDemande,
}) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "20px 24px" }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#374151" }}>{t("dashboard.sub.formIntro")}</p>

      {/* Choix du plan */}
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t("dashboard.sub.desiredPlan")}</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
        {Object.entries(PLANS).filter(([k]) => k !== "gratuit").map(([key, info]) => (
          <button key={key} onClick={() => setDemandePlan(key)}
            style={{ border: `2px solid ${demandePlan === key ? info.couleur : "#e5e7eb"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "start", background: demandePlan === key ? info.bg : "#f9fafb" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: info.couleur }}>{t(`plans.${key}`, info.label)}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{info.eleveLimit === Infinity ? t("dashboard.sub.unlimited") : t("dashboard.sub.upToStudents", { count: info.eleveLimit })}</div>
          </button>
        ))}
      </div>

      {/* Infos paiement */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{t("dashboard.sub.operator")}</label>
          <select value={demandeForm.operateur} onChange={(e) => setDemandeForm((p) => ({ ...p, operateur: e.target.value }))}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            {OPERATEURS.map((o) => <option key={o} value={o}>{o === "Autre" ? t("dashboard.sub.other") : o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{t("dashboard.sub.phone")}</label>
          <input value={demandeForm.telephone} onChange={(e) => setDemandeForm((p) => ({ ...p, telephone: e.target.value }))}
            placeholder={t("dashboard.sub.phonePlaceholder")}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{t("dashboard.sub.reference")}</label>
        <input value={demandeForm.reference} onChange={(e) => setDemandeForm((p) => ({ ...p, reference: e.target.value }))}
          placeholder={t("dashboard.sub.referencePlaceholder")}
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
      </div>

      {demandeSucces ? (
        <div style={{ background: "#d1fae5", border: "2px solid #6ee7b7", borderRadius: 12, padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 15, color: "#065f46" }}>{t("dashboard.sub.sentTitle")}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#047857" }}>
            <Trans i18nKey="dashboard.sub.sentBody" values={{ plan: t(`plans.${demandePlan}`, PLANS[demandePlan]?.label) }} components={{ b: <strong /> }} />
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={envoyerDemande}
            disabled={demandeEnvoi || !demandeForm.telephone.trim() || !demandeForm.reference.trim()}
            style={{
              background: `linear-gradient(90deg,${C.blue},${C.green})`, color: "#fff", border: "none", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
              opacity: (demandeEnvoi || !demandeForm.telephone.trim() || !demandeForm.reference.trim()) ? 0.6 : 1,
            }}>
            {demandeEnvoi ? t("dashboard.sub.sending") : t("dashboard.sub.send")}
          </button>
        </div>
      )}
    </div>
  );
}
