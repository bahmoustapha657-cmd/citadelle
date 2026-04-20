import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  applyCors,
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
  normalizeSchoolId,
  requireSession,
} from "./_lib/security.js";

function buildEmail(login, schoolId) {
  return `${login}.${schoolId}@edugest.app`;
}

async function upsertAuthUser(authAdmin, { email, password, displayName }) {
  try {
    return await authAdmin.createUser({ email, password, displayName });
  } catch (e) {
    if (e.code !== "auth/email-already-exists") throw e;
    const existing = await authAdmin.getUserByEmail(email);
    await authAdmin.updateUser(existing.uid, { password, displayName });
    return existing;
  }
}

async function findAccount({ db, schoolId, accountId = "", login = "" }) {
  if (accountId) {
    const docRef = db.collection("ecoles").doc(schoolId).collection("comptes").doc(accountId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { ref: docRef, id: snap.id, data: snap.data() };
  }

  if (!login) return null;
  const snap = await db
    .collection("ecoles")
    .doc(schoolId)
    .collection("comptes")
    .where("login", "==", login)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, id: snap.docs[0].id, data: snap.docs[0].data() };
}

function sanitizeAccountPayload(body = {}) {
  return {
    nom: body.nom || body.login,
    label: body.label || body.role,
    eleveId: body.eleveId || null,
    eleveNom: body.eleveNom || null,
    eleveClasse: body.eleveClasse || null,
    section: body.section || null,
    matiere: body.matiere || null,
    enseignantNom: body.enseignantNom || null,
    statut: body.statut || "Actif",
  };
}

async function syncUserProfile({ db, uid, schoolId, login, role, nom, email, compteDocId, premiereCo }) {
  await db.collection("users").doc(uid).set({
    schoolId,
    role,
    nom,
    login,
    email,
    compteDocId,
    premiereCo,
    updatedAt: Date.now(),
  }, { merge: true });
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const { action } = req.body || {};
  const db = getFirestore();
  const authAdmin = getAuth();

  if (action === "create") {
    const normalizedSchoolId = normalizeSchoolId(req.body?.schoolId);
    const normalizedLogin = normalizeLogin(req.body?.login);
    const role = req.body?.role;
    const mdp = req.body?.mdp || "";

    if (!normalizedSchoolId || !normalizedLogin || !role || !mdp) {
      return res.status(400).json({ error: "Champs requis : schoolId, login, role, mdp" });
    }
    if (!isValidSchoolId(normalizedSchoolId) || !isValidLogin(normalizedLogin)) {
      return res.status(400).json({ error: "Identifiant ou code école invalide." });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    if (!isAllowedSchoolRole(role)) {
      return res.status(400).json({ error: "Rôle de compte invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const existing = await findAccount({ db, schoolId: normalizedSchoolId, login: normalizedLogin });
      if (existing) {
        return res.status(409).json({ error: "Un compte existe déjà avec cet identifiant." });
      }

      const accountFields = sanitizeAccountPayload({ ...req.body, role, login: normalizedLogin });
      const mdpHash = await bcrypt.hash(mdp, 10);
      const createdAt = Date.now();
      const accountData = {
        login: normalizedLogin,
        mdp: mdpHash,
        role,
        ...accountFields,
        premiereCo: true,
        createdAt,
        updatedAt: createdAt,
      };

      const ref = await db.collection("ecoles").doc(normalizedSchoolId).collection("comptes").add(accountData);

      const email = buildEmail(normalizedLogin, normalizedSchoolId);
      const userRecord = await upsertAuthUser(authAdmin, {
        email,
        password: mdp,
        displayName: accountFields.nom || normalizedLogin,
      });

      await ref.update({ uid: userRecord.uid, updatedAt: Date.now() });
      await syncUserProfile({
        db,
        uid: userRecord.uid,
        schoolId: normalizedSchoolId,
        login: normalizedLogin,
        role,
        nom: accountFields.nom || normalizedLogin,
        email,
        compteDocId: ref.id,
        premiereCo: true,
      });

      return res.status(200).json({ ok: true, uid: userRecord.uid, compteDocId: ref.id });
    } catch (e) {
      console.error("account-manage create error:", e);
      return res.status(500).json({ error: e.message || "Erreur création compte" });
    }
  }

  if (action === "reset_password") {
    const normalizedSchoolId = normalizeSchoolId(req.body?.schoolId);
    const accountId = typeof req.body?.accountId === "string" ? req.body.accountId.trim() : "";
    const mdp = req.body?.mdp || "";

    if (!normalizedSchoolId || !accountId || !mdp) {
      return res.status(400).json({ error: "Champs requis : schoolId, accountId, mdp" });
    }
    if (!isValidSchoolId(normalizedSchoolId)) {
      return res.status(400).json({ error: "Code école invalide." });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const account = await findAccount({ db, schoolId: normalizedSchoolId, accountId });
      if (!account) {
        return res.status(404).json({ error: "Compte introuvable." });
      }

      const email = buildEmail(account.data.login, normalizedSchoolId);
      const userRecord = await upsertAuthUser(authAdmin, {
        email,
        password: mdp,
        displayName: account.data.nom || account.data.login,
      });

      const mdpHash = await bcrypt.hash(mdp, 10);
      await account.ref.update({
        mdp: mdpHash,
        premiereCo: true,
        uid: userRecord.uid,
        updatedAt: Date.now(),
      });

      await syncUserProfile({
        db,
        uid: userRecord.uid,
        schoolId: normalizedSchoolId,
        login: account.data.login,
        role: account.data.role,
        nom: account.data.nom || account.data.login,
        email,
        compteDocId: account.id,
        premiereCo: true,
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("account-manage reset error:", e);
      return res.status(500).json({ error: e.message || "Erreur réinitialisation mot de passe" });
    }
  }

  if (action === "self_password_sync") {
    const mdp = req.body?.mdp || "";
    if (!mdp) {
      return res.status(400).json({ error: "Champ requis : mdp" });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    const session = await requireSession(req, res, { allowSuperadmin: true });
    if (!session) return;

    const schoolId = normalizeSchoolId(session.profile.schoolId);
    const login = normalizeLogin(session.profile.login);

    try {
      const account = await findAccount({ db, schoolId, accountId: session.profile.compteDocId || "", login });
      if (!account) {
        return res.status(404).json({ error: "Compte associé introuvable." });
      }

      const mdpHash = await bcrypt.hash(mdp, 10);
      await account.ref.update({
        mdp: mdpHash,
        premiereCo: false,
        updatedAt: Date.now(),
      });

      await db.collection("users").doc(session.uid).set({
        compteDocId: account.id,
        premiereCo: false,
        updatedAt: Date.now(),
      }, { merge: true });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("account-manage self sync error:", e);
      return res.status(500).json({ error: e.message || "Erreur synchronisation mot de passe" });
    }
  }

  return res.status(400).json({ error: "Action inconnue" });
}
