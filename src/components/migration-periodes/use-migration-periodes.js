import { useContext, useEffect, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { getPeriodesForSection } from "../../period-utils";
import { collecterPeriodesOrphelines, appliquerMapping } from "./migration-periodes-data";

// Logique de la migration des périodes orphelines : calcul de la périodicité
// actuelle, scan initial des notes, mapping ancienne→nouvelle, application.
export function useMigrationPeriodes({ fermer }) {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const periodesParSection = {
    primaire: getPeriodesForSection(schoolInfo, "primaire", moisAnnee),
    secondaire: getPeriodesForSection(schoolInfo, "secondaire", moisAnnee),
  };
  // Union des deux pour les selects de mapping (l'enseignant peut vouloir
  // mapper une période orpheline vers T1 OU S1 selon la section).
  const periodesActuelles = [...new Set([...periodesParSection.primaire, ...periodesParSection.secondaire])];
  const [chargement, setChargement] = useState(true);
  const [orphelines, setOrphelines] = useState([]);
  const [mapping, setMapping] = useState({}); // { ancienne: nouvelleOuDelete }
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const liste = await collecterPeriodesOrphelines(schoolId, periodesParSection);
        if (annule) return;
        setOrphelines(liste);
        const initial = {};
        liste.forEach((o) => { initial[o.periode] = periodesActuelles[0] || "_delete_"; });
        setMapping(initial);
      } catch (e) {
        toast("Erreur lors du scan des notes : " + (e.message || e), "danger");
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const lancer = async () => {
    if (!Object.keys(mapping).length) return;
    if (!confirm("Confirmer la migration ? Cette opération modifiera vos notes en base et est irréversible.")) return;
    setEnCours(true);
    try {
      const { totalMaj, totalSup } = await appliquerMapping(schoolId, mapping);
      toast(`Migration effectuée : ${totalMaj} note(s) mise(s) à jour, ${totalSup} supprimée(s).`, "success");
      fermer();
    } catch (e) {
      toast("Échec migration : " + (e.message || e), "danger");
    } finally {
      setEnCours(false);
    }
  };

  return { periodesActuelles, chargement, orphelines, mapping, setMapping, enCours, lancer };
}
