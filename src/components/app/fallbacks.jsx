// ══════════════════════════════════════════════════════════════
//  Fallbacks de Suspense (chargement des pages lazy)
// ══════════════════════════════════════════════════════════════
import { Chargement } from "../ui";

export function FullScreenFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#0A1628",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "#fff",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <Chargement type="liste" rows={4} />
      </div>
    </div>
  );
}

export function PageFallback() {
  return (
    <div style={{ padding: "22px 26px" }}>
      <Chargement rows={6} />
    </div>
  );
}

export function OverlayFallback() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(10,22,40,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "84px 16px 16px",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
        }}
      >
        <Chargement type="liste" rows={4} />
      </div>
    </div>
  );
}
