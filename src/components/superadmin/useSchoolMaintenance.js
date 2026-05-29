import { useState } from "react";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { db } from "../../firebaseDb";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";

const COLLECTIONS_ANNUELLES = [
  "notesPrimaire","notesCollege","notesLycee",
  "recettes","depenses","salaires","bons","versements","livrets",
];

// Opérations de maintenance plateforme : migration des données legacy sans
// champ `annee` et synchronisation publique des écoles. `setMsgSucces` sert
// au feedback transverse de l'orchestrateur.
export function useSchoolMaintenance(setMsgSucces) {
  const [backfillEnCours, setBackfillEnCours] = useState(false);
  const [migrationAnneeEnCours, setMigrationAnneeEnCours] = useState(false);

  const lancerMigrationAnnee = async () => {
    if(!confirm("Migrer toutes les données legacy sans champ `annee` ?\n\nL'année courante (config/annee) sera assignée à chaque doc des collections suivantes :\n- "+COLLECTIONS_ANNUELLES.join(", ")+"\n\nOpération sûre et idempotente (les docs ayant déjà `annee` sont ignorés).")) return;
    setMigrationAnneeEnCours(true);
    try {
      const snapAnnee = await getDoc(doc(db,"config","annee"));
      const annee = (snapAnnee.exists() && snapAnnee.data().valeur) || "2025-2026";
      const ecolesSnap = await getDocs(collection(db,"ecoles"));
      let totalMaj = 0;
      let totalSkipped = 0;
      let totalEcoles = 0;
      for(const ecoleDoc of ecolesSnap.docs) {
        const sid = ecoleDoc.id;
        totalEcoles++;
        for(const coll of COLLECTIONS_ANNUELLES) {
          const collSnap = await getDocs(collection(db,"ecoles",sid,coll));
          const aMigrer = collSnap.docs.filter(d => !d.data().annee);
          totalSkipped += collSnap.size - aMigrer.length;
          for(let i=0;i<aMigrer.length;i+=400) {
            const batch = writeBatch(db);
            for(const d of aMigrer.slice(i,i+400)) batch.update(d.ref,{annee});
            await batch.commit();
            totalMaj += Math.min(400, aMigrer.length-i);
          }
        }
      }
      setMsgSucces(`Migration terminée : ${totalMaj} doc(s) mis à jour, ${totalSkipped} ignoré(s) (déjà à jour), sur ${totalEcoles} école(s). Année assignée : ${annee}.`);
      setTimeout(() => setMsgSucces(""), 8000);
    } catch(e) {
      setMsgSucces(`Erreur migration : ${e?.message || "échec"}`);
      setTimeout(() => setMsgSucces(""), 6000);
    } finally {
      setMigrationAnneeEnCours(false);
    }
  };

  const lancerBackfillPublic = async () => {
    setBackfillEnCours(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const r = await apiFetch("/ecole-public-sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "backfill" }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsgSucces(`Synchronisation publique effectuee (${data.synced || 0} ecoles).`);
        setTimeout(() => setMsgSucces(""), 4000);
      } else {
        setMsgSucces(`Erreur: ${data.error || "echec backfill"}`);
        setTimeout(() => setMsgSucces(""), 4000);
      }
    } finally {
      setBackfillEnCours(false);
    }
  };

  return { backfillEnCours, migrationAnneeEnCours, lancerMigrationAnnee, lancerBackfillPublic };
}
