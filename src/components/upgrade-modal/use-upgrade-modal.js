import { useState, useEffect, useContext } from "react";
import { doc, addDoc, collection } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { safeOnSnapshot } from "../../firestore-safe";
import { SchoolContext } from "../../contexts/SchoolContext";
import { PLANS } from "../../contexts/PlanContext";
import { isSupabase } from "../../backend";
import { demanderPlan } from "../../backend/superadmin-supabase";

export function useUpgradeModal() {
  const { schoolId, schoolInfo, setSchoolInfo } = useContext(SchoolContext);
  const [etape, setEtape] = useState("choix"); // choix | instructions | soumission | attente | succes
  const [form, setForm] = useState({
    telephone: "", operateur: "Orange Money", reference: "", montant: "",
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Écoute temps réel : plan activé par le SuperAdmin
  useEffect(() => {
    if (etape !== "attente") return;
    const unsub = safeOnSnapshot(doc(db, "ecoles", schoolId), snap => {
      if (snap.exists() && snap.data().plan === "pro") {
        setSchoolInfo(prev => ({
          ...prev, plan: "pro", planExpiry: snap.data().planExpiry,
        }));
        setEtape("succes");
      }
    });
    return () => unsub();
  }, [etape, schoolId, setSchoolInfo]);

  const soumettreDemande = async () => {
    if (!form.telephone.trim()) { setErreur("Entrez votre numéro de téléphone."); return; }
    if (!form.reference.trim()) { setErreur("Entrez la référence/code de votre transaction."); return; }
    setChargement(true); setErreur("");
    try {
      const champs = {
        telephone: form.telephone.trim(),
        operateur: form.operateur,
        reference: form.reference.trim(),
        montant: PLANS.pro.prix,
        ecoleNom: schoolInfo?.nom || schoolId,
        createdAt: Date.now(),
      };
      if (isSupabase) {
        await demanderPlan(schoolId, "pro", champs);
      } else {
        await addDoc(collection(db, "ecoles", schoolId, "demandes_plan"), {
          ...champs, statut: "en_attente", schoolId,
        });
      }
      setEtape("attente");
    } catch {
      setErreur("Erreur lors de la soumission. Réessayez.");
    } finally {
      setChargement(false);
    }
  };

  return { schoolInfo, etape, setEtape, form, setForm, chargement, erreur, chg, soumettreDemande };
}
