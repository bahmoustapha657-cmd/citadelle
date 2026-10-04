import { getAnnee } from "../../constants";

// Vignette d'identité de l'école, affichée dès que le code saisi est résolu.
export function ConnexionEcole({ infoEcole }) {
  if (!infoEcole) return null;
  const lieu = [infoEcole.ville, infoEcole.pays].filter(Boolean).join(", ");

  return (
    <div className="cx-ecole">
      {infoEcole.logo && <img crossOrigin="anonymous" src={infoEcole.logo} alt="" />}
      <div>
        <p className="cx-ecole-nom">{infoEcole.nom}</p>
        <p className="cx-ecole-lieu">{lieu ? `${lieu} · ${getAnnee()}` : getAnnee()}</p>
      </div>
    </div>
  );
}
