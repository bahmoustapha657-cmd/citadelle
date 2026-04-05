const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * createUserAccount — appelée depuis l'UI admin.
 * Crée le compte Firebase Auth + le document /users/{uid}.
 *
 * Paramètres attendus : { login, mdp, schoolId, role, nom, label }
 * Retourne : { uid, email }
 */
exports.createUserAccount = onCall(async (request) => {
  // 1. Vérifier que l'appelant est connecté
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté.");
  }

  // 2. Vérifier que l'appelant est admin
  const callerSnap = await admin
    .firestore()
    .doc(`users/${request.auth.uid}`)
    .get();

  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Seul l'administrateur peut créer des comptes."
    );
  }

  const { login, mdp, schoolId, role, nom, label } = request.data;

  // 3. Validation minimale
  if (!login || !mdp || !schoolId || !role || !nom) {
    throw new HttpsError("invalid-argument", "Tous les champs sont obligatoires.");
  }
  if (mdp.length < 6) {
    throw new HttpsError("invalid-argument", "Le mot de passe doit comporter au moins 6 caractères.");
  }

  const email = `${login}.${schoolId}@edugest.app`;

  // 4. Créer le compte Firebase Auth
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password: mdp,
      displayName: nom,
    });
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Ce login existe déjà.");
    }
    throw new HttpsError("internal", "Impossible de créer le compte Firebase Auth.");
  }

  // 5. Écrire le profil dans /users/{uid}
  await admin.firestore().doc(`users/${userRecord.uid}`).set({
    schoolId,
    role,
    login,
    nom,
    label: label || role,
  });

  // 6. Ajouter dans ecoles/{schoolId}/comptes pour la liste admin
  const bcrypt = await import("bcryptjs");
  const mdpHashe = await bcrypt.default.hash(mdp, 10);
  await admin.firestore()
    .collection(`ecoles/${schoolId}/comptes`)
    .add({ login, mdp: mdpHashe, role, nom, label: label || role });

  return { uid: userRecord.uid, email };
});
