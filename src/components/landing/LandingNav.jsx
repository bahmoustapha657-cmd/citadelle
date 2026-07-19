import { useTranslation } from "react-i18next";
import Logo from "../../Logo";

export function LandingNav({ onConnexion, onInscription, onDemo }) {
  const { t } = useTranslation();
  return (
    <nav className="landing-nav" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,15,31,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Logo width={150} height={42} variant="light" />
        <span className="landing-nav-tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>SaaS scolaire</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <a className="landing-nav-btn landing-nav-demo" href="/aide.html" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          ❓ Aide
        </a>
        <button className="landing-nav-btn landing-nav-demo" onClick={onDemo} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Voir une démo
        </button>
        <button className="landing-nav-btn" onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {t("landing.ctaLogin")}
        </button>
        <button className="landing-nav-btn landing-nav-btn-primary" onClick={onInscription} style={{ color: "#fff", padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          Créer mon école
        </button>
      </div>
    </nav>
  );
}
