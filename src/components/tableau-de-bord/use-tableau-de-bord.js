import { useContext, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { C } from "../../constants";

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
      await addDoc(collection(db, "ecoles", schoolId, "demandes_plan"), {
        ecoleNom: schoolInfo.nom,
        planDemande: demandePlan,
        operateur: demandeForm.operateur,
        telephone: demandeForm.telephone.trim(),
        reference: demandeForm.reference.trim(),
        statut: "en_attente",
        createdAt: Date.now(),
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
  const calcTauxPaiement = (eleves) => {
    if (!eleves.length) return 0;
    const mois = Object.keys((eleves[0]?.mens || {}));
    if (!mois.length) return 0;
    const total = eleves.length * mois.length;
    const payes = eleves.reduce((s, e) => s + Object.values(e.mens || {}).filter((v) => v === "Payé").length, 0);
    return total > 0 ? Math.round(payes / total * 100) : 0;
  };
  const tauxPayC = calcTauxPaiement(elevesC);
  const tauxPayL = calcTauxPaiement(elevesL);
  const tauxPayP = calcTauxPaiement(elevesP);
  const tauxPay = calcTauxPaiement([...elevesC, ...elevesL, ...elevesP]);

  // Finances
  const totalRec = recettes.reduce((s, r) => s + Number(r.montant || 0), 0);
  const totalDep = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
  const solde = totalRec - totalDep;

  // Masse salariale mois courant
  const salMois = salaires.filter((s) => s.mois === moisActuel);
  const masseSal = salMois.reduce((s, sal) => {
    const baseSec = (sal.montantBrut !== undefined && sal.montantBrut !== null && Number.isFinite(Number(sal.montantBrut)))
      ? Number(sal.montantBrut)
      : Number(sal.vhExecute || 0) * Number(sal.primeHoraire || 0)
        + Number(sal.cinqSem || 0) * Number(sal.primeHoraire || 0);
    const net = baseSec
      + Number(sal.bon || 0)
      + Number(sal.revision || 0)
      + Number(sal.montantForfait || 0);
    return s + net;
  }, 0);

  // Événements à venir
  const today = new Date().toISOString().slice(0, 10);
  const evAVenir = evenements.filter((e) => e.date && e.date >= today).sort((a, b) => (a.date > b.date ? 1 : -1)).slice(0, 4);

  // Absences ce mois
  const totalAbs = absences.length + absP.length + absL.length;

  // Tendances mensuelles (taux paiement + absences mois par mois)
  const tousEleves = [...elevesC, ...elevesL, ...elevesP];
  const dataTendance = moisAnnee.map((m) => {
    const payesMois = tousEleves.filter((e) => (e.mens || {})[m] === "Payé").length;
    const taux = tousEleves.length ? Math.round(payesMois / tousEleves.length * 100) : 0;
    const absencesMois = [...absences, ...absP, ...absL].filter((a) => {
      try { return new Date(a.date).toLocaleDateString("fr-FR", { month: "long" }).toLowerCase() === m.toLowerCase(); } catch { return false; }
    }).length;
    return { mois: m.slice(0, 3), taux, absences: absencesMois, payes: payesMois };
  });

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
