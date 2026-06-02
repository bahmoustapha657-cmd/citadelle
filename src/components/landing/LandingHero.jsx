import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { LandingHeroDashboard } from "./LandingHeroDashboard";

export function LandingHero({ onConnexion, onInscription, onDemo }) {
  const { t } = useTranslation();
  return (
    <section className="landing-hero" style={{ padding: "84px 24px 56px", textAlign: "center", maxWidth: 920, margin: "0 auto", position: "relative" }}>
      <div className="landing-blob" style={{ position: "absolute", top: -40, left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,196,140,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div className="landing-blob" style={{ position: "absolute", top: 60, right: "5%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,140,255,0.09) 0%,transparent 70%)", pointerEvents: "none", animationDelay: "-2.8s" }} />

      {/* Particules flottantes en background — montent du bas */}
      <div className="landing-particles" aria-hidden="true">
        <span className="landing-particle"      style={{ left: "8%",  animationDelay: "0s"   }} />
        <span className="landing-particle alt"  style={{ left: "18%", animationDelay: "1.4s" }} />
        <span className="landing-particle"      style={{ left: "28%", animationDelay: "3s"   }} />
        <span className="landing-particle warm" style={{ left: "42%", animationDelay: "0.7s" }} />
        <span className="landing-particle"      style={{ left: "55%", animationDelay: "2.2s" }} />
        <span className="landing-particle alt"  style={{ left: "68%", animationDelay: "4s"   }} />
        <span className="landing-particle warm" style={{ left: "78%", animationDelay: "1s"   }} />
        <span className="landing-particle"      style={{ left: "90%", animationDelay: "2.7s" }} />
      </div>

      <div className="landing-fade-up landing-badge" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
        <span className="landing-ticker" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#00C48C", letterSpacing: "0.5px" }}>Conçu pour les écoles d'Afrique de l'Ouest</span>
      </div>

      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <LanguageSwitcher compact />
      </div>

      <h1 className="landing-fade-up landing-delay-1" style={{ position: "relative", fontSize: "clamp(30px,6vw,56px)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 18px", letterSpacing: "-1px" }}>
        {t("landing.heroTitle")}
      </h1>
      <p className="landing-fade-up landing-delay-2" style={{ position: "relative", fontSize: "clamp(14px,2.5vw,18px)", color: "rgba(255,255,255,0.62)", maxWidth: 620, margin: "0 auto 36px", lineHeight: 1.7 }}>
        {t("landing.heroSubtitle")}
      </p>

      <div className="landing-fade-up landing-delay-3 landing-cta-row" style={{ position: "relative", display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="landing-cta landing-cta-primary" onClick={onInscription} style={{ border: "none", color: "#fff", padding: "15px 36px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
          {t("landing.ctaRegister")}
        </button>
        <button className="landing-cta landing-cta-secondary" onClick={onDemo} style={{ color: "#fff", padding: "15px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {t("landing.ctaDemo")}
        </button>
        <button className="landing-cta landing-cta-secondary" onClick={onConnexion} style={{ color: "#fff", padding: "15px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {t("landing.ctaLogin")}
        </button>
      </div>
      <p className="landing-fade-up landing-delay-4" style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Inscription gratuite - aucune carte bancaire requise</p>

      <LandingHeroDashboard />
    </section>
  );
}
