import { cardStyle } from "../landing-helpers";
import { SEO_POINTS } from "../landing-content";

// Section d'introduction SEO (présentation générale + points clés).
export function SeoIntroSection() {
  return (
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
  );
}
