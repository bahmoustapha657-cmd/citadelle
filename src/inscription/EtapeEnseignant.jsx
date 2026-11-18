import { useTranslation } from "react-i18next";
import { libelleSection } from "../i18n/libelles";
import { inputStyle, labelStyle, btnStyle, errStyle } from "./inscription-styles";
import { NIVEAUX_ENSEIGNANT } from "./inscription-validation";

const aide = { fontSize: 11.5, color: "#475569", marginTop: 4 };

// Formulaire d'un enseignant indépendant : une seule étape. Son numéro de
// téléphone sera son code et son identifiant de connexion.
export function EtapeEnseignant({ form, chg, basculerNiveau, erreur, chargement, inscrire, onBack }) {
  const { t } = useTranslation();
  return (
    <>
      <label style={labelStyle}>{t("register.teacher.fullName")} *</label>
      <input style={inputStyle} value={form.nomEnseignant} onChange={chg("nomEnseignant")}
        placeholder={t("register.teacher.fullNamePlaceholder")} autoFocus autoComplete="name" />

      <label style={labelStyle}>{t("register.teacher.phone")} *</label>
      <input style={inputStyle} type="tel" value={form.telephone} onChange={chg("telephone")}
        placeholder={t("register.teacher.phonePlaceholder")} autoComplete="tel" />
      <div style={aide}>{t("register.teacher.phoneHelp")}</div>

      <label style={labelStyle}>{t("register.teacher.email")} *</label>
      <input style={inputStyle} type="email" value={form.email} onChange={chg("email")}
        placeholder={t("register.teacher.emailPlaceholder")} autoComplete="email" />
      <div style={aide}>{t("register.teacher.emailHelp")}</div>

      <label style={labelStyle}>{t("register.teacher.school")} *</label>
      <input style={inputStyle} value={form.etablissement} onChange={chg("etablissement")}
        placeholder={t("register.teacher.schoolPlaceholder")} />

      <label style={labelStyle}>{t("register.city")} *</label>
      <input style={inputStyle} value={form.ville} onChange={chg("ville")} placeholder={t("register.teacher.cityPlaceholder")} />

      <label style={labelStyle}>{t("register.teacher.levels")} *</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {NIVEAUX_ENSEIGNANT.map((id) => {
          const coche = form.sections.includes(id);
          return (
            <label key={id} style={{
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              border: `1.5px solid ${coche ? "#00A876" : "#b0c4d8"}`, background: coche ? "#ecfdf5" : "#fff",
              borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "#0A1628",
            }}>
              <input type="checkbox" checked={coche} onChange={() => basculerNiveau(id)} />
              {libelleSection(id)}
            </label>
          );
        })}
      </div>

      <label style={labelStyle}>{t("register.adminPassword")} *</label>
      <input style={inputStyle} type="password" value={form.adminMdp} onChange={chg("adminMdp")}
        placeholder={t("register.teacher.passwordPlaceholder")} autoComplete="new-password" />

      <label style={labelStyle}>{t("register.adminPasswordConfirm")} *</label>
      <input style={inputStyle} type="password" value={form.adminMdp2} onChange={chg("adminMdp2")}
        placeholder={t("register.teacher.passwordConfirmPlaceholder")} autoComplete="new-password" />

      {/* Honeypot anti-bot : invisible pour les humains. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website}
        onChange={chg("website")} aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      {erreur && <div style={errStyle}>{erreur}</div>}

      <button style={btnStyle} onClick={inscrire} disabled={chargement}>
        {chargement ? t("register.teacher.creating") : t("register.teacher.submit")}
      </button>
      <button onClick={onBack} disabled={chargement} style={{
        width: "100%", background: "none", border: "1px solid #b0c4d8", borderRadius: 9,
        padding: "10px", fontSize: 13, cursor: "pointer", color: "#0A1628", marginTop: 8,
      }}>
        ← {t("common.back")}
      </button>
    </>
  );
}
