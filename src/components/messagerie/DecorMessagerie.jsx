// Décor de la messagerie EduGest : motifs d'école (écusson au livre ouvert,
// crayon, toque, cloche…) répétés en filigrane derrière les messages.
// Le dessin (public/decor-messagerie.svg) sert de MASQUE : seule sa forme
// compte, la couleur est celle de l'école et suit le mode clair ou sombre.
// Purement décoratif : ne capte ni le toucher ni les lecteurs d'écran.
export const DECOR_URL = "/decor-messagerie.svg";

const masque = `url(${DECOR_URL})`;

export function DecorMessagerie({ opacite = 0.13 }) {
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, pointerEvents: "none", opacity: opacite,
      backgroundColor: "var(--msg-accent, var(--sc1))",
      WebkitMaskImage: masque, maskImage: masque,
      WebkitMaskSize: "360px 360px", maskSize: "360px 360px",
      WebkitMaskRepeat: "repeat", maskRepeat: "repeat",
    }} />
  );
}
