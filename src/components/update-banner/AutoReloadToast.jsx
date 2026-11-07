import { useTranslation } from "react-i18next";

// Toast discret affiché pendant l'auto-rechargement de la nouvelle version.
export function AutoReloadToast() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        insetInline: 16,
        bottom: 16,
        zIndex: 9999,
        background: "#0A1628",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        maxWidth: 420,
        margin: "0 auto",
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 16 }}>🔄</span>
      <span>{t("update.reloading")}</span>
    </div>
  );
}
