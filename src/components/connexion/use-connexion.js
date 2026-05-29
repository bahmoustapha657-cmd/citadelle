import { useEffect, useState } from "react";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { signInWithCustomTokenClient } from "../../firebaseAuth";
import { db } from "../../firebaseDb";
import { apiFetch } from "../../apiClient";

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
      return;
    }

    setInfoEcole(null);
    setStatutEcole("");

    const appliquerEtatEcole = (snap) => {
      if (!snap.exists()) {
        setInfoEcole(null);
        setStatutEcole("");
        return;
      }

      const data = snap.data() || {};
      if (data.supprime === true) {
        setInfoEcole(null);
        setStatutEcole("supprimee");
        return;
      }
      if (data.actif === false) {
        setInfoEcole(null);
        setStatutEcole("inactive");
        return;
      }

      setInfoEcole(data);
      setStatutEcole("");
    };

    const timer = setTimeout(async () => {
      const publicRef = doc(db, "ecoles_public", sid);
      const privateRef = doc(db, "ecoles", sid);
      try {
        const snap = await getDocFromServer(privateRef).catch(async () => getDocFromServer(publicRef));
        appliquerEtatEcole(snap);
      } catch {
        getDoc(publicRef)
          .then(appliquerEtatEcole)
          .catch(() => {
            setInfoEcole(null);
            setStatutEcole("");
          });
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
        const reponse = await apiFetch("/superadmin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: login.trim(), mdp }),
        });
        const data = await reponse.json().catch(() => ({}));
        if (!reponse.ok || !data.ok) {
          setErreur(data.error || "Identifiants superadmin incorrects.");
          return;
        }

        onLogin(data.compte, "superadmin");
        if (data.customToken) {
          signInWithCustomTokenClient(data.customToken).catch(() => {});
        }
        return;
      }

      const reponse = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: login.trim().toLowerCase(),
          mdp,
          schoolId: sid,
        }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok || !data.ok) {
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
