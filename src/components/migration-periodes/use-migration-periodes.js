import { useContext, useEffect, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { getSectionsActives } from "../../constants";
import { GROUPES_PERIODICITE, mappingParDefaut, periodesParGroupe } from "./migration-periodes-utils";
import { collecterPeriodesOrphelines, appliquerMapping } from "./migration-periodes-data";

// Logique de la migration des périodes orphelines : périodicité actuelle de
// chaque groupe (préscolaire, primaire, secondaire), scan initial des notes,
// mapping ancienne→nouvelle PAR GROUPE, application.
export function useMigrationPeriodes({ fermer }) {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const periodes = periodesParGroupe(schoolInfo, moisAnnee);
  // Rappel de la périodicité en tête du modal : seulement les groupes ouverts
  // dans l'école (une école sans maternelle n'a que faire de sa ligne). Le
  // scan, lui, couvre tout : une section fermée peut garder des notes.
  const actives = getSectionsActives(schoolInfo);
  const groupesAffiches = GROUPES_PERIODICITE.filter((g) => g.sections.some((s) => actives.includes(s)));
  const [chargement, setChargement] = useState(true);
  const [orphelines, setOrphelines] = useState([]);
  const [mapping, setMapping] = useState({}); // { "groupe/ancienne": nouvelleOuSuppression }
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const liste = await collecterPeriodesOrphelines(schoolId, periodes);
        if (annule) return;
        setOrphelines(liste);
        setMapping(mappingParDefaut(liste, periodes));
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
      const { totalMaj, totalSup, nonTraitees, erreurs } = await appliquerMapping(schoolId, orphelines, mapping, periodes);
      const fait = `${totalMaj} note(s) mise(s) à jour, ${totalSup} supprimée(s)`;
      if (erreurs.length) {
        // Une partie a pu aboutir : on referme, la réouverture rescanne ce qui reste.
        const autres = erreurs.length > 1 ? ` (+${erreurs.length - 1} autre(s))` : "";
        toast(`Migration incomplète — ${fait}. Échec : ${erreurs[0]}${autres}. Rouvrez l'outil pour reprendre.`, "danger");
      } else if (nonTraitees) {
        toast(`Migration effectuée : ${fait}. ${nonTraitees} note(s) laissée(s) en place : droits d'écriture insuffisants sur leur section ?`, "warning");
      } else {
        toast(`Migration effectuée : ${fait}.`, "success");
      }
      fermer();
    } catch (e) {
      toast("Échec migration : " + (e.message || e), "danger");
    } finally {
      setEnCours(false);
    }
  };

  return { groupesAffiches, periodes, chargement, orphelines, mapping, setMapping, enCours, lancer };
}
