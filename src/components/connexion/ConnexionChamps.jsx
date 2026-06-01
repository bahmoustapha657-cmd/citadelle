import { champStyle, labelStyle } from "./connexion-form-styles";

// Trois champs de connexion : code école (+ statut), identifiant et mot de
// passe avec bascule afficher/masquer. Entrée déclenche la connexion.
export function ConnexionChamps({
  t, codeEcole, setCodeEcole, login, setLogin, mdp, setMdp,
  voir, setVoir, statutEcole, connecter,
}) {
  return (
    <>
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
    </>
  );
}
