import { C } from "../constants";
import { useMessagesEcole } from "./messages-ecole/use-messages-ecole";
import { MessagesBandeaux } from "./messages-ecole/MessagesBandeaux";
import { MessagesBoite } from "./messages-ecole/MessagesBoite";

// Orchestrateur des messages SuperAdmin côté école : logique dans
// useMessagesEcole, bandeaux et boîte dans messages-ecole/.
function MessagesEcole({ utilisateur, schoolId }) {
  const m = useMessagesEcole({ utilisateur, schoolId });

  if (!m.uid || m.role === "parent") return null;

  return (
    <>
      <MessagesBandeaux
        bandeauxAffiches={m.bandeauxAffiches}
        setBoiteOuverte={m.setBoiteOuverte}
        setBandeauFerme={m.setBandeauFerme}
      />

      <button
        onClick={() => m.setBoiteOuverte(true)}
        title="Messages SuperAdmin"
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 250,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: m.nonLus.length > 0 ? C.blue : "#fff",
          color: m.nonLus.length > 0 ? "#fff" : C.blue,
          border: `2px solid ${C.blue}`,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,32,80,0.18)",
          fontSize: 20,
          display: m.messagesPourMoi.length === 0 ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        📢
        {m.nonLus.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 900,
              border: "2px solid #fff",
            }}
          >
            {m.nonLus.length > 9 ? "9+" : m.nonLus.length}
          </span>
        )}
      </button>

      {m.boiteOuverte && (
        <MessagesBoite
          messagesPourMoi={m.messagesPourMoi}
          lus={m.lus}
          nonLus={m.nonLus}
          marquerLu={m.marquerLu}
          marquerToutLu={m.marquerToutLu}
          setBoiteOuverte={m.setBoiteOuverte}
        />
      )}
    </>
  );
}

export default MessagesEcole;
