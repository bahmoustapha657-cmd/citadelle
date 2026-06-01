import { useTranslation } from "react-i18next";

// Section contact : téléphone, WhatsApp, email, Facebook et adresse.
export function ContactSection({ acc, c1, c2 }) {
  const { t } = useTranslation();
  if (!(acc.showContact && (acc.telephone || acc.email || acc.adresse || acc.facebook))) return null;
  return (
    <div style={{ padding: "60px 24px", background: `linear-gradient(135deg,#0A1628,${c1})` }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: c2, marginBottom: 8 }}>Nous trouver</div>
        <h2 style={{ margin: "0 0 32px", fontSize: "clamp(20px,4vw,30px)", fontWeight: 900, color: "#fff" }}>📍 {t("publicPage.contact")}</h2>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {acc.telephone && <a href={`tel:${acc.telephone}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 22px", textDecoration: "none", color: "#fff" }}>
            <span style={{ fontSize: 20 }}>📞</span>
            <div style={{ textAlign: "left" }}><div style={{ fontSize: 10, color: c2, fontWeight: 700, letterSpacing: 1 }}>TÉLÉPHONE</div><div style={{ fontSize: 13, fontWeight: 700 }}>{acc.telephone}</div></div>
          </a>}
          {acc.whatsapp && <a href={`https://wa.me/${acc.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 22px", textDecoration: "none", color: "#fff" }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div style={{ textAlign: "left" }}><div style={{ fontSize: 10, color: c2, fontWeight: 700, letterSpacing: 1 }}>WHATSAPP</div><div style={{ fontSize: 13, fontWeight: 700 }}>{acc.whatsapp}</div></div>
          </a>}
          {acc.email && <a href={`mailto:${acc.email}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 22px", textDecoration: "none", color: "#fff" }}>
            <span style={{ fontSize: 20 }}>✉️</span>
            <div style={{ textAlign: "left" }}><div style={{ fontSize: 10, color: c2, fontWeight: 700, letterSpacing: 1 }}>EMAIL</div><div style={{ fontSize: 13, fontWeight: 700 }}>{acc.email}</div></div>
          </a>}
          {acc.facebook && <a href={acc.facebook.startsWith("http") ? acc.facebook : `https://${acc.facebook}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 22px", textDecoration: "none", color: "#fff" }}>
            <span style={{ fontSize: 20 }}>📘</span>
            <div style={{ textAlign: "left" }}><div style={{ fontSize: 10, color: c2, fontWeight: 700, letterSpacing: 1 }}>FACEBOOK</div><div style={{ fontSize: 13, fontWeight: 700 }}>Page Facebook</div></div>
          </a>}
        </div>
        {acc.adresse && <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
          <span>📍</span><span>{acc.adresse}</span>
        </div>}
      </div>
    </div>
  );
}
