import { C } from "./upgrade-styles";

// Étape 4 : demande envoyée, attente de validation par le SuperAdmin.
export function EtapeAttente({ onFermer }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <h3 style={{ margin: "0 0 10px", color: C.blueDark }}>Demande envoyée !</h3>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 20 }}>
        Votre demande a été transmise à notre équipe.<br/>
        Le plan Pro sera activé <strong>sous 24h</strong> après vérification.<br/>
        Cette page se mettra à jour automatiquement.
      </p>
      <div style={{ background: "#f0f6ff", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.blue, marginBottom: 20 }}>
        📞 Pour toute urgence : contactez-nous directement via WhatsApp.
      </div>
      <button onClick={onFermer}
        style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 24px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
        Fermer
      </button>
    </div>
  );
}
