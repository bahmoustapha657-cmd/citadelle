import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { annulerCloture, cloturerAnnee } from "../cloture-annee";

// Changement d'année scolaire par la Direction : l'année qui se termine est
// archivée AUTOMATIQUEMENT (instantané de la scolarité sur chaque fiche, puis
// remise à zéro), et le résultat reste affiché avec un bouton d'annulation —
// l'opération doit rester réversible.
//
// Reculer d'une année ne clôture rien : c'est de la consultation.
export function useClotureAnnee({ schoolId, annee, setAnnee, toast }) {
  // Mois réels de l'école (elle peut démarrer en septembre) : la remise à
  // zéro doit écrire les bonnes clés de mois, pas la liste par défaut.
  const { moisAnnee } = useContext(SchoolContext);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // bilan de la dernière clôture
  const [annulation, setAnnulation] = useState(null); // bilan de la dernière annulation

  const changerAnnee = async (nouvelle) => {
    if (!nouvelle || nouvelle === annee) return;
    // Retour en arrière : simple consultation, aucune écriture.
    if (nouvelle < annee) { setAnnee(nouvelle); return; }
    setEnCours(true);
    try {
      const bilan = await cloturerAnnee({ schoolId, annee, moisAnnee });
      setAnnee(nouvelle);
      setResultat({ ...bilan, nouvelle });
      setAnnulation(null);
      toast(
        bilan.archives > 0
          ? `Année ${annee} clôturée — ${bilan.archives} fiche(s) archivée(s), compteurs remis à zéro.`
          : `Année ${annee} déjà clôturée — aucune fiche à archiver.`,
        "success",
      );
    } catch (e) {
      toast("Clôture impossible : " + e.message, "error");
    } finally {
      setEnCours(false);
    }
  };

  // Restaure l'instantané d'une année archivée. Écrase l'état courant : on
  // compte d'abord les fiches concernées et on demande confirmation.
  const annulerPour = async (anneeCible) => {
    if (!anneeCible) return;
    setEnCours(true);
    try {
      const apercu = await annulerCloture({ schoolId, annee: anneeCible, moisAnnee, simulate: true });
      if (!apercu.restaures) {
        toast(`Aucune archive trouvée pour ${anneeCible}.`, "warning");
        return;
      }
      const avertissement = apercu.ecrases > 0
        ? `\n\n⚠️ ${apercu.ecrases} élève(s) ont DÉJÀ des paiements enregistrés depuis : ces encaissements seront écrasés par l'état archivé.`
        : "";
      if (!confirm(`Restaurer l'année ${anneeCible} sur ${apercu.restaures} fiche(s) ?${avertissement}`)) return;
      const bilan = await annulerCloture({ schoolId, annee: anneeCible, moisAnnee });
      setAnnee(anneeCible);
      setAnnulation(bilan);
      setResultat(null);
      toast(`Clôture annulée — ${bilan.restaures} fiche(s) restaurée(s), année active revenue à ${anneeCible}.`, "success");
    } catch (e) {
      toast("Annulation impossible : " + e.message, "error");
    } finally {
      setEnCours(false);
    }
  };

  return { enCours, resultat, setResultat, annulation, setAnnulation, changerAnnee, annulerPour };
}
