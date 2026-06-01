import { useTranslation } from "react-i18next";

// Section tableau d'honneur : médailles pour les premiers, cartes par élève.
export function HonneursSection({ acc, c1, c2, honneurs }) {
  const { t } = useTranslation();
  if (!(acc.showHonneurs && honneurs.length > 0)) return null;
  return (
    <div style={{ padding: "60px 24px", background: `linear-gradient(135deg,${c1},${c1}f0)` }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: c2, marginBottom: 8 }}>Mérite & Excellence</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,4vw,32px)", fontWeight: 900, color: "#fff" }}>🏆 {t("publicPage.honorRoll")}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
          {honneurs.map((h, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14, padding: "20px 18px", textAlign: "center",
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%",
                background: `linear-gradient(135deg,${c2},${c2}99)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 12px", boxShadow: `0 4px 14px ${c2}44` }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
              </div>
              <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", marginBottom: 4 }}>
                {h.prenom} {h.nom}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c2, marginBottom: 6 }}>{h.distinction}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{h.classe} · {h.periode}</div>
              {h.observation && <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>{h.observation}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
