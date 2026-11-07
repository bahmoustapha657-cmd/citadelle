import { getAvertissementSaisie } from "../evaluation-forms";

// Avertissement sous le choix du type de note (École et portail enseignant) :
// la forme choisie écarte les autres notes de la matière au lieu de s'y
// ajouter — Moyenne de la matière, rubriques du Français au collège.
export function AvisFormeNote({ type, style }) {
  const avis = getAvertissementSaisie(type);
  if (!avis) return null;
  return (
    <div role="note" style={{
      padding: "8px 10px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8,
      fontSize: 11.5, lineHeight: 1.45, color: "#92400e", ...style,
    }}>
      ⚠️ {avis}
    </div>
  );
}
