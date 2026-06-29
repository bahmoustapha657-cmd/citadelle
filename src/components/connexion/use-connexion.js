import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { signInWithCustomTokenClient } from "../../firebaseAuth";
import { isSupabase } from "../../backend";
import { ecoleLogin, fetchEtatEcole, superadminLogin } from "./connexion-api";

// Course contre la montre : empeche une promesse (sign-in Firebase) de bloquer
// la connexion indefiniment.
function avecDelai(promesse, ms) {
  return Promise.race([
    promesse,
    new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("timeout")), ms)),
  ]);
}

// Logique de connexion : état du formulaire, résolution de l'école saisie
// (lookup Firestore débounce) et appel d'authentification.
export function useConnexion({ onLogin }) {
  const { t } = useTranslation();
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
      setErreur(t("auth.errEnterSchoolCode"));
      return;
    }
    if (!login.trim()) {
      setErreur(t("auth.errEnterUsername"));
      return;
    }

    setChargement(true);
    setErreur("");

    try {
      if (sid === "superadmin") {
        const { ok, data } = await superadminLogin({ login, mdp });
        if (!ok) {
          setErreur(data.error || t("auth.errSuperadminWrong"));
          return;
        }

        onLogin(data.compte, "superadmin");
        // Supabase : session déjà établie par signInWithPassword (pas de token).
        if (!isSupabase && data.customToken) {
          signInWithCustomTokenClient(data.customToken).catch(() => {});
        }
        return;
      }

      const { ok, data } = await ecoleLogin({ login, mdp, schoolId: sid });
      if (!ok) {
        setErreur(data.error || t("auth.wrongCredentials"));
        return;
      }

      if (isSupabase) {
        // Session Supabase déjà ouverte → useAuthSession prend le relais.
        onLogin(data.compte, sid);
        return;
      }

      try {
        // 15 s max : si Firebase Auth pend, on bascule sur le repli onLogin
        // plutot que de bloquer l'ecran de connexion.
        await avecDelai(signInWithCustomTokenClient(data.customToken), 15000);
      } catch {
        onLogin(data.compte, sid);
      }
    } catch {
      setErreur(t("auth.errServerUnreachable"));
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
