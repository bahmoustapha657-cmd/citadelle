import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { HERO_STATS } from "./landing-content";

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

      <div className="landing-fade-up landing-delay-4 landing-dashboard" style={{ padding: "18px 18px 20px" }}>
        <div className="landing-dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 16, position: "relative" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1.3px", fontWeight: 800 }}>Vue direction</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Votre école, en un seul tableau clair</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="landing-bounce-1" style={{ width: 10, height: 10, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
            <span className="landing-bounce-2" style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
            <span className="landing-bounce-3" style={{ width: 10, height: 10, borderRadius: "50%", background: "#60A5FA", display: "inline-block" }} />
          </div>
        </div>
        <div className="landing-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, position: "relative" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="landing-grid-chip" style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.45)", fontWeight: 800 }}>Aujourd'hui</div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                {HERO_STATS.map((stat, idx) => (
                  <div key={stat.label}>
                    <div className="landing-stat-value" style={{ fontSize: 22, fontWeight: 900, color: "#00C48C", animationDelay: `${700 + idx * 150}ms` }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", lineHeight: 1.5 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="landing-grid-chip" style={{ textAlign: "left", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Notes</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Bulletins prêts</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Paiements</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Suivi instantané</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>EDT</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Vue par section</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="landing-grid-chip" style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Aperçu</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.62)" }}>Encaissements</span>
                  <strong>+ 4 aujourd'hui</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.62)" }}>Salaires</span>
                  <strong>Prêts à imprimer</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.62)" }}>Parents</span>
                  <strong>Portail actif</strong>
                </div>
              </div>
            </div>
            <div className="landing-grid-chip" style={{ textAlign: "left", background: "linear-gradient(135deg, rgba(0,196,140,0.14), rgba(96,165,250,0.09))" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Promesse EduGest</div>
              <div style={{ marginTop: 8, fontSize: 17, fontWeight: 800, lineHeight: 1.4 }}>Moins de confusion, plus de visibilité pour la direction, les enseignants et les parents.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
