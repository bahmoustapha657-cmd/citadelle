import {
  collection,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { app } from "./firebaseApp";

const isLocalhost =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ...(isLocalhost ? { experimentalAutoDetectLongPolling: true } : {}),
});

export const SCHOOL_ID = "citadelle";

export const schoolCol = (collectionName) =>
  collection(db, "ecoles", SCHOOL_ID, collectionName);

export const schoolDoc = (collectionName, docId) =>
  doc(db, "ecoles", SCHOOL_ID, collectionName, docId);
