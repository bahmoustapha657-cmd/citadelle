import { C, getAnnee } from "../../constants";
import Logo from "../../Logo";

// En-tête de la carte de connexion : logo, slogan, et la vignette
// d'identité de l'école dès qu'elle est résolue.
export function ConnexionHeader({ infoEcole }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)`,
        padding: "32px 36px 28px",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <Logo width={220} height={70} variant="light" />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Gestion scolaire intelligente
      </p>

      {infoEcole && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "center",
          }}
        >
          {infoEcole.logo && (
            <img
              src={infoEcole.logo}
              alt="logo ecole"
              style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
            />
          )}
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: infoEcole.couleur2 || C.green }}>
              {infoEcole.nom}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
              {infoEcole.ville}, {infoEcole.pays} - {getAnnee()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
