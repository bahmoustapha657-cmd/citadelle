import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { LandingHeroDashboard } from "./LandingHeroDashboard";

export function LandingHero({ onInscription, onDemo }) {
  const { t } = useTranslation();

  // "EduGest — La gestion scolaire moderne" : la marque reste blanche,
  // la proposition de valeur reçoit l'accent dégradé (toutes locales
  // utilisent le même séparateur "—").
  const heroTitle = t("landing.heroTitle");
  const sep = heroTitle.indexOf("—");
  const titleBrand = sep >= 0 ? heroTitle.slice(0, sep).trim() : heroTitle;
  const titleAccent = sep >= 0 ? heroTitle.slice(sep + 1).trim() : "";

  return (
    <section className="landing-hero" style={{ padding: "84px 24px 56px", textAlign: "center", maxWidth: 920, margin: "0 auto", position: "relative" }}>
      <div className="landing-blob" style={{ position: "absolute", top: -40, left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,196,140,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div className="landing-blob" style={{ position: "absolute", top: 60, right: "5%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,140,255,0.09) 0%,transparent 70%)", pointerEvents: "none", animationDelay: "-2.8s" }} />

      <div className="landing-fade-up" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,196,140,0.10)", border: "1px solid rgba(0,196,140,0.28)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
        <span className="landing-ticker" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#2BD9A5", letterSpacing: "0.5px" }}>Conçu pour les écoles d'Afrique de l'Ouest</span>
      </div>

      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <LanguageSwitcher compact />
      </div>

      <h1 className="landing-fade-up landing-delay-1" style={{ position: "relative", fontSize: "clamp(30px,6vw,58px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 18px", letterSpacing: "-1.2px" }}>
        {titleAccent
          ? (
            <>
              {titleBrand}
              <br />
              <span className="landing-title-accent">{titleAccent}</span>
            </>
          )
          : titleBrand}
      </h1>
      <p className="landing-fade-up landing-delay-2" style={{ position: "relative", fontSize: "clamp(14px,2.5vw,18px)", color: "rgba(255,255,255,0.62)", maxWidth: 620, margin: "0 auto 36px", lineHeight: 1.7 }}>
        {t("landing.heroSubtitle")}
      </p>

      <div className="landing-fade-up landing-delay-3 landing-cta-row" style={{ position: "relative", display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="landing-cta landing-cta-primary" onClick={onInscription} style={{ border: "none", color: "#fff", padding: "15px 38px", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
          {t("landing.ctaRegister")}
        </button>
        <button className="landing-cta landing-cta-secondary" onClick={onDemo} style={{ color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {t("landing.ctaDemo")}
        </button>
      </div>

      <div className="landing-fade-up landing-delay-4 landing-trust-row" style={{ position: "relative" }}>
        <span className="landing-trust-item"><span className="landing-trust-check">✓</span> Inscription gratuite</span>
        <span className="landing-trust-item"><span className="landing-trust-check">✓</span> Aucune carte bancaire requise</span>
        <span className="landing-trust-item"><span className="landing-trust-check">✓</span> Opérationnel en 3 minutes</span>
      </div>

      <LandingHeroDashboard />
    </section>
  );
}
