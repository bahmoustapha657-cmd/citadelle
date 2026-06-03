import { useEffect, useState } from "react";
import { signInWithCustomTokenClient } from "../../firebaseAuth";
import { ecoleLogin, fetchEtatEcole, superadminLogin } from "./connexion-api";

// Logique de connexion : état du formulaire, résolution de l'école saisie
// (lookup Firestore débounce) et appel d'authentification.
export function useConnexion({ onLogin }) {
  const [codeEcole, setCodeEcole] = useState(() => localStorage.getItem("LC_schoolId") || "");
  const [login, setLogin] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [voir, setVoir] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [infoEcole, setInfoEcole] = useState(null);
  const [statutEcole, setStatutEcole] = useState("");

  useEffect(() => {
    const sid = codeEcole.trim().toLowerCase();
    if (!sid || sid === "superadmin") {
      setInfoEcole(null);
      setStatutEcole("");
      return undefined;
    }

    setInfoEcole(null);
    setStatutEcole("");

    const timer = setTimeout(async () => {
      try {
        const { info, statut } = await fetchEtatEcole(sid);
        setInfoEcole(info);
        setStatutEcole(statut);
      } catch {
        setInfoEcole(null);
        setStatutEcole("");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [codeEcole]);

  const connecter = async () => {
    const sid = codeEcole.trim().toLowerCase();
    if (!sid) {
      setErreur("Veuillez entrer le code de votre ecole.");
      return;
    }
    if (!login.trim()) {
      setErreur("Veuillez entrer votre identifiant.");
      return;
    }

    setChargement(true);
    setErreur("");

    try {
      if (sid === "superadmin") {
        const { ok, data } = await superadminLogin({ login, mdp });
        if (!ok) {
          setErreur(data.error || "Identifiants superadmin incorrects.");
          return;
        }

        onLogin(data.compte, "superadmin");
        if (data.customToken) {
          signInWithCustomTokenClient(data.customToken).catch(() => {});
        }
        return;
      }

      const { ok, data } = await ecoleLogin({ login, mdp, schoolId: sid });
      if (!ok) {
        setErreur(data.error || "Identifiant ou mot de passe incorrect.");
        return;
      }

      try {
        await signInWithCustomTokenClient(data.customToken);
      } catch {
        onLogin(data.compte, sid);
      }
    } catch {
      setErreur("Impossible de joindre le serveur. Verifiez le code ecole.");
    } finally {
      setChargement(false);
    }
  };

  return {
    codeEcole, setCodeEcole,
    login, setLogin,
    mdp, setMdp,
    erreur,
    voir, setVoir,
    chargement,
    infoEcole,
    statutEcole,
    connecter,
  };
}
