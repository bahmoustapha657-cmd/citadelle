import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { applyPasswordTarpit } from "../auth-tarpit.js";
import { initAdmin } from "../firebase-admin.js";
import { captureServerError } from "../observability.js";
import { migrateParentAccountLinks } from "../parent-links-migration.js";
import { buildSessionAccountPayload, buildUserProfilePayload } from "../user-profiles.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
  normalizeSchoolId,
  sanitizeDisplayName,
} from "../security.js";

const LOGIN_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp, schoolId } = req.body || {};
  const normalizedLogin = normalizeLogin(login);
  const normalizedSchoolId = normalizeSchoolId(schoolId);

  if (!normalizedLogin || !mdp || !normalizedSchoolId) {
    return res.status(400).json({ error: "Champs requis : login, mdp, schoolId" });
  }
  if (!isValidLogin(normalizedLogin) || !isValidSchoolId(normalizedSchoolId)) {
    return res.status(400).json({ error: "Identifiant ou code �cole invalide." });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const authAdmin = getAuth();
  const db = getFirestore();
  const clientIp = getClientIp(req);

  try {
    const quota = await consumeRateLimit({
      db,
      scope: "login",
      key: `${clientIp}|${normalizedSchoolId}|${normalizedLogin}`,
      limit: LOGIN_RATE_LIMIT.limit,
      windowMs: LOGIN_RATE_LIMIT.windowMs,
    });

    if (!quota.ok) {
      res.setHeader("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
      return res.status(quota.status).json({
        error: "Trop de tentatives de connexion. R�essayez plus tard.",
      });
    }

    const schoolSnap = await db.collection("ecoles").doc(normalizedSchoolId).get();
    const school = schoolSnap.data() || null;

    if (!schoolSnap.exists || school?.supprime === true) {
      return res.status(404).json({ error: "Cette ecole n'est plus disponible." });
    }

    if (school?.actif === false) {
      return res.status(403).json({ error: "Cette ecole est desactivee." });
    }

    const comptesSnap = await db
      .collection("ecoles")
      .doc(normalizedSchoolId)
      .collection("comptes")
      .where("login", "==", normalizedLogin)
      .limit(1)
      .get();

    if (comptesSnap.empty) {
      await applyPasswordTarpit(mdp);
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }

    const compteDoc = comptesSnap.docs[0];
    let compte = { ...compteDoc.data(), _id: compteDoc.id };

    if (!compte.mdp?.startsWith("$2b$")) {
      await applyPasswordTarpit(mdp);
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    if (!isAllowedSchoolRole(compte.role)) {
      return res.status(403).json({ error: "R�le de compte invalide. Contactez l'administrateur." });
    }

    const valide = await bcrypt.compare(mdp, compte.mdp);
    if (!valide) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    if (compte.statut && compte.statut !== "Actif") {
      return res.status(403).json({ error: "Ce compte est inactif." });
    }

    if (compte.role === "parent") {
      const migration = await migrateParentAccountLinks({
        db,
        schoolId: normalizedSchoolId,
        account: compte,
      });
      if (migration.didUpdate) {
        compte = {
          ...compte,
          ...migration.account,
        };
        await compteDoc.ref.set({
          eleveId: compte.eleveId || null,
          eleveNom: compte.eleveNom || null,
          eleveClasse: compte.eleveClasse || null,
          eleveIds: Array.isArray(compte.eleveIds) ? compte.eleveIds : [],
          elevesAssocies: Array.isArray(compte.elevesAssocies) ? compte.elevesAssocies : [],
          section: compte.section || null,
          sections: Array.isArray(compte.sections) ? compte.sections : [],
          updatedAt: Date.now(),
        }, { merge: true });
      }
    }

    const email = `${normalizedLogin}.${normalizedSchoolId}@edugest.app`;
    const displayName = sanitizeDisplayName(compte.nom, normalizedLogin);
    const label = compte.label || compte.role;
    let uid;

    try {
      const userRecord = await authAdmin.createUser({ email, password: mdp, displayName });
      uid = userRecord.uid;
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        if (existing.displayName !== displayName || existing.disabled) {
          await authAdmin.updateUser(existing.uid, { displayName, disabled: false });
        }
        uid = existing.uid;
      } else {
        throw e;
      }
    }

    await authAdmin.setCustomUserClaims(uid, {
      role: compte.role,
      schoolId: normalizedSchoolId,
    });

    await db.collection("users").doc(uid).set(buildUserProfilePayload({
      account: compte,
      schoolId: normalizedSchoolId,
      login: normalizedLogin,
      email,
      compteDocId: compte._id,
    }), { merge: true });

    const customToken = await authAdmin.createCustomToken(uid);

    return res.status(200).json({
      ok: true,
      customToken,
      compte: buildSessionAccountPayload({
        ...compte,
        label,
      }, normalizedLogin),
    });
  } catch (e) {
    console.error("login error:", e);
    await captureServerError(e, {
      endpoint: "login",
      schoolId: normalizedSchoolId,
    });
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
