import { useTranslation } from "react-i18next";
import { inputStyle, labelStyle, btnStyle, errStyle } from "./inscription-styles";

// Étape 2 : création du compte administrateur (identifiant + mot de passe).
export function EtapeAdmin({ form, chg, erreur, chargement, inscrire, onBack }) {
  const { t } = useTranslation();
  return (
    <>
      <label style={labelStyle}>{t("register.adminUsername")} *</label>
      <input
        style={inputStyle}
        value={form.adminLogin}
        onChange={chg("adminLogin")}
        placeholder={t("register.adminUsernamePlaceholder")}
        autoFocus
      />

      <label style={labelStyle}>{t("register.adminPassword")} *</label>
      <input
        style={inputStyle}
        type="password"
        value={form.adminMdp}
        onChange={chg("adminMdp")}
        placeholder={t("register.adminPasswordPlaceholder")}
      />

      <label style={labelStyle}>{t("register.adminPasswordConfirm")} *</label>
      <input
        style={inputStyle}
        type="password"
        value={form.adminMdp2}
        onChange={chg("adminMdp2")}
        placeholder={t("register.adminPasswordConfirmPlaceholder")}
      />

      {erreur && <div style={errStyle}>{erreur}</div>}

      <button style={btnStyle} onClick={inscrire} disabled={chargement}>
        {chargement ? t("register.creating") : t("register.submitButton")}
      </button>

      <button
        onClick={onBack}
        style={{
          width: "100%",
          background: "none",
          border: "1px solid #b0c4d8",
          borderRadius: 9,
          padding: "10px",
          fontSize: 13,
          cursor: "pointer",
          color: "#0A1628",
          marginTop: 8,
        }}
      >
        ← {t("common.back")}
      </button>
    </>
  );
}
