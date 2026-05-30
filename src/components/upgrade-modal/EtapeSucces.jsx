import { S } from "./upgrade-styles";

// Étape 5 : plan Pro activé.
export function EtapeSucces({ schoolInfo, onFermer }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
      <h3 style={{ margin: "0 0 8px", color: "#065f46", fontSize: 20 }}>Plan Pro activé !</h3>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        Toutes les fonctionnalités sont maintenant débloquées pour <strong>{schoolInfo?.nom}</strong>.
      </p>
      <button onClick={onFermer} style={S.btn()}>
        Commencer à utiliser le Plan Pro →
      </button>
    </div>
  );
}
