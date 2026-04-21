import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { ROLE_ORDER, getRoleSettingsMap } from "../shared/role-config.js";
import { generateSecurePassword } from "./_lib/passwords.js";
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

async function upsertAuthUser(authAdmin, { email, password, displayName, disabled = false }) {
  try {
    return await authAdmin.createUser({ email, password, displayName, disabled });
  } catch (e) {
    if (e.code !== "auth/email-already-exists") throw e;
    const existing = await authAdmin.getUserByEmail(email);
    await authAdmin.updateUser(existing.uid, { password, displayName, disabled });
    return existing;
  }
}

function canManageTargetRole(session, targetRole) {
  if (session.profile.role === "superadmin") return true;
  if (targetRole === "direction") return session.profile.role === "direction";
  return ["direction", "admin"].includes(session.profile.role);
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

async function syncUserProfile({ db, uid, schoolId, login, role, nom, label, email, compteDocId, premiereCo, statut = "Actif" }) {
  await db.collection("users").doc(uid).set({
    schoolId,
    role,
    nom,
    label,
    login,
    email,
    compteDocId,
    premiereCo,
    statut,
    updatedAt: Date.now(),
  }, { merge: true });
}

async function updateAuthIdentity(authAdmin, uid, { email, nom, active }) {
  if (!uid) return;
  await authAdmin.updateUser(uid, {
    email,
    displayName: nom,
    disabled: !active,
  });
  if (!active) {
    await authAdmin.revokeRefreshTokens(uid);
  }
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
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

    if (!canManageTargetRole(session, role)) {
      return res.status(403).json({ error: "Seule la direction peut créer un compte direction." });
    }

    try {
      const existing = await findAccount({ db, schoolId: normalizedSchoolId, login: normalizedLogin });
      if (existing) {
        return res.status(409).json({ error: "Un compte existe déjà avec cet identifiant." });
      }

      const accountFields = sanitizeAccountPayload({ ...req.body, role, login: normalizedLogin });
      const active = accountFields.statut !== "Inactif";
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
        disabled: !active,
      });

      await ref.update({ uid: userRecord.uid, updatedAt: Date.now() });
      await authAdmin.setCustomUserClaims(userRecord.uid, {
        role,
        schoolId: normalizedSchoolId,
      });
      await syncUserProfile({
        db,
        uid: userRecord.uid,
        schoolId: normalizedSchoolId,
        login: normalizedLogin,
        role,
        nom: accountFields.nom || normalizedLogin,
        label: accountFields.label || role,
        email,
        compteDocId: ref.id,
        premiereCo: true,
        statut: accountFields.statut || "Actif",
      });

      return res.status(200).json({ ok: true, uid: userRecord.uid, compteDocId: ref.id });
    } catch (e) {
      console.error("account-manage create error:", e);
      return res.status(500).json({ error: "Erreur création compte" });
    }
  }

  if (action === "sync_role_settings") {
    const normalizedSchoolId = normalizeSchoolId(req.body?.schoolId);
    if (!normalizedSchoolId || !isValidSchoolId(normalizedSchoolId)) {
      return res.status(400).json({ error: "Code école invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const normalizedRoleSettings = getRoleSettingsMap(req.body?.roleSettings || {});
      const comptesRef = db.collection("ecoles").doc(normalizedSchoolId).collection("comptes");
      const comptesSnap = await comptesRef.where("role", "in", ROLE_ORDER).get();
      const comptesParRole = new Map();
      const comptesParLogin = new Map();

      comptesSnap.docs.forEach((snap) => {
        const account = { ref: snap.ref, id: snap.id, data: snap.data() };
        comptesParRole.set(account.data.role, account);
        comptesParLogin.set(account.data.login, account);
      });

      for (const role of ROLE_ORDER) {
        const config = normalizedRoleSettings[role];
        const existing = comptesParRole.get(role);
        const conflict = comptesParLogin.get(config.login);
        if (conflict && conflict.id !== existing?.id) {
          return res.status(409).json({ error: `L'identifiant ${config.login} est déjà utilisé par un autre compte.` });
        }
      }

      const generatedAccounts = [];
      const updatedRoles = [];

      for (const role of ROLE_ORDER) {
        const config = normalizedRoleSettings[role];
        const existing = comptesParRole.get(role);
        const active = config.active !== false;
        const statut = active ? "Actif" : "Inactif";
        const email = buildEmail(config.login, normalizedSchoolId);

        if (existing) {
          await existing.ref.update({
            login: config.login,
            nom: config.nom,
            label: config.label,
            statut,
            updatedAt: Date.now(),
          });

          if (existing.data.uid) {
            await updateAuthIdentity(authAdmin, existing.data.uid, {
              email,
              nom: config.nom,
              active,
            });
            await authAdmin.setCustomUserClaims(existing.data.uid, {
              role,
              schoolId: normalizedSchoolId,
            });
            await syncUserProfile({
              db,
              uid: existing.data.uid,
              schoolId: normalizedSchoolId,
              login: config.login,
              role,
              nom: config.nom,
              label: config.label,
              email,
              compteDocId: existing.id,
              premiereCo: !!existing.data.premiereCo,
              statut,
            });
          }

          updatedRoles.push(role);
          continue;
        }

        if (!active) continue;

        const mdp = generateSecurePassword();
        const mdpHash = await bcrypt.hash(mdp, 10);
        const createdAt = Date.now();
        const userRecord = await upsertAuthUser(authAdmin, {
          email,
          password: mdp,
          displayName: config.nom,
          disabled: false,
        });

        const ref = comptesRef.doc();
        await ref.set({
          login: config.login,
          mdp: mdpHash,
          role,
          nom: config.nom,
          label: config.label,
          statut,
          premiereCo: true,
          uid: userRecord.uid,
          createdAt,
          updatedAt: createdAt,
        });

        await authAdmin.setCustomUserClaims(userRecord.uid, {
          role,
          schoolId: normalizedSchoolId,
        });
        await syncUserProfile({
          db,
          uid: userRecord.uid,
          schoolId: normalizedSchoolId,
          login: config.login,
          role,
          nom: config.nom,
          label: config.label,
          email,
          compteDocId: ref.id,
          premiereCo: true,
          statut,
        });

        generatedAccounts.push({
          role,
          login: config.login,
          nom: config.nom,
          label: config.label,
          mdp,
        });
        updatedRoles.push(role);
      }

      await db.collection("ecoles").doc(normalizedSchoolId).set({
        roleSettings: normalizedRoleSettings,
        updatedAt: Date.now(),
      }, { merge: true });

      return res.status(200).json({
        ok: true,
        roleSettings: normalizedRoleSettings,
        generatedAccounts,
        updatedRoles,
      });
    } catch (e) {
      console.error("account-manage sync roles error:", e);
      return res.status(500).json({ error: "Erreur synchronisation des comptes" });
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

      if (!canManageTargetRole(session, account.data.role)) {
        return res.status(403).json({ error: "Seule la direction peut réinitialiser un compte direction." });
      }

      const email = buildEmail(account.data.login, normalizedSchoolId);
      const userRecord = await upsertAuthUser(authAdmin, {
        email,
        password: mdp,
        displayName: account.data.nom || account.data.login,
        disabled: account.data.statut === "Inactif",
      });

      const mdpHash = await bcrypt.hash(mdp, 10);
      await account.ref.update({
        mdp: mdpHash,
        premiereCo: true,
        uid: userRecord.uid,
        updatedAt: Date.now(),
      });

      await authAdmin.setCustomUserClaims(userRecord.uid, {
        role: account.data.role,
        schoolId: normalizedSchoolId,
      });

      await syncUserProfile({
        db,
        uid: userRecord.uid,
        schoolId: normalizedSchoolId,
        login: account.data.login,
        role: account.data.role,
        nom: account.data.nom || account.data.login,
        label: account.data.label || account.data.role,
        email,
        compteDocId: account.id,
        premiereCo: true,
        statut: account.data.statut || "Actif",
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("account-manage reset error:", e);
      return res.status(500).json({ error: "Erreur réinitialisation mot de passe" });
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
      return res.status(500).json({ error: "Erreur synchronisation mot de passe" });
    }
  }

  return res.status(400).json({ error: "Action inconnue" });
}
