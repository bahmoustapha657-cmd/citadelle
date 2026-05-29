import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { LanguageSwitcher } from "../LanguageSwitcher";

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

const labelStyle = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  color: C.blueDark,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

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
      <div>
        <label style={labelStyle}>{t("auth.schoolCode")}</label>
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
        <label style={labelStyle}>{t("auth.username")}</label>
        <input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder={t("auth.usernamePlaceholder")}
          onKeyDown={(event) => event.key === "Enter" && connecter()}
          style={champStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{t("auth.password")}</label>
        <div style={{ position: "relative" }}>
          <input
            value={mdp}
            onChange={(event) => setMdp(event.target.value)}
            type={voir ? "text" : "password"}
            placeholder={t("auth.passwordPlaceholder")}
            onKeyDown={(event) => event.key === "Enter" && connecter()}
            style={{ ...champStyle, paddingInlineEnd: 44 }}
          />
          <button
            type="button"
            onClick={() => setVoir((value) => !value)}
            style={{
              position: "absolute",
              insetInlineEnd: 12,
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
  );
}
