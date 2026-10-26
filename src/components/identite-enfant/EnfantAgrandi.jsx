import { couleurClasse, nettoyerSurnom, nomAppel, nomOfficiel } from "../../identite-enfant";
import { Modale } from "../ui";
import { PhotoEleve } from "./PhotoEleve";

// Un enfant en grand : sa photo, le nom auquel il répond, son nom officiel,
// sa classe et sa famille (filiation, tuteur) — de quoi le reconnaître ou le
// confier à la bonne personne. Pas de téléphone : la fiche reste à l'école.
// `actions` : boutons propres à l'écran appelant (badge, photo…).
export function EnfantAgrandi({ eleve, fermer, actions = null }) {
  if (!eleve) return null;
  const couleur = couleurClasse(eleve.classe, "#0A1628");
  const ligne = (libelle, valeur) => valeur ? (
    <div style={{ fontSize: 13, color: "var(--lc-text)" }}>
      <span style={{ color: "var(--lc-text-muted)", fontWeight: 700 }}>{libelle} : </span>{valeur}
    </div>
  ) : null;
  return (
    <Modale titre={nomAppel(eleve)} fermer={fermer}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <PhotoEleve eleve={eleve} largeur={200}/>
        <div style={{ fontSize: 28, fontWeight: 900, color: couleur, lineHeight: 1.1 }}>{nomAppel(eleve)}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--lc-text)" }}>{nomOfficiel(eleve)}</div>
        {eleve.classe && <span style={{ background: couleur, color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 800 }}>{eleve.classe}</span>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {ligne("Surnom", nettoyerSurnom(eleve.surnom))}
          {ligne("Filiation", eleve.filiation)}
          {ligne("Tuteur", eleve.tuteur)}
          {ligne("Matricule", eleve.matricule)}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>{actions}</div>}
      </div>
    </Modale>
  );
}
