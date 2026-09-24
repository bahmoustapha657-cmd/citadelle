import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { getAnnee } from "../../../constants";
import { runPromotion } from "../../admin-promotion";
import { etatCloture, etatPromotion } from "../cloture-annee-utils";

// État et logique de la promotion de fin d'année : seuils, comportement
// "sans notes", simulation préalable puis application réelle.
// La vue reste dans PromotionCard.
export function usePromotionCard({ schoolId, schoolInfo, toast }) {
  // La promotion deplace TOUS les eleves d'une classe a l'autre et ne laissait
  // aucune trace : impossible de savoir qui l'avait lancee, quand, ni avec
  // quels seuils. C'est pourtant l'operation la moins reversible de l'annee.
  const { logAction, setSchoolInfo } = useContext(SchoolContext);
  // Elle porte sur l'année qui vient d'être clôturée, une seule fois :
  // "possible" | "appliquee" | "attente" (cf. etatPromotion).
  const anneeOfficielle = schoolInfo?.anneeScolaire || getAnnee();
  const etat = etatPromotion(schoolInfo, anneeOfficielle);
  const clotureSuivante = etatCloture(anneeOfficielle, schoolInfo?.moisDebut);
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
        toast(`Simulation ${res.annee} : ${res.promus} promus, ${res.redoublants} redoublants — aucune modification appliquée`, "info");
      } else {
        setSchoolInfo((prec) => ({ ...prec, promotions: res.promotions }));
        logAction(
          `Promotion de fin d'année ${res.annee}`,
          `${res.promus} promu(s), ${res.redoublants} redoublant(s) sur ${res.total}`
          + ` — seuils : primaire ${seuilPrimaire}, collège ${seuilCollege}`
          + ` — élèves sans notes : ${sansNotesBehavior === "promouvoir" ? "promus" : "redoublants"}`,
        );
        toast(`Promotion ${res.annee} terminée — ${res.promus} promus, ${res.redoublants} redoublants`, "success");
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
    etat, anneeOfficielle, clotureSuivante,
  };
}
