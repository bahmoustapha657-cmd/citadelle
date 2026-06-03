// Listeners Firestore du hook useSchoolData : messages non lus, comptage des
// élèves actifs et centre de notifications. Chaque fonction renvoie un unsub.
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebaseDb";
import { safeOnSnapshot } from "../firestore-safe";

// Badge des messages parents non lus.
export function subscribeMessagesNonLus(schoolId, onCount) {
  return safeOnSnapshot(collection(db, "ecoles", schoolId, "messages"), (snap) => {
    onCount(snap.docs.filter((d) => d.data().expediteur === "parent" && !d.data().lu).length);
  });
}

// Comptage des élèves actifs sur les trois sections (vérification du plan).
export function subscribeElevesActifs(schoolId, onTotal) {
  const colls = ["elevesCollege", "elevesPrimaire", "elevesLycee"];
  const counts = { elevesCollege: 0, elevesPrimaire: 0, elevesLycee: 0 };
  const unsubs = colls.map((coll) =>
    safeOnSnapshot(collection(db, "ecoles", schoolId, coll), (snap) => {
      counts[coll] = snap.docs.filter((d) => d.data().statut === "Actif").length;
      onTotal(Object.values(counts).reduce((a, b) => a + b, 0));
    }),
  );
  return () => unsubs.forEach((u) => u());
}

// Centre de notifications : 10 dernières actions de l'historique. Le callback
// reçoit { liste, nonLues } (non lues = actions de moins de 5 minutes).
export function subscribeNotifications(schoolId, onData) {
  const q = query(collection(db, "ecoles", schoolId, "historique"), orderBy("date", "desc"), limit(10));
  return safeOnSnapshot(q, (snap) => {
    const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cinqMin = Date.now() - 5 * 60 * 1000;
    onData({ liste, nonLues: liste.filter((n) => n.date > cinqMin).length });
  });
}
