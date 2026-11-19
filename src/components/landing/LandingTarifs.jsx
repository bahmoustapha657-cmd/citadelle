import { useTranslation } from "react-i18next";
import { OFFRES } from "./landing-content";
import { prixEcolePublique } from "../../ecole-publique";

// Offre École publique : un public à part (prix fixe quel que soit
// l'effectif), d'où une bande sous la grille plutôt qu'une 5e carte.
const PUBLIQUE = { accent: "#34D399", accentSoft: "rgba(52,211,153,0.14)" };

function BandeEcolePublique({ onInscription }) {
  const { t } = useTranslation();
  const atouts = ["publicFeature1", "publicFeature2", "publicFeature3", "publicFeature4"];
  return (
    <div
      data-offre="publique"
      className="landing-card"
      style={{
        marginTop: 16, borderRadius: 16, padding: "20px 20px", textAlign: "start",
        background: `linear-gradient(90deg, ${PUBLIQUE.accentSoft} 0%, rgba(255,255,255,0.03) 85%)`,
        border: `1px solid ${PUBLIQUE.accent}55`,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 28px",
      }}
    >
      <div style={{ flex: "1 1 220px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: PUBLIQUE.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
          🏛️ {t("plans.publique")}
        </div>
        <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>
          {t("register.public.fixedPrice", { prix: prixEcolePublique() })}
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.5 }}>{t("landing.publicTitle")}</div>
      </div>
      <ul style={{ flex: "2 1 300px", listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
        {atouts.map((cle) => (
          <li key={cle} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
            <span style={{ color: PUBLIQUE.accent, fontWeight: 800, marginTop: 1, flexShrink: 0 }}>✓</span>
            {t(`landing.${cle}`)}
          </li>
        ))}
      </ul>
      <button
        className="landing-cta"
        onClick={onInscription}
        style={{
          flex: "1 1 200px", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer",
          background: `${PUBLIQUE.accent}1A`, border: `1px solid ${PUBLIQUE.accent}55`, color: "#fff", letterSpacing: 0.2, minHeight: 44,
        }}
      >
        {t("landing.publicCta")}
      </button>
    </div>
  );
}

export function LandingTarifs({ onInscription }) {
  return (
    <section id="tarifs" data-landing-reveal className="landing-reveal landing-section" style={{ padding: "58px 24px", maxWidth: 1060, margin: "0 auto", scrollMarginTop: 80 }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span className="landing-eyebrow">Tarifs</span>
      </div>
      <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, marginBottom: 8, letterSpacing: "-0.5px" }}>Tarification transparente</h2>
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13.5, marginBottom: 36, lineHeight: 1.7 }}>Démarrez gratuitement, puis évoluez selon la taille de votre école. Sans engagement.</p>
      <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, alignItems: "stretch" }}>
        {OFFRES.map((plan) => (
          <div
            key={plan.name}
            className="landing-card"
            style={{
              background: plan.highlight
                ? `linear-gradient(180deg, ${plan.accentSoft} 0%, rgba(255,255,255,0.04) 60%)`
                : `linear-gradient(180deg, ${plan.accentSoft} 0%, rgba(255,255,255,0.03) 80%)`,
              border: `1px solid ${plan.highlight ? plan.accent : "rgba(255,255,255,0.10)"}`,
              borderRadius: 16,
              padding: "22px 18px 18px",
              position: "relative",
              boxShadow: plan.highlight ? `0 0 0 1px ${plan.accent}40, 0 14px 40px ${plan.accent}26` : "none",
              transform: plan.highlight ? "translateY(-4px)" : "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {plan.badge && (
              <div style={{
                position: "absolute",
                top: -10,
                right: 14,
                background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
                color: "#0A1628",
                fontSize: 10,
                fontWeight: 900,
                padding: "4px 10px",
                borderRadius: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow: `0 4px 12px ${plan.accent}55`,
              }}>
                ★ {plan.badge}
              </div>
            )}
            <div style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 800,
              color: plan.accent,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}>{plan.name}</div>
            <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{plan.price}</div>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${plan.accent}40, transparent)`, margin: "16px 0" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {plan.features.map((feature) => (
                <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
                  <span style={{ color: plan.accent, fontWeight: 800, marginTop: 1, flexShrink: 0 }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className="landing-cta"
              onClick={onInscription}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                background: plan.highlight
                  ? `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`
                  : `${plan.accent}1A`,
                border: plan.highlight ? "none" : `1px solid ${plan.accent}55`,
                color: plan.highlight ? "#0A1628" : "#fff",
                letterSpacing: 0.2,
                minHeight: 44,
              }}
            >
              Choisir {plan.name}
            </button>
          </div>
        ))}
      </div>
      <BandeEcolePublique onInscription={onInscription} />
    </section>
  );
}
