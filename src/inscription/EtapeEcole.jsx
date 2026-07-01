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

      <label style={labelStyle}>Responsable de l'établissement *</label>
      <input
        style={inputStyle}
        value={form.responsable}
        onChange={chg("responsable")}
        placeholder="Nom et prénom du directeur / fondateur"
      />

      <label style={labelStyle}>Téléphone du responsable *</label>
      <input
        style={inputStyle}
        type="tel"
        value={form.telephone}
        onChange={chg("telephone")}
        placeholder="Ex : 6XX XX XX XX"
      />

      <label style={labelStyle}>Email *</label>
      <input
        style={inputStyle}
        type="email"
        value={form.email}
        onChange={chg("email")}
        placeholder="contact@ecole.com"
      />

      {/* Honeypot anti-bot : invisible pour les humains, souvent rempli par les
          robots. Si rempli, le serveur rejette l'inscription. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={chg("website")}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#1e40af", margin: "10px 0" }}>
        ℹ️ Votre inscription sera vérifiée puis <strong>validée par l'administrateur</strong> avant l'activation de l'espace.
      </div>

      {erreur && <div style={errStyle}>{erreur}</div>}

      <button style={btnStyle} onClick={onNext}>
        {t("common.next")} →
      </button>
    </>
  );
}
