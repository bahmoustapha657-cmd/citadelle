import { useEffect, useState } from "react";

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  if (!available) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        background: "#0A1628",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 14 }}>
        Une nouvelle version d'EduGest est disponible.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: "#3b82f6",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          padding: "8px 14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Recharger
      </button>
    </div>
  );
}
