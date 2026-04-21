import { app } from "./firebaseApp";

let authDepsPromise;

const loadAuthDeps = () => {
  if (!authDepsPromise) {
    authDepsPromise = import("firebase/auth").then((mod) => ({
      ...mod,
      auth: mod.getAuth(app),
    }));
  }

  return authDepsPromise;
};

export async function getCurrentUser() {
  const { auth } = await loadAuthDeps();
  return auth.currentUser;
}

export async function getCurrentUserIdToken() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function watchAuthState(callback) {
  const { auth, onAuthStateChanged } = await loadAuthDeps();
  return onAuthStateChanged(auth, callback);
}

export async function signOutCurrentUser() {
  const { auth, signOut } = await loadAuthDeps();
  return signOut(auth);
}

export async function signInWithCustomTokenClient(customToken) {
  const { auth, signInWithCustomToken } = await loadAuthDeps();
  return signInWithCustomToken(auth, customToken);
}

export async function updateCurrentUserPassword(newPassword) {
  const { auth, updatePassword } = await loadAuthDeps();
  return updatePassword(auth.currentUser, newPassword);
}
