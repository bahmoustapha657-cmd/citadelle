import { getAuth } from "firebase/auth";
import { app } from "./firebaseApp";

export { app } from "./firebaseApp";
export { db, SCHOOL_ID, schoolCol, schoolDoc } from "./firebaseDb";
export {
  getCurrentUser,
  getCurrentUserIdToken,
  watchAuthState,
  signOutCurrentUser,
  signInWithCustomTokenClient,
  updateCurrentUserPassword,
} from "./firebaseAuth";

// Compatibilité legacy : certains imports historiques peuvent encore attendre
// un export synchrone `auth` depuis ce module.
export const auth = getAuth(app);
