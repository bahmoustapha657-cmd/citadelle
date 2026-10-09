import { useContext, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { C, getAnnee } from "../../constants";
import { creerDemandePlan } from "./tableau-de-bord-api";
import {
  calcTauxPaiement,
  computeEvenementsAVenir,
  computeFinances,
  computeMasseSalariale,
  computeTendance,
} from "./tableau-de-bord-derive";

// Charge toutes les collections du dashboard, calcule les indicateurs
// consolidés (effectifs, taux de paiement, finances, masse salariale,
// absences, événements) et gère la demande d'abonnement.
export function useTableauDeBord({ annee } = {}) {
  const { schoolId, schoolInfo, moisAnnee, moisSalaire, planInfo } = useContext(SchoolContext);
  const anneeCourante = annee || getAnnee();
  const { items: elevesC, chargement: cEC } = useFirestore("elevesCollege");
  const { items: elevesP, chargement: cEP } = useFirestore("elevesPrimaire");
  const { items: elevesL, chargement: cEL } = useFirestore("elevesLycee");
  // Préscolaire : sans lui, les effectifs du tableau de bord excluaient
  // silencieusement toute la maternelle (97 élèves à la citadelle).
  const { items: elevesPre, chargement: cEPre } = useFirestore("elevesPrescolaire");
  const { items: ensC } = useFirestore("ensCollege");
  const { items: ensL } = useFirestore("ensLycee");
  const { items: ensP } = useFirestore("ensPrimaire");
  const { items: ensPre } = useFirestore("ensPrescolaire");
  const { items: recettes } = useFirestore("recettes");
  const { items: depenses } = useFirestore("depenses");
  const { items: salaires } = useFirestore("salaires");
  const { items: evenements } = useFirestore("evenements");
  const { items: absences } = useFirestore("absencesCollege");
  const { items: absP } = useFirestore("absencesPrimaire");
  const { items: absL } = useFirestore("elevesLycee_absences");
  // Maternelle : ses absences manquaient à la tuile, aux tendances et aux
  // rapports mensuel et annuel.
  const { items: absPre } = useFirestore("elevesPrescolaire_absences");
  // Notes : utilisées uniquement par le rapport annuel pour la section
  // pédagogie. useFirestore = listener temps réel → coût acceptable car
  // le dashboard est l'écran d'atterrissage et ces collections sont
  // déjà cachées une fois la session ouverte. Celles de l'année affichée
  // seulement : sans filtre, la pédagogie du rapport mélangeait les notes
  // de toutes les années d'un élève (et la lecture grossissait chaque année).
  const { items: notesC } = useFirestore("notesCollege", { annee: anneeCourante });
  const { items: notesP } = useFirestore("notesPrimaire", { annee: anneeCourante });
  const { items: notesL } = useFirestore("notesLycee", { annee: anneeCourante });
  // Sans elles, les classes de maternelle restaient « non notées » dans le
  // rapport alors même que leurs effectifs y figurent.
  const { items: notesPre } = useFirestore("notesPrescolaire", { annee: anneeCourante });

  const [moisRapport, setMoisRapport] = useState(moisSalaire[moisSalaire.length - 1] || "");
  const [demandeOuverte, setDemandeOuverte] = useState(false);
  const [demandePlan, setDemandePlan] = useState("starter");
  const [demandeForm, setDemandeForm] = useState({ operateur: "Orange Money", telephone: "", reference: "" });
  const [demandeEnvoi, setDemandeEnvoi] = useState(false);
  const [demandeSucces, setDemandeSucces] = useState(false);

  const envoyerDemande = async () => {
    if (!demandeForm.telephone.trim() || !demandeForm.reference.trim()) return;
    setDemandeEnvoi(true);
    try {
      await creerDemandePlan({
        schoolId,
        ecoleNom: schoolInfo.nom,
        plan: demandePlan,
        form: demandeForm,
      });
      setDemandeSucces(true);
      // Ne pas fermer le formulaire — montrer le succès à l'intérieur
      setTimeout(() => { setDemandeSucces(false); setDemandeOuverte(false); setDemandeForm({ operateur: "Orange Money", telephone: "", reference: "" }); }, 5000);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi. Vérifiez votre connexion et réessayez.");
    } finally { setDemandeEnvoi(false); }
  };

  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const enChargement = cEC || cEP || cEL || cEPre;

  const actifs = (liste) => liste.filter((e) => e.statut === "Actif").length;
  const totalEleves = actifs(elevesC) + actifs(elevesL) + actifs(elevesP) + actifs(elevesPre);
  const totalEns = ensC.length + ensL.length + ensP.length + ensPre.length;
  const moisActuel = moisSalaire[moisSalaire.length - 1] || "";

  // Taux de paiement mensualités
  const tauxPayC = calcTauxPaiement(elevesC);
  const tauxPayL = calcTauxPaiement(elevesL);
  const tauxPayP = calcTauxPaiement(elevesP);
  const tauxPayPre = calcTauxPaiement(elevesPre);
  const tauxPay = calcTauxPaiement([...elevesC, ...elevesL, ...elevesP, ...elevesPre]);

  // Finances
  const { totalRec, totalDep, solde } = computeFinances(recettes, depenses);

  // Masse salariale mois courant
  const salMois = salaires.filter((s) => s.mois === moisActuel);
  const masseSal = computeMasseSalariale(salMois);

  // Événements à venir
  const evAVenir = computeEvenementsAVenir(evenements);

  // Absences ce mois
  const totalAbs = absences.length + absP.length + absL.length + absPre.length;

  // Tendances mensuelles (taux paiement + absences mois par mois)
  const dataTendance = computeTendance(moisAnnee, [...elevesC, ...elevesL, ...elevesP, ...elevesPre], [...absences, ...absP, ...absL, ...absPre]);

  return {
    schoolInfo, moisAnnee, planInfo, c1, c2, enChargement,
    elevesC, elevesP, elevesL, elevesPre, ensC, ensL, ensP, ensPre, tauxPayPre,
    recettes, depenses, salaires, notesC, notesP, notesL, notesPre,
    absences, absP, absL, absPre,
    moisRapport, setMoisRapport,
    demandeOuverte, setDemandeOuverte, demandePlan, setDemandePlan,
    demandeForm, setDemandeForm, demandeEnvoi, demandeSucces, envoyerDemande,
    totalEleves, totalEns, moisActuel,
    tauxPayC, tauxPayL, tauxPayP, tauxPay,
    totalRec, totalDep, solde, salMois, masseSal,
    evAVenir, totalAbs, dataTendance,
  };
}
