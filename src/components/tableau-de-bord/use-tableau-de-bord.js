import { useContext, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { C } from "../../constants";
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
export function useTableauDeBord() {
  const { schoolId, schoolInfo, moisAnnee, moisSalaire, planInfo } = useContext(SchoolContext);
  const { items: elevesC, chargement: cEC } = useFirestore("elevesCollege");
  const { items: elevesP, chargement: cEP } = useFirestore("elevesPrimaire");
  const { items: elevesL, chargement: cEL } = useFirestore("elevesLycee");
  const { items: ensC } = useFirestore("ensCollege");
  const { items: ensL } = useFirestore("ensLycee");
  const { items: ensP } = useFirestore("ensPrimaire");
  const { items: recettes } = useFirestore("recettes");
  const { items: depenses } = useFirestore("depenses");
  const { items: salaires } = useFirestore("salaires");
  const { items: evenements } = useFirestore("evenements");
  const { items: absences } = useFirestore("absencesCollege");
  const { items: absP } = useFirestore("absencesPrimaire");
  const { items: absL } = useFirestore("elevesLycee_absences");
  // Notes : utilisées uniquement par le rapport annuel pour la section
  // pédagogie. useFirestore = listener temps réel → coût acceptable car
  // le dashboard est l'écran d'atterrissage et ces collections sont
  // déjà cachées une fois la session ouverte.
  const { items: notesC } = useFirestore("notesCollege");
  const { items: notesP } = useFirestore("notesPrimaire");
  const { items: notesL } = useFirestore("notesLycee");

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
  const enChargement = cEC || cEP || cEL;

  const totalEleves = elevesC.filter((e) => e.statut === "Actif").length + elevesL.filter((e) => e.statut === "Actif").length + elevesP.filter((e) => e.statut === "Actif").length;
  const totalEns = ensC.length + ensL.length + ensP.length;
  const moisActuel = moisSalaire[moisSalaire.length - 1] || "";

  // Taux de paiement mensualités
  const tauxPayC = calcTauxPaiement(elevesC);
  const tauxPayL = calcTauxPaiement(elevesL);
  const tauxPayP = calcTauxPaiement(elevesP);
  const tauxPay = calcTauxPaiement([...elevesC, ...elevesL, ...elevesP]);

  // Finances
  const { totalRec, totalDep, solde } = computeFinances(recettes, depenses);

  // Masse salariale mois courant
  const salMois = salaires.filter((s) => s.mois === moisActuel);
  const masseSal = computeMasseSalariale(salMois);

  // Événements à venir
  const evAVenir = computeEvenementsAVenir(evenements);

  // Absences ce mois
  const totalAbs = absences.length + absP.length + absL.length;

  // Tendances mensuelles (taux paiement + absences mois par mois)
  const dataTendance = computeTendance(moisAnnee, [...elevesC, ...elevesL, ...elevesP], [...absences, ...absP, ...absL]);

  return {
    schoolInfo, moisAnnee, planInfo, c1, c2, enChargement,
    elevesC, elevesP, elevesL, ensC, ensL, ensP,
    recettes, depenses, salaires, notesC, notesP, notesL,
    absences, absP, absL,
    moisRapport, setMoisRapport,
    demandeOuverte, setDemandeOuverte, demandePlan, setDemandePlan,
    demandeForm, setDemandeForm, demandeEnvoi, demandeSucces, envoyerDemande,
    totalEleves, totalEns, moisActuel,
    tauxPayC, tauxPayL, tauxPayP, tauxPay,
    totalRec, totalDep, solde, salMois, masseSal,
    evAVenir, totalAbs, dataTendance,
  };
}
