import { C } from "../../constants";
import { MessageItem } from "./MessageItem";

// Boîte de réception modale des messages SuperAdmin.
export function MessagesBoite({ messagesPourMoi, lus, nonLus, marquerLu, marquerToutLu, setBoiteOuverte }) {
  return (
    <div
      onClick={() => setBoiteOuverte(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 10,
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 20 }}>📢</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.blueDark, flex: 1 }}>
            Messages SuperAdmin
          </h3>
          {nonLus.length > 0 && (
            <button
              onClick={marquerToutLu}
              style={{
                background: "#f0f4f8",
                border: "1px solid #e0ebf8",
                borderRadius: 7,
                padding: "5px 10px",
                fontSize: 11,
                color: C.blue,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tout marquer lu
            </button>
          )}
          <button
            onClick={() => setBoiteOuverte(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              color: "#94a3b8",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messagesPourMoi.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Aucun message à afficher.
            </div>
          ) : (
            messagesPourMoi.map((m) => (
              <MessageItem key={m._id} m={m} lus={lus} marquerLu={marquerLu} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
