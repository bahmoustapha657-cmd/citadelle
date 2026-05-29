import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useInscription } from "./inscription/use-inscription";
import { cardStyle, boxStyle } from "./inscription/inscription-styles";
import { SuccesEtape } from "./inscription/SuccesEtape";
import { EtapeEcole } from "./inscription/EtapeEcole";
import { EtapeAdmin } from "./inscription/EtapeAdmin";

// Écran d'inscription : logique dans useInscription, étapes et styles dans
// inscription/.
export default function Inscription() {
  const { t } = useTranslation();
  const i = useInscription();

  if (i.etape === 3) {
    return <SuccesEtape form={i.form} comptesSecondaires={i.comptesSecondaires} />;
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
                  background: i.etape >= n ? "#0A1628" : "#e0ebf8",
                  color: i.etape >= n ? "#fff" : "#0A1628",
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280" }}>
            {i.etape === 1 ? t("register.step1Title") : t("register.step2Title")}
          </p>
        </div>

        {i.etape === 1 && (
          <EtapeEcole
            form={i.form}
            chg={i.chg}
            erreur={i.erreur}
            onNext={() => { if (i.validerEtape1()) i.setEtape(2); }}
          />
        )}

        {i.etape === 2 && (
          <EtapeAdmin
            form={i.form}
            chg={i.chg}
            erreur={i.erreur}
            chargement={i.chargement}
            inscrire={i.inscrire}
            onBack={() => { i.setEtape(1); i.setErreur(""); }}
          />
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
