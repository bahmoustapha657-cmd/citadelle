import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyClG9mTtFdLpQX7QSP8iDNvyDMQem01Hq4",
  authDomain: "citadelle-school.firebaseapp.com",
  projectId: "citadelle-school",
  // storageBucket retiré : plus aucun fichier ne transite par Firebase Storage
  // (liquidation, lot 1). Les photos et logos vivent dans le bucket Supabase.
  messagingSenderId: "342805340277",
  appId: "1:342805340277:web:1676d75ca70d80fd73d83c",
};

export const app = initializeApp(firebaseConfig);
