import { useTranslation } from "react-i18next";

// Section hero du portail public : bannière, logo, titre et appels à l'action.
export function HeroSection({ schoolInfo, acc, c1, c2, onConnexion }) {
  const { t } = useTranslation();
  return (
    <div style={{
      position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center", textAlign: "center",
      overflow: "hidden", padding: "80px 24px 60px",
    }}>
      {/* Fond */}
      {acc.bannerUrl
        ? <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${acc.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "brightness(0.35)" }} />
        : <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg,${c1} 0%,${c1}ee 50%,${c2}44 100%)` }} />
      }
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />

      {/* Contenu hero */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
        {schoolInfo.logo && <img src={schoolInfo.logo} alt="logo"
          style={{ width: 110, height: 110, objectFit: "contain", borderRadius: 20,
            background: "rgba(255,255,255,0.12)", padding: 12, marginBottom: 24,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} />}

        {schoolInfo.ministere && <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700,
          letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
          {schoolInfo.ministere} {schoolInfo.ire && `· ${schoolInfo.ire}`}
        </div>}

        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px,5vw,52px)", fontWeight: 900,
          color: "#fff", letterSpacing: -1, lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          {schoolInfo.nom || "Notre École"}
        </h1>
        <div style={{ color: c2, fontSize: "clamp(12px,2vw,14px)", fontWeight: 700, letterSpacing: 1,
          textTransform: "uppercase", marginBottom: 16 }}>
          {schoolInfo.type || "Établissement scolaire privé"} · {schoolInfo.ville || ""}
        </div>

        {acc.slogan && <p style={{ fontSize: "clamp(14px,2.5vw,20px)", fontWeight: 300,
          color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>
          « {acc.slogan} »
        </p>}
        {schoolInfo.devise && !acc.slogan && <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)",
          marginBottom: 8, fontStyle: "italic" }}>« {schoolInfo.devise} »</p>}

        {acc.texteAccueil && <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)",
          lineHeight: 1.7, maxWidth: 520, margin: "16px auto 0" }}>{acc.texteAccueil}</p>}

        <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onConnexion} style={{
            background: c2, color: "#fff", border: "none",
            padding: "14px 36px", borderRadius: 30, fontSize: 15, fontWeight: 800,
            cursor: "pointer", boxShadow: `0 6px 20px ${c2}55`,
            transition: "transform .15s,box-shadow .15s", letterSpacing: 0.3,
          }}
          onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 10px 28px ${c2}66`; }}
          onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = `0 6px 20px ${c2}55`; }}>
            🔐 {t("auth.loginButton")}
          </button>
          {acc.whatsapp && <a href={`https://wa.me/${acc.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
              padding: "14px 28px", borderRadius: 30, fontSize: 14, fontWeight: 700,
              cursor: "pointer", textDecoration: "none" }}>
            💬 WhatsApp
          </a>}
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.3)", fontSize: 20, animation: "bounce 2s infinite" }}>↓</div>
      <style>{`@keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8px)}}`}</style>
    </div>
  );
}
