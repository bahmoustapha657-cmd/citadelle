import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { runPromotion } from "../../admin-promotion";

// État et logique de la promotion de fin d'année : seuils, comportement
// "sans notes", simulation préalable puis application réelle.
// La vue reste dans PromotionCard.
export function usePromotionCard({ schoolId, schoolInfo, toast }) {
  // La promotion deplace TOUS les eleves d'une classe a l'autre et ne laissait
  // aucune trace : impossible de savoir qui l'avait lancee, quand, ni avec
  // quels seuils. C'est pourtant l'operation la moins reversible de l'annee.
  const { logAction } = useContext(SchoolContext);
  const [promoEn, setPromoEn] = useState(false);
  const [promoRes, setPromoRes] = useState(null);
  const [promoModal, setPromoModal] = useState(false);
  const [seuilCollege, setSeuilCollege] = useState(10);
  const [seuilPrimaire, setSeuilPrimaire] = useState(5);
  const [sansNotesBehavior, setSansNotesBehavior] = useState("promouvoir"); // "promouvoir" | "redoubler"

  const lancerPromotion = async (simulate = false) => {
    setPromoModal(false);
    setPromoEn(true);
    try {
      const res = await runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior, simulate });
      setPromoRes(res);
      if (simulate) {
        toast(`Simulation : ${res.promus} promus, ${res.redoublants} redoublants — aucune modification appliquée`, "info");
      } else {
        logAction(
          "Promotion de fin d'année",
          `${res.promus} promu(s), ${res.redoublants} redoublant(s), ${res.diplomes} diplômé(s) sur ${res.total}`
          + ` — seuils : primaire ${seuilPrimaire}, collège ${seuilCollege}`
          + ` — élèves sans notes : ${sansNotesBehavior === "promouvoir" ? "promus" : "redoublants"}`,
        );
        toast(`Promotion terminée — ${res.promus} promus, ${res.redoublants} redoublants`, "success");
      }
    } catch (e) {
      toast("Erreur lors de la promotion : " + e.message, "error");
    } finally {
      setPromoEn(false);
    }
  };

  return {
    promoEn, promoRes, setPromoRes, promoModal, setPromoModal,
    seuilCollege, setSeuilCollege, seuilPrimaire, setSeuilPrimaire,
    sansNotesBehavior, setSansNotesBehavior, lancerPromotion,
  };
}
