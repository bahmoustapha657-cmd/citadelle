import {
  collection,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { app } from "./firebaseApp";

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const SCHOOL_ID = "citadelle";

export const schoolCol = (collectionName) =>
  collection(db, "ecoles", SCHOOL_ID, collectionName);

export const schoolDoc = (collectionName, docId) =>
  doc(db, "ecoles", SCHOOL_ID, collectionName, docId);
