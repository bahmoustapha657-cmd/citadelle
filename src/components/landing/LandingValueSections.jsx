import { cardStyle } from "./landing-helpers";
import { AVANTAGES, SITUATIONS } from "./landing-content";

export function LandingValueSections() {
  return (
    <>
      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "42px 24px 60px", background: "rgba(0,196,140,0.05)", borderTop: "1px solid rgba(0,196,140,0.12)", borderBottom: "1px solid rgba(0,196,140,0.12)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>Pourquoi choisir EduGest ?</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 34 }}>Un produit terrain, pensé pour les besoins réels des écoles.</p>
          <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {AVANTAGES.map((item) => (
              <div key={item.title} className="landing-card" style={cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)")}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#00C48C", marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "60px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span style={{ display: "inline-block", background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", color: "#00C48C", fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20 }}>Notre obsession</span>
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3.5vw,30px)", fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
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
