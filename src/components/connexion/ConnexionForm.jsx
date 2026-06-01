import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { ConnexionChamps } from "./ConnexionChamps";

// Corps du formulaire de connexion (champs + bouton + lien inscription).
export function ConnexionForm({
  codeEcole, setCodeEcole,
  login, setLogin,
  mdp, setMdp,
  erreur,
  voir, setVoir,
  chargement,
  statutEcole,
  connecter,
  onInscription,
}) {
  const { t } = useTranslation();

  return (
    <div style={{ padding: "30px 36px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
        <LanguageSwitcher compact />
      </div>

      <ConnexionChamps
        t={t} codeEcole={codeEcole} setCodeEcole={setCodeEcole}
        login={login} setLogin={setLogin} mdp={mdp} setMdp={setMdp}
        voir={voir} setVoir={setVoir} statutEcole={statutEcole} connecter={connecter}
      />

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
  );
}
