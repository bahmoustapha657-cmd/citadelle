import { C, S, CONTACTS_PAIEMENT } from "./upgrade-styles";

// Étape 2 : instructions de paiement Mobile Money.
export function EtapeInstructions({ setEtape }) {
  return (
    <>
      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
        💳 Comment payer
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
        Envoyez <strong>500 000 GNF</strong> via Mobile Money à l'un de ces numéros, puis soumettez votre référence de paiement.
      </p>

      {CONTACTS_PAIEMENT.map(c => (
        <div key={c.operateur} style={S.contact(c.couleur)}>
          <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
            {c.operateur}
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "0.05em", color: c.couleur === "#ffcc00" ? "#a16207" : c.couleur }}>
            {c.numero}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
            Nom : <strong>Groupe Scolaire La Citadelle</strong>
          </p>
        </div>
      ))}

      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
          ℹ️ Après votre paiement, conservez le <strong>code de confirmation</strong> ou la <strong>référence de transaction</strong> envoyé par l'opérateur. Vous en aurez besoin à l'étape suivante.
        </p>
      </div>

      <button onClick={() => setEtape("soumission")} style={{ ...S.btn(), marginTop: 20 }}>
        J'ai payé → Soumettre ma référence
      </button>
      <button onClick={() => setEtape("choix")} style={S.btn("#f3f4f6", "#6b7280")}>
        ← Retour
      </button>
    </>
  );
}
