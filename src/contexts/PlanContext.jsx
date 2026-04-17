import { useContext, useState } from "react";
import { SchoolContext } from "./SchoolContext";

// ── Fonctionnalités par plan ────────────────────────────────
const FEATURES_GRATUIT = [
  "bulletins_base",
  "comptabilite_base",
  "calendrier",
  "eleves_50",
  "primaire_base",
  "secondaire_base",
];

export const LIMITES_GRATUIT = {
  eleves: 50,
};

export const PLANS = {
  gratuit: {
    label: "Plan Gratuit",
    prix: 0,
    couleur: "#6b7280",
    features: ["Jusqu'à 50 élèves", "Bulletins", "Comptabilité de base", "Calendrier"],
  },
  pro: {
    label: "Plan Pro",
    prix: 500000, // GNF/an
    prixMensuel: 50000,
    couleur: "#003d7a",
    features: [
      "Élèves illimités",
      "Export Excel",
      "Impressions illimitées",
      "Module Fondation",
      "Assistant IA (commentaires, documents)",
      "Multi-utilisateurs",
      "Support prioritaire",
    ],
  },
};

// ── Hook principal ──────────────────────────────────────────
export function usePlan() {
  const { schoolInfo } = useContext(SchoolContext);
  const [now] = useState(() => Date.now());
  const plan = schoolInfo?.plan || "gratuit";
  const expiry = schoolInfo?.planExpiry;
  const isExpired = expiry && now > expiry;
  const isPro = plan === "pro" && !isExpired;

  const canAccess = (feature) => {
    if (isPro) return true;
    return FEATURES_GRATUIT.includes(feature);
  };

  const joursRestants = () => {
    if (!expiry || !isPro) return null;
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  };

  return { plan, isPro, isExpired, canAccess, joursRestants };
}
