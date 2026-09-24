import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { anneePrecedente, getAnnee } from "../../../constants";
import { runPassageAdmis } from "../../admin-promotion";

// Passage des admis aux examens de l'année clôturée : simulation, puis
// application. Rejouable à mesure que les résultats arrivent (CEE, BEPC,
// BAC) — un élève déjà passé n'est plus concerné.
export function usePassageAdmis({ schoolId, schoolInfo, toast }) {
  const { logAction, setSchoolInfo } = useContext(SchoolContext);
  const annee = anneePrecedente(schoolInfo?.anneeScolaire || getAnnee());
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  const lancer = async (simulate = false) => {
    if (!simulate && resultat?.simulation && !confirm(
      `Appliquer le passage des admis ${annee} ?\n\n`
      + `${resultat.passes} élève(s) passent en classe supérieure, ${resultat.diplomes} deviennent « Diplômé ».`,
    )) return;
    setEnCours(true);
    try {
      const res = await runPassageAdmis({ schoolId, schoolInfo, simulate });
      setResultat(res);
      if (simulate) {
        toast(`Simulation ${res.annee} : ${res.passes} admis passent, ${res.diplomes} diplômé(s) — aucune modification appliquée`, "info");
        return;
      }
      if (res.passagesAdmis) setSchoolInfo((prec) => ({ ...prec, passagesAdmis: res.passagesAdmis }));
      logAction(
        `Passage des admis ${res.annee}`,
        `${res.passes} passé(s), ${res.diplomes} diplômé(s), ${res.refuses} refusé(s), ${res.attente} sans résultat`,
      );
      toast(`Passage des admis ${res.annee} — ${res.passes} passé(s), ${res.diplomes} diplômé(s)`, "success");
    } catch (e) {
      toast("Erreur lors du passage des admis : " + e.message, "error");
    } finally {
      setEnCours(false);
    }
  };

  return { annee, enCours, resultat, setResultat, lancer };
}
