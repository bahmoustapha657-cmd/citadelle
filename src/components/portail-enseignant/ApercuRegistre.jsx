import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Aperçu d'un registre d'appel dans la page, sans impression : la feuille A4
// est montrée dans un cadre qu'on fait défiler (sur téléphone aussi).
export function ApercuRegistre({ html, fermer }) {
  const { t } = useTranslation();
  useEffect(() => {
    const echap = (e) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [fermer]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t("teacher.register.preview")}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.65)", display: "flex", flexDirection: "column", padding: 12, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong style={{ flex: 1, color: "#fff", fontSize: 14 }}>👁️ {t("teacher.register.preview")}</strong>
        <button type="button" onClick={fermer}
          style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "#fff", color: "#0f172a", fontWeight: 800, cursor: "pointer" }}>
          ✕ {t("teacher.register.close")}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", background: "#fff", borderRadius: 10 }}>
        <iframe title={t("teacher.register.preview")} srcDoc={html} sandbox=""
          style={{ border: 0, width: "100%", minWidth: 1050, height: "100%", minHeight: 700, display: "block" }} />
      </div>
    </div>
  );
}
