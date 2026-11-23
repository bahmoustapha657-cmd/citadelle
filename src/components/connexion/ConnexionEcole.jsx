import { useTranslation } from "react-i18next";
import { getAnnee } from "../../constants";

// Vignette d'identité de l'école, affichée dès que le code saisi est résolu.
// L'école a un code court (un mot de son nom) : il est rappelé ici, pour que
// la personne qui vient de taper le code long l'apprenne.
export function ConnexionEcole({ infoEcole }) {
  const { t } = useTranslation();
  if (!infoEcole) return null;
  const lieu = [infoEcole.ville, infoEcole.pays].filter(Boolean).join(", ");

  return (
    <div className="cx-ecole">
      {infoEcole.logo && <img crossOrigin="anonymous" src={infoEcole.logo} alt="" />}
      <div>
        <p className="cx-ecole-nom">{infoEcole.nom}</p>
        <p className="cx-ecole-lieu">{lieu ? `${lieu} · ${getAnnee()}` : getAnnee()}</p>
        {infoEcole.codeCourt && (
          <p className="cx-ecole-lieu">{t("auth.schoolCodeShort")} : <strong>{infoEcole.codeCourt}</strong></p>
        )}
      </div>
    </div>
  );
}
