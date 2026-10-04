import { useTranslation } from "react-i18next";
import Logo from "../Logo";
import { useConnexion } from "./connexion/use-connexion";
import { ConnexionForm } from "./connexion/ConnexionForm";
import { IconeCoche } from "./connexion/connexion-icones";
import "./connexion/connexion.css";

// Écran de connexion : panneau de marque (masqué sur mobile) + carte du
// formulaire. Logique dans useConnexion, styles dans connexion/connexion.css.
function Connexion({ onLogin, onInscription, onDecouvrir }) {
  const { t } = useTranslation();
  const c = useConnexion({ onLogin });

  return (
    <div className="cx-page">
      <div className="cx-shell">
        <aside className="cx-brand">
          <div dir="ltr" className="cx-brand-logo"><Logo width={180} height={58} variant="light" /></div>
          <div>
            <p className="cx-eyebrow">{t("auth.brandEyebrow")}</p>
            <h1>{t("auth.brandTitle")} <span>{t("auth.brandTitleAccent")}</span></h1>
            <p className="cx-brand-sub">{t("auth.brandSub")}</p>
            <ul className="cx-points">
              {["brandPoint1", "brandPoint2", "brandPoint3"].map((cle) => (
                <li key={cle}><IconeCoche />{t(`auth.${cle}`)}</li>
              ))}
            </ul>
          </div>
          <p className="cx-brand-foot">© {new Date().getFullYear()} EduGest · {t("auth.brandFoot")}</p>
        </aside>

        <ConnexionForm
          infoEcole={c.infoEcole}
          codeEcole={c.codeEcole}
          setCodeEcole={c.setCodeEcole}
          login={c.login}
          setLogin={c.setLogin}
          mdp={c.mdp}
          setMdp={c.setMdp}
          erreur={c.erreur}
          voir={c.voir}
          setVoir={c.setVoir}
          chargement={c.chargement}
          statutEcole={c.statutEcole}
          connecter={c.connecter}
          onInscription={onInscription}
          onDecouvrir={onDecouvrir}
        />
      </div>
    </div>
  );
}

export { Connexion };
