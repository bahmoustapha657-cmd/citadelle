import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebaseDb";

// Une collection → la section dont la périodicité s'y applique. notesPrimaire
// suit periodicitePrimaire, notesCollege/notesLycee suivent periodiciteSecondaire.
const NOTES_COLLECTIONS = [
  { name: "notesCollege",  section: "secondaire" },
  { name: "notesPrimaire", section: "primaire" },
  { name: "notesLycee",    section: "secondaire" },
];
const BATCH_LIMIT = 450; // marge sous la limite Firestore de 500

// Scanne les 3 collections de notes et retourne les périodes orphelines
// (présentes en base mais hors de la périodicité actuelle de la section
// correspondante). Une période "T1" peut être orpheline en secondaire si
// le DG est passé en semestre, mais reste valide en primaire — d'où le
// scan par section.
export async function collecterPeriodesOrphelines(schoolId, periodesParSection) {
  const compteur = new Map(); // periode -> nombre de notes
  for (const col of NOTES_COLLECTIONS) {
    const set = new Set(periodesParSection[col.section] || []);
    const snap = await getDocs(collection(db, "ecoles", schoolId, col.name));
    snap.forEach((d) => {
      const p = d.data().periode;
      if (!p || set.has(p)) return;
      compteur.set(p, (compteur.get(p) || 0) + 1);
    });
  }
  return [...compteur.entries()].map(([periode, count]) => ({ periode, count }));
}

// Applique le mapping : periode orpheline -> nouvelle (ou "_delete_")
export async function appliquerMapping(schoolId, mapping) {
  let totalMaj = 0;
  let totalSup = 0;
  for (const col of NOTES_COLLECTIONS) {
    const snap = await getDocs(collection(db, "ecoles", schoolId, col.name));
    let batch = writeBatch(db);
    let ops = 0;
    for (const d of snap.docs) {
      const p = d.data().periode;
      if (!p || !(p in mapping)) continue;
      const cible = mapping[p];
      const ref = doc(db, "ecoles", schoolId, col.name, d.id);
      if (cible === "_delete_") {
        batch.delete(ref);
        totalSup++;
      } else {
        batch.update(ref, { periode: cible });
        totalMaj++;
      }
      ops++;
      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  }
  return { totalMaj, totalSup };
}
