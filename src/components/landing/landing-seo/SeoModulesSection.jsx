import { cardStyle } from "../landing-helpers";
import { MODULES } from "../landing-content";

// Grille finale des modules EduGest (icône + titre + description).
export function SeoModulesSection() {
  return (
    <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "0 24px 56px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span className="landing-eyebrow">Modules</span>
      </div>
      <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, marginBottom: 10, letterSpacing: "-0.5px" }}>
        Tout ce qu'il faut, dans un seul outil
      </h2>
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13.5, marginBottom: 32, maxWidth: 560, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
        De l'inscription des élèves aux portails parents, chaque module est intégré et pensé pour fonctionner ensemble.
      </p>
      <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {MODULES.map((module) => (
          <div key={module.title} className="landing-card" style={cardStyle()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{module.icon}</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{module.title}</div>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{module.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
