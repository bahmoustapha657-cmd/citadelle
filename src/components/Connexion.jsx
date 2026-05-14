import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { signInWithCustomTokenClient } from "../firebaseAuth";
import { db } from "../firebaseDb";
import { C, getAnnee } from "../constants";
import { apiFetch } from "../apiClient";
import Logo from "../Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

function Connexion({ onLogin, onInscription }) {
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

  const champStyle = {
    width: "100%",
    border: "2px solid #e5e9f0",
    borderRadius: 9,
    padding: "11px 14px",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color .15s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A1628",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)`,
            padding: "32px 36px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Logo width={220} height={70} variant="light" />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Gestion scolaire intelligente
          </p>

          {infoEcole && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "center",
              }}
            >
              {infoEcole.logo && (
                <img
                  src={infoEcole.logo}
                  alt="logo ecole"
                  style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
                />
              )}
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: infoEcole.couleur2 || C.green }}>
                  {infoEcole.nom}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                  {infoEcole.ville}, {infoEcole.pays} - {getAnnee()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "30px 36px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
            <LanguageSwitcher compact />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {t("auth.schoolCode")}
            </label>
            <input
              value={codeEcole}
              onChange={(event) => setCodeEcole(event.target.value)}
              placeholder={t("auth.schoolCodePlaceholder")}
              onKeyDown={(event) => event.key === "Enter" && connecter()}
              style={champStyle}
            />
            {statutEcole && (
              <p style={{ margin: "8px 2px 0", fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                {statutEcole === "inactive" ? "Cette ecole est inactive." : "Cette ecole n'est plus disponible."}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {t("auth.username")}
            </label>
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              onKeyDown={(event) => event.key === "Enter" && connecter()}
              style={champStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {t("auth.password")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={mdp}
                onChange={(event) => setMdp(event.target.value)}
                type={voir ? "text" : "password"}
                placeholder={t("auth.passwordPlaceholder")}
                onKeyDown={(event) => event.key === "Enter" && connecter()}
                style={{ ...champStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setVoir((value) => !value)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {voir ? "Masquer" : "Voir"}
              </button>
            </div>
          </div>

          {erreur && (
            <div
              style={{
                background: "#fce8e8",
                border: "1px solid #f5c1c1",
                borderRadius: 9,
                padding: "10px 14px",
                fontSize: 13,
                color: "#9b2020",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              {erreur}
            </div>
          )}

          <button
            onClick={connecter}
            disabled={chargement}
            style={{
              width: "100%",
              background: `linear-gradient(90deg, ${C.blue}, ${C.green})`,
              color: "#fff",
              border: "none",
              padding: "13px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 800,
              cursor: chargement ? "not-allowed" : "pointer",
              marginTop: 4,
              opacity: chargement ? 0.7 : 1,
              letterSpacing: "0.02em",
            }}
          >
            {chargement ? t("auth.loggingIn") : t("auth.loginButton")}
          </button>

          <p style={{ textAlign: "center", margin: "4px 0 0", color: "#9ca3af", fontSize: 12 }}>
            {t("auth.noAccount")}{" "}
            <button
              type="button"
              onClick={() => onInscription && onInscription()}
              style={{ background: "none", border: "none", padding: 0, color: C.blue, cursor: "pointer", fontWeight: 700, fontSize: "inherit", fontFamily: "inherit" }}
            >
              {t("auth.registerLink")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export { Connexion };
