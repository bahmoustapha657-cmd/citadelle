// Accès Firestore du module Communications superadmin : flux des messages,
// statistiques de lecture, envoi et suppression.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebaseDb";
import { safeOnSnapshot } from "../../firestore-safe";

// S'abonne au flux des messages superadmin (du plus récent au plus ancien).
export function subscribeMessages(onData) {
  const q = query(collection(db, "superadmin_messages"), orderBy("createdAt", "desc"));
  return safeOnSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ ...d.data(), _id: d.id })));
  });
}

// Agrège, par message, le nombre de lectures et d'écoles distinctes.
export async function fetchStatsLectures(messages) {
  const stats = {};
  await Promise.all(
    messages.map(async (m) => {
      try {
        const lectSnap = await getDocs(
          collection(db, "superadmin_messages", m._id, "lectures"),
        );
        const ecolesUniques = new Set();
        lectSnap.docs.forEach((d) => {
          const data = d.data();
          if (data?.schoolId) ecolesUniques.add(data.schoolId);
        });
        stats[m._id] = { lectures: lectSnap.size, ecoles: ecolesUniques.size };
      } catch {
        stats[m._id] = { lectures: 0, ecoles: 0 };
      }
    }),
  );
  return stats;
}

// Crée un nouveau message superadmin.
export function envoyerMessage({ titre, corps, niveau, cibleSchools, cibleRoles, auteur }) {
  return addDoc(collection(db, "superadmin_messages"), {
    titre,
    corps,
    niveau,
    cibleSchools,
    cibleRoles,
    auteur,
    createdAt: Date.now(),
  });
}

// Supprime un message superadmin.
export function supprimerMessageApi(id) {
  return deleteDoc(doc(db, "superadmin_messages", id));
}
