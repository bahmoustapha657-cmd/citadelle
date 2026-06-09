import { useTranslation } from "react-i18next";
import { FAQ_ITEMS } from "./landing-content";

export function LandingFaqCta({ onConnexion, onInscription, onDemo }) {
  const { t } = useTranslation();
  return (
    <>
      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "24px 24px 70px", maxWidth: 880, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span className="landing-eyebrow">FAQ</span>
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, marginBottom: 10, letterSpacing: "-0.5px" }}>
          Questions fréquentes sur EduGest
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13.5, marginBottom: 28, lineHeight: 1.7 }}>
          Les réponses les plus utiles pour comprendre le logiciel de gestion scolaire.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {FAQ_ITEMS.map((item, idx) => (
            <details key={item.question} className="landing-faq-item" open={idx === 0}>
              <summary>
                {item.question}
                <span className="landing-faq-chevron" aria-hidden="true">+</span>
              </summary>
              <p className="landing-faq-body">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "30px 24px 80px" }}>
        <div className="landing-final-cta">
          <div className="landing-final-cta-inner">
            <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 900, marginBottom: 14, letterSpacing: "-0.5px" }}>Prêt à digitaliser votre école ?</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14.5, marginBottom: 30, maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
              Lancez un espace propre, simple et adapté à votre réalité terrain. Gratuit pour démarrer, opérationnel en quelques minutes.
            </p>
            <div className="landing-cta-row" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <button className="landing-cta landing-cta-primary" onClick={onInscription} style={{ border: "none", color: "#fff", padding: "16px 42px", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
                Créer mon école gratuitement
              </button>
              <button className="landing-cta landing-cta-secondary" onClick={onDemo} style={{ color: "#fff", padding: "16px 32px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Voir une démo
              </button>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="landing-login-link" onClick={onConnexion}>
                Déjà inscrit ? {t("landing.ctaLogin")} →
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
