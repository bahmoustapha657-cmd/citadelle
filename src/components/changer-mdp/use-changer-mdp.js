import { useState } from "react";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { updateCurrentUserPassword } from "../../firebaseAuth";
import { isSupabase } from "../../backend";
import { changerMotDePassePerso } from "../../backend/account-manage-supabase";

// Logique du changement de mot de passe imposé : validation, mise à jour
// Firebase Auth et synchronisation côté serveur.
export function useChangerMdp({ onDone }) {
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
      if (isSupabase) {
        await changerMotDePassePerso(mdp1);
      } else {
        await updateCurrentUserPassword(mdp1);

        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        const res = await apiFetch("/account-manage", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "self_password_sync", mdp: mdp1 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Erreur de synchronisation du mot de passe.");
        }
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

  return { mdp1, setMdp1, mdp2, setMdp2, err, ok, busy, soumettre };
}
