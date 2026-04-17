import { useEffect } from "react";

const TOAST_COLORS = { success: "#00C48C", error: "#ef4444", info: "#3b82f6", warning: "#f59e0b" };
const TOAST_ICONS = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

export default function ToastContainer({ toasts }) {
  useEffect(() => {
    const toastStyle = document.createElement("style");
    toastStyle.textContent = "@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}";
    document.head.appendChild(toastStyle);

    return () => {
      document.head.removeChild(toastStyle);
    };
  }, []);

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: "#1e293b",
            color: "#f1f5f9",
            borderRadius: 12,
            padding: "12px 16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            borderLeft: `4px solid ${TOAST_COLORS[toast.type] || TOAST_COLORS.info}`,
            animation: "slideIn .25s ease",
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontSize: 16, marginTop: 1 }}>{TOAST_ICONS[toast.type] || "ℹ️"}</span>
          <span>{toast.msg}</span>
        </div>
      ))}
    </div>
  );
}
