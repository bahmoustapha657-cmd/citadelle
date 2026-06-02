import { cardStyle } from "../landing-helpers";
import { MODULES } from "../landing-content";

// Grille finale des modules EduGest (titre + description).
export function SeoModulesSection() {
  return (
    <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "0 24px 56px", maxWidth: 980, margin: "0 auto" }}>
      <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {MODULES.map((module) => (
          <div key={module.title} className="landing-card" style={cardStyle()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{module.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{module.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
