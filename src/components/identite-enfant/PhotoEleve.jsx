import { useState } from "react";
import { couleurClasse, initiales, nomAppel } from "../../identite-enfant";

// Vignette d'un enfant au format portrait : sa photo, ou ses initiales dans
// la couleur de son niveau quand la photo manque ou ne se charge pas (hors
// ligne et pas encore en cache). Avec `onClick`, un toucher l'agrandit.
// crossOrigin obligatoire : les photos Supabase passent par COEP require-corp.
export function PhotoEleve({ eleve = {}, largeur = 34, onClick, style }) {
  // URL qui a échoué : une nouvelle photo (autre URL) retente sa chance.
  const [echec, setEchec] = useState("");
  const photo = eleve.photo && eleve.photo !== echec ? eleve.photo : "";
  const couleur = couleurClasse(eleve.classe, "#64748b");
  const cadre = {
    width: largeur, height: Math.round((largeur * 5) / 4), flexShrink: 0,
    borderRadius: Math.max(6, Math.round(largeur / 7)), overflow: "hidden",
    border: `2px solid ${couleur}`, background: `${couleur}1a`, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: onClick ? "pointer" : "default", boxSizing: "border-box", ...style,
  };
  const contenu = photo
    ? <img crossOrigin="anonymous" src={photo} alt="" loading="lazy" decoding="async"
        onError={() => setEchec(photo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }}/>
    : <span style={{ fontSize: Math.max(10, Math.round(largeur * 0.34)), fontWeight: 900, color: couleur }}>{initiales(eleve)}</span>;
  if (!onClick) return <span style={cadre} aria-hidden="true">{contenu}</span>;
  return (
    <button type="button" onClick={() => onClick(eleve)} style={cadre}
      title={`Agrandir — ${nomAppel(eleve)}`} aria-label={`Agrandir la photo de ${nomAppel(eleve)}`}>
      {contenu}
    </button>
  );
}
