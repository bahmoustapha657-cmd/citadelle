import { activateWaitingWorker } from "./use-update-banner";

// Bannière avec bouton "Recharger" : nouvelle version en attente d'un moment
// sûr (saisie, fenêtre ou appel en cours). Elle s'installe sinon d'elle-même
// dès que l'utilisateur a fini (arrière-plan, retour sur l'appli, inactivité).
export function UpdateAvailableBanner({ plusTard }) {
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
        flexWrap: "wrap",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 14, flex: "1 1 220px" }}>
        Une nouvelle version d'EduGest est disponible. Elle s'installera
        d'elle-même quand vous aurez terminé.
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={plusTard}
          style={{
            background: "transparent",
            color: "#cbd5e1",
            border: "1px solid rgba(255,255,255,.25)",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Plus tard
        </button>
        <button
          type="button"
          onClick={() => activateWaitingWorker()}
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
      </span>
    </div>
  );
}
