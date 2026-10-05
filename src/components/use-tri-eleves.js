import { useState } from "react";
import { CRITERES_TRI } from "../tri-eleves";

// Tri choisi par liste, mémorisé sur l'APPAREIL (comme le format des reçus) :
// la caisse peut garder « plus grand reste à payer » pendant que la direction
// reste en alphabétique.
const cle = (liste) => `LC_triEleves_${liste}`;

export function useTriEleves(liste) {
  const [critere, setCritereState] = useState(() => {
    try {
      const v = localStorage.getItem(cle(liste));
      return (CRITERES_TRI[liste] || []).some((c) => c.id === v) ? v : "alpha";
    } catch { return "alpha"; }
  });
  const setCritere = (v) => {
    setCritereState(v);
    try { localStorage.setItem(cle(liste), v); } catch { /* mode privé : non mémorisé */ }
  };
  return [critere, setCritere];
}
