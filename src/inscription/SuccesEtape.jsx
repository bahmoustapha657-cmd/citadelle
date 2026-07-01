import { useTranslation, Trans } from "react-i18next";
import { cardStyle, boxStyle, btnStyle } from "./inscription-styles";

// Écran de succès (étape 3) : récapitulatif des identifiants créés.
export function SuccesEtape({ form, comptesSecondaires }) {
  const { t } = useTranslation();
  return (
    <div style={cardStyle}>
      <div style={{ ...boxStyle, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>OK</div>
        <h2 style={{ color: "#0A1628", margin: "0 0 8px" }}>{t("register.successTitle")}</h2>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 20 }}>
          <Trans i18nKey="register.successWorkspace" values={{ name: form.nomEcole }} components={{ strong: <strong /> }} />
          <br />
          {t("register.successInstructions")}
        </p>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", textAlign: "start", fontSize: 13, color: "#9a3412", marginBottom: 20 }}>
          ⏳ <strong>En attente de validation.</strong> Votre établissement doit être validé par l'administrateur avant de pouvoir vous connecter. Conservez vos identifiants ci-dessous — vous serez notifié de l'activation.
        </div>
        <div style={{ background: "#f0f6f2", borderRadius: 10, padding: "14px 18px", textAlign: "start", fontSize: 13, marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}><strong>{t("register.directionAccount")} :</strong></div>
          <div style={{ fontFamily: "monospace", background: "#e0ebf8", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
            <div>{t("register.usernameLabel")} : <strong>{form.adminLogin}</strong></div>
            <div>{t("register.passwordLabel")} : <strong>{form.adminMdp}</strong></div>
          </div>
          {comptesSecondaires.length > 0 && (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 700, color: "#b45309" }}>
                {t("register.secondaryAccountsWarning")} :
              </div>
              <div style={{ fontFamily: "monospace", background: "#fff7ed", borderRadius: 6, padding: "6px 10px" }}>
                {comptesSecondaires.map((compte) => (
                  <div key={compte.login}>{compte.login} / <strong>{compte.mdp}</strong></div>
                ))}
              </div>
            </div>
          )}
        </div>
        <a href="/" style={{ ...btnStyle, display: "block", textDecoration: "none", textAlign: "center" }}>
          {t("register.goToLogin")}
        </a>
      </div>
    </div>
  );
}
