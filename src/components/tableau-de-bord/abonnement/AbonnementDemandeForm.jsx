import { C, PLANS } from "../../../constants";

// Formulaire de demande formelle d'abonnement : choix du plan, infos de
// paiement Mobile Money et envoi (ou écran de succès).
export function AbonnementDemandeForm({
  demandePlan, setDemandePlan, demandeForm, setDemandeForm,
  demandeEnvoi, demandeSucces, envoyerDemande,
}) {
  return (
    <div style={{ padding: "20px 24px" }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#374151" }}>Remplissez ce formulaire après avoir effectué votre paiement mobile. L'équipe EduGest validera et activera votre abonnement sous 24h.</p>

      {/* Choix du plan */}
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Plan souhaité</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
        {Object.entries(PLANS).filter(([k]) => k !== "gratuit").map(([key, info]) => (
          <button key={key} onClick={() => setDemandePlan(key)}
            style={{ border: `2px solid ${demandePlan === key ? info.couleur : "#e5e7eb"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left", background: demandePlan === key ? info.bg : "#f9fafb" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: info.couleur }}>{info.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{info.eleveLimit === Infinity ? "Illimité" : `≤ ${info.eleveLimit} élèves`}</div>
          </button>
        ))}
      </div>

      {/* Infos paiement */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Opérateur Mobile Money</label>
          <select value={demandeForm.operateur} onChange={(e) => setDemandeForm((p) => ({ ...p, operateur: e.target.value }))}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            {["Orange Money", "MTN Mobile Money", "Moov Money", "Wave", "Autre"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Numéro de téléphone</label>
          <input value={demandeForm.telephone} onChange={(e) => setDemandeForm((p) => ({ ...p, telephone: e.target.value }))}
            placeholder="Ex. : 621 00 00 00"
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Référence du paiement</label>
        <input value={demandeForm.reference} onChange={(e) => setDemandeForm((p) => ({ ...p, reference: e.target.value }))}
          placeholder="Ex. : TXN-20240418-001"
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
      </div>

      {demandeSucces ? (
        <div style={{ background: "#d1fae5", border: "2px solid #6ee7b7", borderRadius: 12, padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 15, color: "#065f46" }}>Demande envoyée avec succès !</p>
          <p style={{ margin: 0, fontSize: 12, color: "#047857" }}>L'équipe EduGest va vérifier votre paiement et activer votre abonnement <strong>{PLANS[demandePlan]?.label}</strong> sous 24h.</p>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={envoyerDemande}
            disabled={demandeEnvoi || !demandeForm.telephone.trim() || !demandeForm.reference.trim()}
            style={{
              background: `linear-gradient(90deg,${C.blue},${C.green})`, color: "#fff", border: "none", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
              opacity: (demandeEnvoi || !demandeForm.telephone.trim() || !demandeForm.reference.trim()) ? 0.6 : 1,
            }}>
            {demandeEnvoi ? "Envoi en cours…" : "Envoyer la demande"}
          </button>
        </div>
      )}
    </div>
  );
}
