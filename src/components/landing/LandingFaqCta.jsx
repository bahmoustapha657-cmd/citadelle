import { useTranslation } from "react-i18next";
import { cardStyle } from "./landing-helpers";
import { FAQ_ITEMS } from "./landing-content";

export function LandingFaqCta({ onConnexion, onInscription, onDemo }) {
  const { t } = useTranslation();
  return (
    <>
      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "24px 24px 70px", maxWidth: 980, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>
          Questions fréquentes sur EduGest
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 28 }}>
          Les réponses les plus utiles pour comprendre le logiciel de gestion scolaire.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="landing-card" style={cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)")}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800 }}>{item.question}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "54px 24px 80px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 900, marginBottom: 14 }}>Prêt à digitaliser votre école ?</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 30 }}>Lancez un espace propre, simple et adapté à votre réalité terrain.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="landing-cta" onClick={onInscription} style={{ background: "linear-gradient(135deg,#00C48C,#00a876)", border: "none", color: "#fff", padding: "16px 42px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,196,140,0.35)" }}>
            Créer mon école gratuitement
          </button>
          <button className="landing-cta" onClick={onDemo} style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Voir une démo
          </button>
          <button className="landing-cta" onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {t("landing.ctaLogin")}
          </button>
        </div>
      </section>
    </>
  );
}
