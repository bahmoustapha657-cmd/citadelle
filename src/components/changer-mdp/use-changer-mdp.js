import { useState } from "react";
import { changerMotDePassePerso } from "../../backend/account-manage-supabase";

// Logique du changement de mot de passe imposé : validation puis mise à jour
// via Supabase Auth.
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
      await changerMotDePassePerso(mdp1);
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
