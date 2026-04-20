import React, { useState } from "react";
import { updatePassword } from "firebase/auth";
import { getAuthHeaders } from "../apiClient";
import { auth } from "../firebase";

function ChangerMotDePasseModal({ utilisateur, onDone }) {
  const [mdp1, setMdp1] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErr("");

    if (mdp1.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (mdp1 !== mdp2) {
      setErr("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      await updatePassword(auth.currentUser, mdp1);

      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/account-manage", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "self_password_sync", mdp: mdp1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erreur de synchronisation du mot de passe.");
      }

      setOk(true);
      setTimeout(() => onDone?.(), 1200);
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        setErr("Session expirée. Veuillez vous reconnecter puis changer le mot de passe.");
      } else {
        setErr(e.message || "Erreur lors du changement de mot de passe.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,22,40,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 40,
          maxWidth: 420,
          width: "90%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#0A1628" }}>
            Changement de mot de passe requis
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
            Votre compte {utilisateur?.login ? <strong>{utilisateur.login}</strong> : "utilisateur"} utilise un mot de passe temporaire.
            Définissez un nouveau mot de passe avant de continuer.
          </p>
        </div>
        {ok ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <p style={{ color: "#059669", fontWeight: 700 }}>Mot de passe mis à jour.</p>
          </div>
        ) : (
          <form onSubmit={soumettre}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={mdp1}
              onChange={(e) => setMdp1(e.target.value)}
              placeholder="Minimum 8 caractères"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #d1d5db",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
                marginBottom: 14,
                outline: "none",
              }}
              required
              autoFocus
            />
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={mdp2}
              onChange={(e) => setMdp2(e.target.value)}
              placeholder="Répétez le mot de passe"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #d1d5db",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
                marginBottom: 14,
                outline: "none",
              }}
              required
            />
            {err && (
              <p
                style={{
                  color: "#dc2626",
                  fontSize: 13,
                  margin: "0 0 14px",
                  background: "#fef2f2",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}
              >
                {err}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                background: "#0A1628",
                color: "#fff",
                border: "none",
                padding: "12px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Enregistrement..." : "Changer le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export { ChangerMotDePasseModal };
