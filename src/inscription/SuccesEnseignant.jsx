import { useTranslation } from "react-i18next";
import { cardStyle, boxStyle, btnStyle } from "./inscription-styles";

// Espace enseignant créé : le numéro sert de code et d'identifiant.
export function SuccesEnseignant({ form, code, login }) {
  const { t } = useTranslation();
  return (
    <div style={cardStyle}>
      <div style={{ ...boxStyle, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
        <h2 style={{ color: "#0A1628", margin: "0 0 8px" }}>{t("register.teacher.successTitle")}</h2>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 18px" }}>
          {t("register.teacher.successOwner", { name: form.nomEnseignant, school: form.etablissement })}
        </p>
        <div style={{ background: "#f0f6f2", borderRadius: 10, padding: "14px 18px", textAlign: "start", fontSize: 13, marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}><strong>{t("register.teacher.successHowTo")}</strong></div>
          <div style={{ fontFamily: "monospace", background: "#e0ebf8", borderRadius: 6, padding: "8px 10px", lineHeight: 1.7 }}>
            <div>{t("auth.schoolCode")} : <strong>{code}</strong></div>
            <div>{t("auth.username")} : <strong>{login}</strong></div>
            <div>{t("auth.password")} : {t("register.teacher.successPasswordChosen")}</div>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: "#475569", textAlign: "start", margin: "0 0 4px", lineHeight: 1.6 }}>
          {t("register.teacher.successNext")}
        </p>
        <a href="/" style={{ ...btnStyle, display: "block", textDecoration: "none", textAlign: "center" }}>
          {t("register.teacher.signIn")}
        </a>
      </div>
    </div>
  );
}
