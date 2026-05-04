import React, { useEffect, useMemo, useState } from "react";
import {
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { C } from "../constants";
import { apiFetch, getAuthHeaders } from "../apiClient";

const NIVEAUX = {
  info: { label: "Info", couleur: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
  important: { label: "Important", couleur: "#a16207", bg: "#fef3c7", border: "#fcd34d" },
  critique: { label: "Critique", couleur: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
};

const cleStockage = (uid) => `LC_messagesLus_${uid}`;

function lireLusLocal(uid) {
  if (!uid) return {};
  try {
    return JSON.parse(localStorage.getItem(cleStockage(uid)) || "{}");
  } catch {
    return {};
  }
}

function ecrireLusLocal(uid, lus) {
  if (!uid) return;
  try {
    localStorage.setItem(cleStockage(uid), JSON.stringify(lus));
  } catch {
    // quota exceeded, ignore
  }
}

function MessagesEcole({ utilisateur, schoolId }) {
  const uid = utilisateur?.uid;
  const role = utilisateur?.role;
  const [messages, setMessages] = useState([]);
  const [lus, setLus] = useState(() => lireLusLocal(uid));
  const [uidLus, setUidLus] = useState(uid || null);
  const [boiteOuverte, setBoiteOuverte] = useState(false);
  const [bandeauFerme, setBandeauFerme] = useState({});

  if (uidLus !== uid) {
    setUidLus(uid || null);
    setLus(lireLusLocal(uid));
  }

  useEffect(() => {
    if (!uid || !role || role === "parent") return;
    let cancelled = false;

    const chargerMessages = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await apiFetch("/school", {
          method: "GET",
          query: { op: "superadmin-messages" },
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      }
    };

    chargerMessages();
    const timer = window.setInterval(chargerMessages, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [uid, role]);

  const messagesPourMoi = useMemo(() => {
    if (!role || !schoolId) return [];
    return messages;
  }, [messages, role, schoolId]);

  const nonLus = messagesPourMoi.filter((m) => !lus[m._id]);
  const bandeauxAffiches = messagesPourMoi
    .filter((m) => (m.niveau === "important" || m.niveau === "critique") && !lus[m._id] && !bandeauFerme[m._id])
    .slice(0, 1);

  const marquerLu = async (msg) => {
    if (!uid || !schoolId) return;
    const nouveauxLus = { ...lus, [msg._id]: Date.now() };
    setLus(nouveauxLus);
    ecrireLusLocal(uid, nouveauxLus);
    try {
      await setDoc(
        doc(db, "superadmin_messages", msg._id, "lectures", uid),
        {
          schoolId,
          role,
          login: utilisateur?.login || null,
          readAt: Date.now(),
        },
      );
    } catch {
      // pas d'accès réseau ou règles : on garde le marquage local
    }
  };

  const marquerToutLu = () => {
    nonLus.forEach((m) => marquerLu(m));
  };

  if (!uid || role === "parent") return null;

  return (
    <>
      {/* Bandeau pour messages important/critique non lus */}
      {bandeauxAffiches.map((m) => {
        const niv = NIVEAUX[m.niveau] || NIVEAUX.info;
        return (
          <div
            key={m._id}
            style={{
              background: niv.bg,
              borderBottom: `2px solid ${niv.border}`,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: niv.couleur,
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 18 }}>{m.niveau === "critique" ? "🚨" : "⚠️"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontWeight: 800, marginRight: 8 }}>{m.titre}</strong>
              <span style={{ color: niv.couleur, opacity: 0.85 }}>
                {m.corps.length > 140 ? m.corps.slice(0, 140) + "…" : m.corps}
              </span>
            </div>
            <button
              onClick={() => setBoiteOuverte(true)}
              style={{
                background: niv.couleur,
                color: "#fff",
                border: "none",
                borderRadius: 7,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Lire
            </button>
            <button
              onClick={() => setBandeauFerme((p) => ({ ...p, [m._id]: true }))}
              title="Masquer"
              style={{
                background: "none",
                border: "none",
                color: niv.couleur,
                fontSize: 18,
                cursor: "pointer",
                padding: "0 4px",
                opacity: 0.6,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Cloche flottante avec compteur */}
      <button
        onClick={() => setBoiteOuverte(true)}
        title="Messages SuperAdmin"
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 250,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: nonLus.length > 0 ? C.blue : "#fff",
          color: nonLus.length > 0 ? "#fff" : C.blue,
          border: `2px solid ${C.blue}`,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,32,80,0.18)",
          fontSize: 20,
          display: messagesPourMoi.length === 0 ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        📢
        {nonLus.length > 0 && (
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
            {nonLus.length > 9 ? "9+" : nonLus.length}
          </span>
        )}
      </button>

      {/* Boîte de réception modale */}
      {boiteOuverte && (
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
                messagesPourMoi.map((m) => {
                  const niv = NIVEAUX[m.niveau] || NIVEAUX.info;
                  const dejaLu = !!lus[m._id];
                  return (
                    <div
                      key={m._id}
                      onClick={() => !dejaLu && marquerLu(m)}
                      style={{
                        border: `1px solid ${niv.border}`,
                        borderLeft: `4px solid ${niv.couleur}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        background: dejaLu ? "#fafafa" : niv.bg,
                        cursor: dejaLu ? "default" : "pointer",
                        opacity: dejaLu ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            background: niv.couleur,
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                          }}
                        >
                          {niv.label.toUpperCase()}
                        </span>
                        {!dejaLu && (
                          <span
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              padding: "2px 7px",
                              borderRadius: 10,
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            NOUVEAU
                          </span>
                        )}
                        <strong style={{ fontSize: 13, color: C.blueDark, flex: 1 }}>{m.titre}</strong>
                        <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>
                          {new Date(m.createdAt).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#374151",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {m.corps}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MessagesEcole;
