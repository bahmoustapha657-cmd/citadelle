import { getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyClG9mTtFdLpQX7QSP8iDNvyDMQem01Hq4",
  authDomain: "citadelle-school.firebaseapp.com",
  projectId: "citadelle-school",
  storageBucket: "citadelle-school.firebasestorage.app",
  messagingSenderId: "342805340277",
  appId: "1:342805340277:web:1676d75ca70d80fd73d83c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Mode hors-ligne : cache local IndexedDB
enableIndexedDbPersistence(db).catch(()=>{});
// ✅ Multi-tenant helper
export const SCHOOL_ID = "citadelle";

export const schoolCol = (collectionName) =>
  collection(db, "ecoles", SCHOOL_ID, collectionName);

export const schoolDoc = (collectionName, docId) =>
  doc(db, "ecoles", SCHOOL_ID, collectionName, docId);
export const auth = getAuth(app);