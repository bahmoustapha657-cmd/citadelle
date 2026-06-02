import { cardStyle } from "../landing-helpers";
import { ARTICLE_LINKS } from "../landing-content";

// Section "Articles conseils" : grille de liens (titre seul).
export function SeoArticlesSection() {
  return (
    <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
      <div className="landing-card" style={{ ...cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)") }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
          Articles conseils pour les écoles
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Ces articles répondent à des questions très fréquentes des directions et montrent plus clairement l'expertise d'EduGest sur la gestion scolaire.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
          {ARTICLE_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="landing-link-card"
              style={{
                display: "block",
                textDecoration: "none",
                color: "#fff",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "18px 16px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {item.title}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
