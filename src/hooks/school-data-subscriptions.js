// Données d'école du hook useSchoolData. Stratégie « temps réel économe » :
// les COMPTEURS (élèves actifs, messages non lus) ne sont plus des listeners
// temps réel sur des collections entières (très coûteux en lectures Firestore),
// mais des lectures ciblées / agrégées à la demande. Seul le centre de
// notifications reste en temps réel (10 docs seulement).
import {
  collection, getCountFromServer, getDocs, limit, orderBy, query, where,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { safeOnSnapshot } from "../firestore-safe";

// Messages parents non lus : lecture CIBLÉE des seuls non-lus (au lieu de lire
// toute la collection en continu), puis filtre expéditeur en mémoire.
export async function countMessagesNonLus(schoolId) {
  try {
    const snap = await getDocs(
      query(collection(db, "ecoles", schoolId, "messages"), where("lu", "==", false)),
    );
    return snap.docs.filter((d) => d.data().expediteur === "parent").length;
  } catch {
    return 0;
  }
}

// Élèves actifs sur les 3 sections : requêtes d'AGRÉGATION (count) → ~3 lectures
// au lieu de la collection entière. Sert à la vérification du plan.
export async function countElevesActifs(schoolId) {
  const colls = ["elevesCollege", "elevesPrimaire", "elevesLycee"];
  try {
    const counts = await Promise.all(colls.map(async (coll) => {
      const agg = await getCountFromServer(
        query(collection(db, "ecoles", schoolId, coll), where("statut", "==", "Actif")),
      );
      return agg.data().count;
    }));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

// Centre de notifications : 10 dernières actions de l'historique. Reste en
// temps réel (limité à 10 docs → coût négligeable). Callback reçoit
// { liste, nonLues } (non lues = actions de moins de 5 minutes).
export function subscribeNotifications(schoolId, onData) {
  const q = query(collection(db, "ecoles", schoolId, "historique"), orderBy("date", "desc"), limit(10));
  return safeOnSnapshot(q, (snap) => {
    const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cinqMin = Date.now() - 5 * 60 * 1000;
    onData({ liste, nonLues: liste.filter((n) => n.date > cinqMin).length });
  });
}
