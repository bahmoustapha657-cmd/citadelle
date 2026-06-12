import { cardStyle } from "./landing-helpers";
import { ADAPTABILITE } from "./landing-content";

// Section « Adaptabilité » : l'argument de vente central — EduGest
// s'adapte aux besoins individuels de chaque école, pas l'inverse.
export function LandingAdaptabilite() {
  return (
    <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "60px 24px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span className="landing-eyebrow">Adaptabilité</span>
      </div>
      <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3.5vw,30px)", fontWeight: 900, marginBottom: 10, lineHeight: 1.2, letterSpacing: "-0.5px" }}>
        EduGest s'adapte à <span style={{ color: "#00C48C" }}>votre</span> école — pas l'inverse.
      </h2>
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 680, margin: "0 auto 34px", lineHeight: 1.65 }}>
        Chaque établissement a ses classes, ses tarifs, son rythme et ses règles.
        EduGest se configure en quelques minutes pour épouser les vôtres — sans développement, sans compromis.
      </p>
      <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {ADAPTABILITE.map((item) => (
          <div key={item.title} className="landing-card" style={cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{item.title}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
