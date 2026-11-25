// Rangement des notes quand la périodicité change — orchestration.
//
// Avant : changer la périodicité, enregistrer, puis penser à ouvrir l'outil
// « Migrer les notes existantes » et y choisir une destination par période
// (proposée d'office : la 1re période, donc T1, T2 et T3 fusionnés dans S1).
// Maintenant : à l'enregistrement, l'application regarde elle-même les notes
// déjà saisies cette année ; s'il y en a à ranger, une seule fenêtre montre où
// elles vont et ne pose de question que pour une période à cheval. Les années
// passées gardent leur périodicité (figée), leurs notes ne sont pas réécrites.
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../contexts/SchoolContext";
import { calcMoisAnnee, getAnnee } from "../../constants";
import { getSchoolPeriodiciteForSection } from "../../period-utils";
import {
  GROUPES_PERIODICITE, anneesAFiger, figerPeriodicite, groupesARevoir, periodesParGroupe, proposerRangement,
} from "./migration-periodes-utils";
import { analyserRangement, appliquerMapping } from "./migration-periodes-data";

const TOUS_LES_GROUPES = GROUPES_PERIODICITE.map((g) => g.groupe);

export function useRangementNotes() {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const { t } = useTranslation();
  const [rangement, setRangement] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const anneeCourante = schoolInfo?.anneeScolaire || getAnnee();

  // Appelé avant d'enregistrer `form`. Renvoie { ouvert: true } quand la
  // fenêtre s'ouvre (l'enregistrement attend la réponse de la direction),
  // sinon { reglagesAnnees } à enregistrer avec les paramètres (undefined :
  // aucune année passée à figer). Lève une erreur si les notes n'ont pas pu
  // être lues : rien ne doit alors être enregistré.
  const preparer = async (form) => {
    const moisApres = calcMoisAnnee(form.moisDebut);
    const periodes = periodesParGroupe(form, moisApres);
    const groupes = groupesARevoir(periodesParGroupe(schoolInfo, moisAnnee), periodes);
    if (!groupes.length) return {};
    let analyse;
    try {
      analyse = await analyserRangement(schoolId, { groupes, periodes, anneeCourante, toutesAnnees: true });
    } catch (e) {
      throw new Error(t("rangementNotes.echecAnalyse", { message: e.message || String(e) }));
    }
    const anneesFigees = anneesAFiger(analyse.annees, anneeCourante, schoolInfo?.reglagesAnnees);
    const reglagesAnnees = figerPeriodicite(schoolInfo, anneesFigees);
    if (!analyse.orphelines.length) return { reglagesAnnees };
    setRangement({
      mode: "enregistrement",
      annee: anneeCourante,
      periodes,
      propositions: proposerRangement(analyse.orphelines, periodes, moisApres),
      changements: groupes
        .map((groupe) => ({
          groupe,
          avant: getSchoolPeriodiciteForSection(schoolInfo, groupe),
          apres: getSchoolPeriodiciteForSection(form, groupe),
        }))
        .filter((c) => c.avant !== c.apres),
      anneesFigees,
      reglagesAnnees,
    });
    return { ouvert: true };
  };

  // Lien « Vérifier les notes de cette année » : notes de l'année restées
  // sous une autre périodicité (changement fait avant cet outil, notes
  // venues d'un espace enseignant rattaché…), rangées selon le réglage actuel.
  const verifier = async () => {
    setEnCours(true);
    try {
      const periodes = periodesParGroupe(schoolInfo, moisAnnee);
      const { orphelines } = await analyserRangement(schoolId, { groupes: TOUS_LES_GROUPES, periodes, anneeCourante });
      if (!orphelines.length) {
        toast(t("rangementNotes.toutEnOrdre", { annee: anneeCourante }), "success");
        return;
      }
      setRangement({
        mode: "verification",
        annee: anneeCourante,
        periodes,
        propositions: proposerRangement(orphelines, periodes, moisAnnee),
        changements: [],
        anneesFigees: [],
      });
    } catch (e) {
      toast(t("rangementNotes.echecVerification", { message: e.message || String(e) }), "danger");
    } finally {
      setEnCours(false);
    }
  };

  // `enregistrer(extra)` : l'enregistrement des paramètres, fourni par l'écran
  // (mode « enregistrement » seulement). Les paramètres d'abord : si les
  // notes partaient avant et que l'enregistrement échouait, elles porteraient
  // des périodes que l'école n'utilise pas encore.
  const confirmer = async (choix, enregistrer) => {
    const r = rangement;
    if (!r) return;
    setEnCours(true);
    try {
      if (r.mode === "enregistrement") {
        try {
          await enregistrer({ reglagesAnnees: r.reglagesAnnees });
        } catch (e) {
          // Rien n'est parti : la fenêtre reste ouverte, on peut réessayer.
          toast(t("rangementNotes.echecEnregistrement", { message: e.message || String(e) }), "danger");
          return;
        }
      }
      const { totalMaj, nonTraitees, erreurs } = await appliquerMapping(schoolId, r.propositions, choix, r.periodes, r.annee);
      if (erreurs.length) {
        toast(t("rangementNotes.incomplet", { nombre: totalMaj, erreur: erreurs[0] }), "danger");
      } else if (nonTraitees) {
        toast(t("rangementNotes.nonTraitees", { nombre: totalMaj, reste: nonTraitees }), "warning");
      } else {
        toast(t("rangementNotes.fait", { nombre: totalMaj }), "success");
      }
      setRangement(null);
    } catch (e) {
      toast(t("rangementNotes.echec", { message: e.message || String(e) }), "danger");
      setRangement(null);
    } finally {
      setEnCours(false);
    }
  };

  const annuler = () => { if (!enCours) setRangement(null); };

  return { rangement, enCours, preparer, verifier, confirmer, annuler };
}
