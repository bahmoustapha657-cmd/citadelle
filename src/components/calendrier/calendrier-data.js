import { today } from "../../constants";

export const TYPES_EV = [
  { id: "exam",      label: "Examen / Composition", color: "#ef4444" },
  { id: "conge",     label: "Congé / Vacances",     color: "#10b981" },
  { id: "reunion",   label: "Réunion",              color: "#f59e0b" },
  { id: "evenement", label: "Événement scolaire",   color: "#8b5cf6" },
  { id: "autre",     label: "Autre",                color: "#6b7280" },
];

export const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// Type d'événement (avec fallback "Autre").
export function typeEv(id) {
  return TYPES_EV.find(t => t.id === id) || TYPES_EV[4];
}

// Regroupe les événements par mois (mois sans événement exclus).
export function getEvParMois(evenements) {
  return MOIS_LABELS.map((m, i) => ({
    mois: m, num: i,
    evs: evenements.filter(e => {
      if (!e.date) return false;
      return new Date(e.date).getMonth() === i;
    }).sort((a, b) => a.date > b.date ? 1 : -1),
  })).filter(m => m.evs.length > 0);
}

// Les 5 prochains événements à venir.
export function getProchains(evenements) {
  return evenements.filter(e => e.date && e.date >= today()).sort((a, b) => a.date > b.date ? 1 : -1).slice(0, 5);
}
