// ══════════════════════════════════════════════════════════════
//  Bulletins — helpers de présentation (mention, couleurs, n°, rang)
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";

export function getMention(moy, maxNote) {
  if (moy === "—" || moy == null || moy === "") return "Non évalué";
  const v = Number(moy);
  if (!Number.isFinite(v)) return "Non évalué";
  if (v >= maxNote * 0.8) return "Très Bien";
  if (v >= maxNote * 0.7) return "Bien";
  if (v >= maxNote * 0.6) return "Assez Bien";
  if (v >= maxNote * 0.5) return "Passable";
  return "Insuffisant";
}

export function getMentionColors(mention) {
  switch (mention) {
    case "Très Bien":  return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
    case "Bien":       return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
    case "Assez Bien": return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
    case "Passable":   return { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" };
    case "Insuffisant":return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
    default:           return { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" };
  }
}

export function getInitiales(eleve = {}) {
  const p = (eleve.prenom || "").trim()[0] || "";
  const n = (eleve.nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "•";
}

export function getNumeroBulletin(eleve, periode, schoolInfo, annee) {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const per = String(periode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const ref = eleve.matricule || (String(eleve._id || "").slice(-6).toUpperCase());
  return `BUL-${code}-${an}-${per}-${ref}`;
}

export function ordinalFr(rang) {
  return rang === 1 ? "er" : "e";
}
