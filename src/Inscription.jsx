import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { apiFetch } from "./apiClient";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export default function Inscription() {
  const { t } = useTranslation();
  const [etape, setEtape] = useState(1); // 1=infos ecole, 2=compte admin, 3=succes
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [comptesInit, setComptesInit] = useState(null);
  const [form, setForm] = useState({
    nomEcole: "",
    ville: "",
    pays: "Guinee",
    adminLogin: "",
    adminMdp: "",
    adminMdp2: "",
  });

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const comptesSecondaires = comptesInit
    ? Object.values(comptesInit).filter((compte) => compte?.login && compte?.mdp)
    : [];

  const validerEtape1 = () => {
    if (!form.nomEcole.trim()) {
      setErreur(t("register.errors.schoolNameRequired"));
      return false;
    }
    if (!form.ville.trim()) {
      setErreur(t("register.errors.cityRequired"));
      return false;
    }
    setErreur("");
    return true;
  };

  const validerEtape2 = () => {
    if (!form.adminLogin.trim()) {
      setErreur(t("register.errors.adminLoginRequired"));
      return false;
    }
    if (form.adminMdp.length < 8) {
      setErreur(t("register.errors.passwordTooShort"));
      return false;
    }
    if (form.adminMdp !== form.adminMdp2) {
      setErreur(t("register.errors.passwordsMismatch"));
      return false;
    }
    setErreur("");
    return true;
  };

  const inscrire = async () => {
    if (!validerEtape2()) return;
    setChargement(true);
    setErreur("");
    try {
      const r = await apiFetch("/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomEcole: form.nomEcole,
          ville: form.ville,
          pays: form.pays,
          adminLogin: form.adminLogin,
          adminMdp: form.adminMdp,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(data.error || t("register.errors.submitFailed"));
        return;
      }
      localStorage.setItem("LC_schoolId", data.schoolId);
      localStorage.removeItem("LC_comptes_init");
      setComptesInit(data.compteSecondaires || null);
      setEtape(3);
    } catch (e) {
      console.error(e);
      setErreur(t("register.errors.networkError"));
    } finally {
      setChargement(false);
    }
  };

  const cardStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    background: "linear-gradient(135deg,#002050 0%,#0A1628 50%,#00A876 100%)",
  };
  const boxStyle = {
    background: "#fff",
    borderRadius: 18,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  };
  const inputStyle = {
    width: "100%",
    border: "1px solid #b0c4d8",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    marginTop: 4,
  };
  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#0A1628",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 12,
  };
  const btnStyle = {
    width: "100%",
    background: "linear-gradient(90deg,#0A1628,#00C48C)",
    color: "#fff",
    border: "none",
    padding: 12,
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 16,
  };
  const errStyle = {
    background: "#fce8e8",
    border: "1px solid #f5c1c1",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "#9b2020",
    textAlign: "center",
    marginTop: 12,
  };

  if (etape === 3) {
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
          <div style={{ background: "#f0f6f2", borderRadius: 10, padding: "14px 18px", textAlign: "left", fontSize: 13, marginBottom: 20 }}>
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

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <LanguageSwitcher compact />
        </div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#0A1628" }}>
            {t("register.title")}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
            {t("register.subtitle")}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: etape >= n ? "#0A1628" : "#e0ebf8",
                  color: etape >= n ? "#fff" : "#0A1628",
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280" }}>
            {etape === 1 ? t("register.step1Title") : t("register.step2Title")}
          </p>
        </div>

        {etape === 1 && (
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

            <button style={btnStyle} onClick={() => { if (validerEtape1()) setEtape(2); }}>
              {t("common.next")} →
            </button>
          </>
        )}

        {etape === 2 && (
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
              onClick={() => { setEtape(1); setErreur(""); }}
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
        )}

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
          {t("register.alreadyRegistered")}{" "}
          <a href="/" style={{ color: "#0A1628", fontWeight: 700, textDecoration: "none" }}>
            {t("register.signIn")}
          </a>
        </p>
      </div>
    </div>
  );
}
