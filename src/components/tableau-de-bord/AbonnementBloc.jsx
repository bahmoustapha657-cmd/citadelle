import { C, PLANS } from "../../constants";
import { AbonnementBanniere } from "./abonnement/AbonnementBanniere";
import { AbonnementDemandeForm } from "./abonnement/AbonnementDemandeForm";

export function AbonnementBloc({
  planInfo, schoolInfo,
  demandeOuverte, setDemandeOuverte, demandePlan, setDemandePlan,
  demandeForm, setDemandeForm, demandeEnvoi, demandeSucces, envoyerDemande,
}) {
  if (!planInfo) {
    return null;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <AbonnementBanniere planInfo={planInfo} />

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

        {demandeOuverte && (
          <AbonnementDemandeForm
            demandePlan={demandePlan} setDemandePlan={setDemandePlan}
            demandeForm={demandeForm} setDemandeForm={setDemandeForm}
            demandeEnvoi={demandeEnvoi} demandeSucces={demandeSucces} envoyerDemande={envoyerDemande}
          />
        )}
      </div>
    </div>
  );
}
