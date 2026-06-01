import { useTranslation } from "react-i18next";

// Section annonces publiques : grille de cartes (importantes mises en avant).
export function AnnoncesSection({ acc, c1, c2, annoncesPub }) {
  const { t } = useTranslation();
  if (!(acc.showAnnonces && annoncesPub.length > 0)) return null;
  return (
    <div style={{ padding: "60px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: c2, marginBottom: 8 }}>{t("publicPage.announcements")}</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,4vw,32px)", fontWeight: 900, color: c1 }}>{t("publicPage.announcements")}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {annoncesPub.map((an, i) => (
            <div key={i} style={{
              background: an.important ? "linear-gradient(135deg,#fefce8,#fff)" : "#f8fafc",
              border: `1px solid ${an.important ? "#fcd34d" : "#e2e8f0"}`,
              borderTop: `4px solid ${an.important ? "#f59e0b" : c1}`,
              borderRadius: 12, padding: "20px 22px",
            }}>
              {an.important && <span style={{ display: "inline-block", background: "#fef3c7", color: "#d97706", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 8, marginBottom: 10, letterSpacing: 1 }}>📌 IMPORTANT</span>}
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800, color: c1, lineHeight: 1.3 }}>{an.titre}</h3>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{an.corps}</p>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(an.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
