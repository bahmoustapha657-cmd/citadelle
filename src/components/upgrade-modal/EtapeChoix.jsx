import { PLANS } from "../../contexts/PlanContext";
import { C, S } from "./upgrade-styles";

// Étape 1 : comparaison des plans et choix du Plan Pro.
export function EtapeChoix({ schoolInfo, setEtape, onFermer }) {
  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: C.blueDark }}>
          Passer en Plan Pro
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
          Débloquez toutes les fonctionnalités pour <strong>{schoolInfo?.nom}</strong>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {["gratuit", "pro"].map(p => (
          <div key={p} style={{
            borderRadius: 12, padding: "16px 14px",
            border: `2px solid ${p === "pro" ? C.blue : "#e5e7eb"}`,
            background: p === "pro" ? "#f0f6ff" : "#f9fafb",
          }}>
            <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 13, color: p === "pro" ? C.blue : "#6b7280" }}>
              {p === "pro" ? "⭐ Pro" : "Gratuit"}
            </p>
            <p style={{ margin: "0 0 10px", fontWeight: 900, fontSize: 15, color: C.blueDark }}>
              {p === "pro" ? "500 000 GNF/an" : "0 GNF"}
            </p>
            {PLANS[p].features.map(f => (
              <p key={f} style={{ margin: "4px 0", fontSize: 11, color: "#374151" }}>
                {p === "pro" ? "✅" : "▪"} {f}
              </p>
            ))}
          </div>
        ))}
      </div>

      <button onClick={() => setEtape("instructions")} style={S.btn()}>
        Souscrire au Plan Pro →
      </button>
      <button onClick={onFermer} style={S.btn("#f3f4f6", "#6b7280")}>
        Annuler
      </button>
    </>
  );
}
