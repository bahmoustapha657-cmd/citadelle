import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import Logo from "../Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  ARTICLE_LINKS,
  AVANTAGES,
  FAQ_ITEMS,
  HERO_STATS,
  MODULES,
  OFFRES,
  SEO_LINKS,
  SEO_POINTS,
  SITUATIONS,
} from "./landing/landing-content";
import { LANDING_STYLES } from "./landing/landing-styles";

function cardStyle(borderColor = "rgba(255,255,255,0.08)", background = "rgba(255,255,255,0.04)") {
  return {
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    padding: "20px 18px",
  };
}

function LandingEduGest({ onConnexion, onInscription, onDemo }) {
  const { t } = useTranslation();
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-landing-reveal]"));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("landing-in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -40px 0px" });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root" style={{ minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff", overflowX: "hidden", position: "relative" }}>
      <GlobalStyles />
      <style>{LANDING_STYLES}</style>

      <nav className="landing-nav" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,15,31,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo width={150} height={42} variant="light" />
          <span className="landing-nav-tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>SaaS scolaire</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onDemo} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Voir une démo
          </button>
          <button onClick={onConnexion} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {t("landing.ctaLogin")}
          </button>
          <button onClick={onInscription} style={{ background: "#00C48C", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Créer mon école
          </button>
        </div>
      </nav>

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

      <section data-landing-reveal className="landing-reveal landing-section" style={{ padding: "58px 24px", maxWidth: 1060, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8 }}>Tarification transparente</h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 36 }}>Démarrez gratuitement, puis évoluez selon la taille de votre école.</p>
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
      </section>

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
    </div>
  );
}

export { LandingEduGest };
