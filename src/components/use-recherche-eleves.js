import { useState } from "react";
import { getSectionLabel, isSectionActive } from "../constants";
import { CRITERES_RECHERCHE, rechercheActive, rechercherEleves, termesSansResultat } from "../recherche-eleves";

// Recherche d'une liste d'élèves (cf. recherche-eleves.js). Le critère est
// mémorisé sur l'APPAREIL, comme le tri : la caisse qui cherche toujours par
// numéro de tuteur le retrouve ouvert. La saisie, elle, repart vide.
const cle = (liste) => `LC_rechercheEleves_${liste}`;
const SECTIONS = ["college", "lycee", "primaire", "prescolaire"];

export function useRechercheEleves(liste) {
  const [saisie, setSaisie] = useState("");
  const [critere, setCritereState] = useState(() => {
    try {
      const v = localStorage.getItem(cle(liste));
      return CRITERES_RECHERCHE.some((c) => c.id === v) ? v : "tout";
    } catch { return "tout"; }
  });
  const setCritere = (v) => {
    setCritereState(v);
    try { localStorage.setItem(cle(liste), v); } catch { /* mode privé : non mémorisé */ }
  };
  const active = rechercheActive(saisie);
  const filtrer = (eleves) => rechercherEleves(eleves, saisie, critere);

  // Pistes quand la recherche trouve aussi hors de la vue : les autres classes
  // de la section (si une classe est choisie), puis les autres sections
  // ouvertes — un aîné au collège, un cadet au primaire. Les paiements
  // s'écrivent dans la collection de la section affichée : on y va d'un clic
  // plutôt que de mêler les sections dans une même liste.
  const pistes = ({ nbDansClasse, classe, elevesSection = [], section, elevesParSection = {}, schoolInfo, toutesClasses, changerSection }) => {
    if (!active) return [];
    const r = [];
    if (classe !== "all") {
      const n = filtrer(elevesSection).length - nbDansClasse;
      if (n > 0) r.push({ cle: "classes", label: "Autres classes", n, aller: toutesClasses });
    }
    for (const s of SECTIONS) {
      if (s === section || !isSectionActive(schoolInfo, s)) continue;
      const n = filtrer(elevesParSection[s] || []).length;
      if (n > 0) r.push({ cle: s, label: getSectionLabel(s), n, aller: () => changerSection(s) });
    }
    return r;
  };

  return {
    saisie, setSaisie, critere, setCritere, active, filtrer, pistes,
    sansResultat: (eleves) => termesSansResultat(eleves, saisie, critere),
  };
}
