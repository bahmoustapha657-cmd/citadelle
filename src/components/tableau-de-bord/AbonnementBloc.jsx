import { C, PLANS } from "../../constants";

export function AbonnementBloc({
  planInfo, schoolInfo,
  demandeOuverte, setDemandeOuverte, demandePlan, setDemandePlan,
  demandeForm, setDemandeForm, demandeEnvoi, demandeSucces, envoyerDemande,
}) {
  if (!planInfo) {
    return null;
  }

  const banniereVisible = planInfo.planEstExpire || planInfo.enPeriodeGrace
    || (planInfo.joursRestants !== null && planInfo.joursRestants <= 30)
    || (planInfo.planCourant === "gratuit" && planInfo.totalElevesActifs >= 40);

  return (
    <div style={{ marginTop: 24 }}>
      {/* Bannière expiration / période de grâce / limite */}
      {banniereVisible && (
        <div style={{
          background: planInfo.planEstExpire ? "#fee2e2" : planInfo.enPeriodeGrace ? "#fff7ed" : planInfo.joursRestants <= 7 ? "#fef2f2" : "#fef3c7",
          border: `1px solid ${planInfo.planEstExpire ? "#fca5a5" : planInfo.enPeriodeGrace ? "#fdba74" : planInfo.joursRestants <= 7 ? "#fca5a5" : "#fcd34d"}`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 22 }}>
            {planInfo.planEstExpire ? "🔴" : planInfo.enPeriodeGrace ? "🟠" : planInfo.joursRestants <= 7 ? "🔴" : "🟡"}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: planInfo.planEstExpire ? "#991b1b" : planInfo.enPeriodeGrace ? "#c2410c" : "#92400e" }}>
              {planInfo.planEstExpire
                ? "Abonnement expiré — accès limité à 50 élèves"
                : planInfo.enPeriodeGrace
                  ? `Période de grâce — encore ${planInfo.joursGrace} jour(s) d'accès complet`
                  : planInfo.joursRestants !== null && planInfo.joursRestants <= 30
                    ? `Abonnement ${planInfo.planLabel} expire dans ${planInfo.joursRestants} jour(s)`
                    : `Plan Gratuit : ${planInfo.totalElevesActifs}/50 élèves — bientôt à la limite`}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
              {planInfo.enPeriodeGrace
                ? "Renouvelez votre abonnement avant la fin de la période de grâce pour ne pas perdre l'accès."
                : "Souscrivez un abonnement pour continuer à inscrire des élèves sans limite."}
            </p>
          </div>
        </div>
      )}

      {/* Succès demande envoyée */}
      {demandeSucces && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "12px 18px", marginBottom: 16, fontSize: 13, color: "#065f46", fontWeight: 700 }}>
          ✅ Demande envoyée ! L'équipe EduGest va traiter votre demande et activer votre abonnement.
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,32,80,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.blueDark }}>
              Abonnement — Plan <span style={{ color: PLANS[planInfo.planCourant]?.couleur || C.blue }}>{planInfo.planLabel}</span>
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
              {planInfo.planCourant === "gratuit"
                ? `${planInfo.totalElevesActifs}/50 élèves actifs — gratuit jusqu'à 50`
                : planInfo.planEstExpire
                  ? "Expiré — limité à 50 élèves"
                  : planInfo.enPeriodeGrace
                    ? `Période de grâce — ${planInfo.joursGrace} jour(s) restant(s)`
                    : `${planInfo.totalElevesActifs} élèves actifs · expire le ${new Date(planInfo.planExpiry).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* Contact WhatsApp */}
            <a href={`https://wa.me/+224627738579?text=Bonjour%2C%20je%20souhaite%20souscrire%20un%20abonnement%20EduGest%20pour%20l%27%C3%A9cole%20%22${encodeURIComponent(schoolInfo.nom || "")}%22`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#15803d", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer" }}>
              <span>💬</span> WhatsApp
            </a>
            {/* Contact Email */}
            <a href={`https://mail.google.com/mail/?view=cm&to=edugest26@gmail.com&su=${encodeURIComponent("Demande abonnement — " + (schoolInfo.nom || ""))}&body=${encodeURIComponent("Bonjour,\nJe souhaite souscrire un abonnement EduGest pour mon école.\n\nÉcole : " + (schoolInfo.nom || "") + "\n")}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#ede9fe", color: "#6d28d9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer" }}>
              <span>✉️</span> Email
            </a>
            {/* Bouton demande formelle */}
            <button onClick={() => setDemandeOuverte((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(90deg,${C.blue},${C.green})`, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {demandeOuverte ? "▲ Fermer" : "📋 Demande formelle"}
            </button>
          </div>
        </div>

        {/* Formulaire de demande */}
        {demandeOuverte && (
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
        )}
      </div>
    </div>
  );
}
