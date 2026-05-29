import { useTranslation } from "react-i18next";
import { inputStyle, labelStyle, btnStyle, errStyle } from "./inscription-styles";

// Étape 1 : informations de l'école (nom, ville, pays).
export function EtapeEcole({ form, chg, erreur, onNext }) {
  const { t } = useTranslation();
  return (
    <>
      <label style={labelStyle}>{t("register.schoolName")} *</label>
      <input
        style={inputStyle}
        value={form.nomEcole}
        onChange={chg("nomEcole")}
        placeholder={t("register.schoolNamePlaceholder")}
        autoFocus
      />

      <label style={labelStyle}>{t("register.city")} *</label>
      <input
        style={inputStyle}
        value={form.ville}
        onChange={chg("ville")}
        placeholder={t("register.cityPlaceholder")}
      />

      <label style={labelStyle}>{t("register.country")}</label>
      <input
        style={inputStyle}
        value={form.pays}
        onChange={chg("pays")}
        placeholder={t("register.countryPlaceholder")}
      />

      {erreur && <div style={errStyle}>{erreur}</div>}

      <button style={btnStyle} onClick={onNext}>
        {t("common.next")} →
      </button>
    </>
  );
}
