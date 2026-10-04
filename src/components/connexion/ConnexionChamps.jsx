import { IconeCadenas, IconeEcole, IconeOeil, IconeOeilBarre, IconeUtilisateur } from "./connexion-icones";

// Trois champs de connexion : code école (+ statut), identifiant et mot de
// passe avec bascule afficher/masquer (Entrée = submit du <form> parent). Le lien
// « mot de passe oublié » (lienOubli) se place sur la ligne du libellé.
export function ConnexionChamps({
  t, codeEcole, setCodeEcole, login, setLogin, mdp, setMdp,
  voir, setVoir, statutEcole, lienOubli,
}) {
  return (
    <>
      <div>
        <label className="cx-label" htmlFor="cx-code">{t("auth.schoolCode")}</label>
        <div className="cx-field">
          <IconeEcole className="cx-field-icon" />
          <input
            id="cx-code"
            className="cx-input"
            value={codeEcole}
            onChange={(event) => setCodeEcole(event.target.value)}
            placeholder={t("auth.schoolCodePlaceholder")}
            autoComplete="organization"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        {statutEcole && (
          <p className="cx-alerte">
            {statutEcole === "inactive" ? "Cette école est inactive." : "Cette école n'est plus disponible."}
          </p>
        )}
      </div>

      <div>
        <label className="cx-label" htmlFor="cx-login">{t("auth.username")}</label>
        <div className="cx-field">
          <IconeUtilisateur className="cx-field-icon" />
          <input
            id="cx-login"
            className="cx-input"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder={t("auth.usernamePlaceholder")}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      </div>

      <div>
        <div className="cx-label-row">
          <label className="cx-label" htmlFor="cx-mdp">{t("auth.password")}</label>
          {lienOubli}
        </div>
        <div className="cx-field">
          <IconeCadenas className="cx-field-icon" />
          <input
            id="cx-mdp"
            className="cx-input cx-input--mdp"
            value={mdp}
            onChange={(event) => setMdp(event.target.value)}
            type={voir ? "text" : "password"}
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="cx-oeil"
            onClick={() => setVoir((value) => !value)}
            aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={voir ? "Masquer" : "Afficher"}
          >
            {voir ? <IconeOeilBarre /> : <IconeOeil />}
          </button>
        </div>
      </div>
    </>
  );
}
