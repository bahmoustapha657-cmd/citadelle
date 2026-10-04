import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isSupabase } from "../../backend";
import { LanguageSwitcher } from "../LanguageSwitcher";
import Logo from "../../Logo";
import { ConnexionChamps } from "./ConnexionChamps";
import { ConnexionEcole } from "./ConnexionEcole";
import { MotDePasseOublieModal } from "./MotDePasseOublieModal";
import { IconeAlerte, IconeInfo, IconePlus } from "./connexion-icones";

// Carte du formulaire de connexion : titre, vignette de l'école, champs,
// bouton, puis inscription / découverte d'EduGest et mention légale.
export function ConnexionForm({
  infoEcole,
  codeEcole, setCodeEcole,
  login, setLogin,
  mdp, setMdp,
  erreur,
  voir, setVoir,
  chargement,
  statutEcole,
  connecter,
  onInscription,
  onDecouvrir,
}) {
  const { t } = useTranslation();
  const [oubliOuvert, setOubliOuvert] = useState(false);

  const lienOubli = isSupabase && codeEcole.trim().toLowerCase() !== "superadmin" ? (
    <button type="button" className="cx-lien" onClick={() => setOubliOuvert(true)}>
      {t("auth.forgotPassword")}
    </button>
  ) : null;

  return (
    <section className="cx-card">
      <div className="cx-card-top">
        <div className="cx-card-logo" dir="ltr"><Logo width={150} height={48} variant="dark" /></div>
        <div style={{ marginInlineStart: "auto" }}><LanguageSwitcher compact /></div>
      </div>

      <h2 className="cx-title">{t("auth.loginTitle")}</h2>
      <p className="cx-subtitle">{t("auth.loginSubtitle")}</p>

      <ConnexionEcole infoEcole={infoEcole} />

      <form className="cx-form" onSubmit={(event) => { event.preventDefault(); connecter(); }} noValidate>
        <ConnexionChamps
          t={t} codeEcole={codeEcole} setCodeEcole={setCodeEcole}
          login={login} setLogin={setLogin} mdp={mdp} setMdp={setMdp}
          voir={voir} setVoir={setVoir} statutEcole={statutEcole}
          lienOubli={lienOubli}
        />

        {erreur && (
          <div className="cx-erreur" role="alert">
            <IconeAlerte />
            <span>{erreur}</span>
          </div>
        )}

        <button type="submit" className="cx-submit" disabled={chargement}>
          {chargement && <span className="cx-spinner" aria-hidden />}
          {chargement ? t("auth.loggingIn") : t("auth.loginButton")}
        </button>
      </form>

      {oubliOuvert && (
        <MotDePasseOublieModal
          codeEcoleInitial={codeEcole}
          onClose={() => setOubliOuvert(false)}
          // Mot de passe choisi par code SMS : identifiant rappelé et pré-rempli.
          onConnecter={(compte) => {
            if (compte.schoolId) setCodeEcole(compte.schoolId);
            if (compte.login) setLogin(compte.login);
            setMdp("");
            setOubliOuvert(false);
          }}
        />
      )}

      <div className="cx-separateur">{t("auth.noAccount")}</div>

      <div className="cx-actions">
        <button type="button" className="cx-secondaire" onClick={() => onInscription && onInscription()}>
          <IconePlus />
          {t("auth.registerLink")}
        </button>
        {onDecouvrir && (
          <button type="button" className="cx-secondaire" onClick={onDecouvrir}>
            <IconeInfo />
            {t("auth.learnMore")}
          </button>
        )}
      </div>

      <p className="cx-legal">
        {t("auth.privacyConsent")}{" "}
        <a href="/politique-confidentialite.html" target="_blank" rel="noreferrer">
          {t("auth.privacyPolicy")}
        </a>.
      </p>
    </section>
  );
}
