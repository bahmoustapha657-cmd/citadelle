import { getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyClG9mTtFdLpQX7QSP8iDNvyDMQem01Hq4",
  authDomain: "citadelle-school.firebaseapp.com",
  projectId: "citadelle-school",
  storageBucket: "citadelle-school.firebasestorage.app",
  messagingSenderId: "342805340277",
  appId: "1:342805340277:web:1676d75ca70d80fd73d83c"
};

const app = initializeApp(firebaseConfig);
// Cache IndexedDB persistant + synchro multi-onglets
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
// ✅ Multi-tenant helper
export const SCHOOL_ID = "citadelle";

export const schoolCol = (collectionName) =>
  collection(db, "ecoles", SCHOOL_ID, collectionName);

export const schoolDoc = (collectionName, docId) =>
  doc(db, "ecoles", SCHOOL_ID, collectionName, docId);
export const auth = getAuth(app);