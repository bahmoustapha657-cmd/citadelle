import { cardStyle } from "./landing-helpers";
import { ARTICLE_LINKS, MODULES, SEO_LINKS, SEO_POINTS } from "./landing-content";

export function LandingSeoSections() {
  return (
    <>
      {/* Bandeau défilant — modules en boucle continue */}
      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee-track">
          {[...MODULES, ...MODULES].map((module, idx) => (
            <span key={`${module.title}-${idx}`} className="landing-marquee-item">
              <span className="landing-marquee-dot" />
              {module.title}
            </span>
          ))}
        </div>
      </div>

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "46px 24px 46px", maxWidth: 980, margin: "0 auto" }}>
        <div className="landing-card" style={{ ...cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Logiciel de gestion scolaire pour primaire, collège et lycée
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>
            EduGest aide les écoles privées à gérer les inscriptions, les notes, les bulletins scolaires, la comptabilité, les salaires, les paiements, les absences et les emplois du temps.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 1.6 }}>
            {SEO_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

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
    </>
  );
}
