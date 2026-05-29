import { useConnexion } from "./connexion/use-connexion";
import { ConnexionHeader } from "./connexion/ConnexionHeader";
import { ConnexionForm } from "./connexion/ConnexionForm";

// Écran de connexion : logique dans useConnexion, en-tête et formulaire
// dans connexion/.
function Connexion({ onLogin, onInscription }) {
  const c = useConnexion({ onLogin });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A1628",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <ConnexionHeader infoEcole={c.infoEcole} />
        <ConnexionForm
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
        />
      </div>
    </div>
  );
}

export { Connexion };
