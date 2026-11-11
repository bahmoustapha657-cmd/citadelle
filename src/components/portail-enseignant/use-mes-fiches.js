import { useState } from "react";
import { lienMesFiches } from "../../backend/pedagogue-supabase";

// Lien externe « Mes fiches » (Pédagogue) : ouverture en cours et message
// d'erreur, affiché sous l'en-tête du portail.
export function useMesFiches(uid) {
  const [ouverture, setOuverture] = useState(false);
  const [erreur, setErreur] = useState("");

  // Même onglet : une fenêtre ouverte depuis ici serait coupée par notre COOP.
  const ouvrir = async () => {
    if (ouverture) return;
    setOuverture(true);
    setErreur("");
    try {
      window.location.assign(await lienMesFiches(uid));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOuverture(false);
    }
  };

  return { ouvrir, erreur };
}
