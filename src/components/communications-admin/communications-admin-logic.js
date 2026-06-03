// Logique pure du module Communications superadmin : répartition des écoles
// par plan, construction de la cible, validation du formulaire et aperçu.
import { PLANS } from "../../constants";

// Nombre d'écoles par plan d'abonnement.
export function computeEcolesParPlan(ecoles) {
  const map = {};
  ecoles.forEach((e) => {
    const plan = e.plan || "gratuit";
    map[plan] = (map[plan] || 0) + 1;
  });
  return map;
}

// Liste des écoles ciblées selon le mode (toutes / plan / sélection).
export function construireCibleSchools({ modeCible, ecoles, planChoisi, schoolsChoisies }) {
  if (modeCible === "toutes") return ["*"];
  if (modeCible === "plan") {
    return ecoles.filter((e) => (e.plan || "gratuit") === planChoisi).map((e) => e._id);
  }
  return schoolsChoisies;
}

// Valide le formulaire d'envoi. Renvoie un message d'erreur ou null si valide.
export function validerMessage({ titre, corps, rolesChoisis, cibleSchools }) {
  if (!titre.trim() || titre.trim().length < 3) return "Le titre doit faire au moins 3 caractères.";
  if (!corps.trim() || corps.trim().length < 5) return "Le message doit faire au moins 5 caractères.";
  if (rolesChoisis.length === 0) return "Choisissez au moins un rôle ciblé.";
  if (cibleSchools.length === 0) return "Aucune école ne correspond à la cible.";
  return null;
}

// Message de confirmation après envoi.
export function messageSucces(cibleSchools) {
  return `Message envoyé à ${cibleSchools[0] === "*" ? "toutes les écoles" : `${cibleSchools.length} école${cibleSchools.length > 1 ? "s" : ""}`}.`;
}

// Libellé d'aperçu de la cible courante.
export function buildPreviewCible({ modeCible, ecoles, planChoisi, ecolesParPlan, schoolsChoisies }) {
  if (modeCible === "toutes") return `Toutes les écoles (${ecoles.length})`;
  if (modeCible === "plan") {
    return `Plan ${PLANS[planChoisi]?.label || planChoisi} — ${ecolesParPlan[planChoisi] || 0} école(s)`;
  }
  return `${schoolsChoisies.length} école(s) sélectionnée(s)`;
}
