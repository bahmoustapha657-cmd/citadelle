import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { anneePrecedente } from "../../../constants";
import { annulerCloture, cloturerAnnee, majFicheEcole } from "../cloture-annee";
import { dateLongue, etatCloture, peutRouvrir } from "../cloture-annee-utils";

// Changement d'année scolaire par la Direction : l'année qui se termine est
// archivée AUTOMATIQUEMENT (instantané de la scolarité sur chaque fiche, puis
// remise à zéro), et le résultat reste affiché avec un bouton d'annulation —
// l'opération doit rester réversible.
//
// Seule l'année OFFICIELLE de l'école se clôture, une fois sa fin prévue
// passée, et vers l'année qui la suit immédiatement. Tout autre déplacement
// est de la consultation.
export function useClotureAnnee({ schoolId, annee, setAnnee, toast }) {
  // Mois réels de l'école (elle peut démarrer en septembre) : la remise à
  // zéro doit écrire les bonnes clés de mois, pas la liste par défaut.
  // `logAction` : la cloture et son annulation reecrivent la scolarite de TOUTES
  // les fiches. Elles ne laissaient aucune trace au journal — on ne pouvait ni
  // dater ni attribuer une operation de cette portee.
  const { moisAnnee, logAction, schoolInfo, setSchoolInfo, auteur } = useContext(SchoolContext);
  // `annee` n'est que l'année AFFICHÉE : ce peut être une année passée qu'on
  // consulte. On clôture l'année officielle, partagée par toute l'école.
  const anneeOfficielle = schoolInfo?.anneeScolaire || annee;
  const cloture = etatCloture(anneeOfficielle, schoolInfo?.moisDebut);
  // Seule la DERNIÈRE année clôturée peut être rouverte.
  const anneeRouvrable = anneePrecedente(anneeOfficielle);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // bilan de la dernière clôture
  const [annulation, setAnnulation] = useState(null); // bilan de la dernière annulation

  const changerAnnee = async (nouvelle) => {
    if (!nouvelle || nouvelle === annee) return;
    // Consultation — reculer, ou revenir vers l'année officielle : aucune
    // écriture, y compris sur l'année officielle (`persister: false`).
    // Avancer depuis une année consultée la CLÔTURAIT : une année ancienne
    // sans archive voyait l'état du jour figé sous son nom, et les paiements
    // en cours remis à zéro.
    if (nouvelle <= anneeOfficielle) { setAnnee(nouvelle, { persister: false }); return; }
    if (nouvelle !== cloture.suivante) {
      toast(`Une année à la fois : clôturez d'abord ${anneeOfficielle}.`, "warning");
      return;
    }
    // Clôturer une année en cours archivait des mois pas encore joués et
    // remettait à zéro les paiements de l'année — constaté à La Citadelle
    // (2026-2027 clôturée en août 2026, annulée dans la minute).
    if (!cloture.possible) {
      toast(`L'année ${anneeOfficielle} n'est pas terminée : clôture possible à partir du ${dateLongue(cloture.fin)}.`, "warning");
      return;
    }
    if (!confirm(`Clôturer l'année ${anneeOfficielle} et passer en ${nouvelle} ?\n\n`
      + "La scolarité de chaque élève (mois payés, frais, inscription) est archivée puis remise à zéro.\n"
      + "La promotion et le passage des admis de l'année deviendront possibles.")) return;
    setEnCours(true);
    try {
      const bilan = await cloturerAnnee({ schoolId, annee: anneeOfficielle, moisAnnee });
      // Nouvelle année et repère de clôture partent ENSEMBLE : c'est le repère
      // qui ouvre la promotion de l'année close.
      const clotures = {
        ...(schoolInfo?.clotures || {}),
        [anneeOfficielle]: { le: new Date().toISOString(), par: auteur || "" },
      };
      await majFicheEcole(schoolId, { anneeScolaire: nouvelle, clotures });
      setSchoolInfo((prec) => ({ ...prec, anneeScolaire: nouvelle, clotures }));
      setAnnee(nouvelle, { persister: false });
      setResultat({ ...bilan, nouvelle });
      logAction(`Cloture de l'annee ${anneeOfficielle}`, `${bilan.archives} fiche(s) archivee(s) sur ${bilan.total} — nouvelle annee : ${nouvelle}`);
      setAnnulation(null);
      toast(
        bilan.archives > 0
          ? `Année ${anneeOfficielle} clôturée — ${bilan.archives} fiche(s) archivée(s), compteurs remis à zéro.`
          : `Année ${anneeOfficielle} déjà clôturée — aucune fiche à archiver.`,
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
    if (anneeCible !== anneeRouvrable) {
      toast(`Seule la dernière année clôturée (${anneeRouvrable}) peut être rouverte.`, "warning");
      return;
    }
    if (!peutRouvrir(schoolInfo, anneeCible)) {
      toast(`Impossible de rouvrir ${anneeCible} : sa promotion ou le passage de ses admis a déjà été appliqué.`, "error");
      return;
    }
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
      const clotures = { ...(schoolInfo?.clotures || {}) };
      delete clotures[anneeCible];
      await majFicheEcole(schoolId, { anneeScolaire: anneeCible, clotures });
      setSchoolInfo((prec) => ({ ...prec, anneeScolaire: anneeCible, clotures }));
      setAnnee(anneeCible, { persister: false });
      setAnnulation(bilan);
      setResultat(null);
      logAction(
        `Annulation de la clôture ${anneeCible}`,
        `${bilan.restaures} fiche(s) restaurée(s)${apercu.ecrases > 0 ? ` — ${apercu.ecrases} avec des encaissements écrasés` : ""}`,
      );
      toast(`Clôture annulée — ${bilan.restaures} fiche(s) restaurée(s), année active revenue à ${anneeCible}.`, "success");
    } catch (e) {
      toast("Annulation impossible : " + e.message, "error");
    } finally {
      setEnCours(false);
    }
  };

  return {
    enCours, resultat, setResultat, annulation, setAnnulation, changerAnnee, annulerPour,
    anneeOfficielle, cloture, anneeRouvrable, rouvrable: peutRouvrir(schoolInfo, anneeRouvrable),
  };
}
