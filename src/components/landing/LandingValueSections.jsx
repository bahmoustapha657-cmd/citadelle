import { cardStyle } from "./landing-helpers";
import { AVANTAGES, SITUATIONS } from "./landing-content";

export function LandingValueSections() {
  return (
    <>
      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "52px 24px 64px", background: "rgba(0,196,140,0.05)", borderTop: "1px solid rgba(0,196,140,0.12)", borderBottom: "1px solid rgba(0,196,140,0.12)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <span className="landing-eyebrow">Avantages</span>
          </div>
          <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, marginBottom: 10, letterSpacing: "-0.5px" }}>Pourquoi choisir EduGest ?</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13.5, marginBottom: 36, maxWidth: 540, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>Un produit terrain, pensé pour les besoins réels des écoles.</p>
          <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {AVANTAGES.map((item) => (
              <div key={item.title} className="landing-card" style={cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)")}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{item.title}</div>
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "60px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span className="landing-eyebrow">Notre obsession</span>
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3.5vw,30px)", fontWeight: 900, marginBottom: 10, lineHeight: 1.2, letterSpacing: "-0.5px" }}>
          La transparence comptable. <span style={{ color: "#00C48C" }}>Tout est tracé.</span>
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 700, margin: "0 auto 34px", lineHeight: 1.65 }}>
          EduGest aide la direction à savoir ce qui entre, ce qui sort et qui a fait quoi, sans dépendre d'un cahier ou d'une mémoire incertaine.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {SITUATIONS.map((item) => (
            <div key={item.situation} className="landing-card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px", alignItems: "start" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.5 }}>{item.situation}</div>
              <div style={{ fontSize: 12, color: "rgba(239,68,68,0.85)", lineHeight: 1.6, paddingLeft: 10, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(239,68,68,0.7)", letterSpacing: "1px", marginBottom: 4 }}>AVANT</div>
                {item.avant}
              </div>
              <div style={{ fontSize: 12, color: "rgba(0,196,140,0.95)", lineHeight: 1.6, paddingLeft: 10, borderLeft: "2px solid rgba(0,196,140,0.5)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#00C48C", letterSpacing: "1px", marginBottom: 4 }}>AVEC EDUGEST</div>
                {item.apres}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
