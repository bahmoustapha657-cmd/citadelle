import { cardStyle } from "../landing-helpers";
import { SEO_LINKS } from "../landing-content";

// Section "Ressources utiles" : grille de liens titre + description.
export function SeoRessourcesSection() {
  return (
    <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
      <div className="landing-card" style={{ ...cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)") }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
          Ressources utiles sur EduGest
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Ces pages détaillées permettent de mieux présenter les usages d'EduGest et les besoins des écoles auxquelles la plateforme s'adresse.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {SEO_LINKS.map((item) => (
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
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#00C48C", marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.65 }}>{item.description}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
