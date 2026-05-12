import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { ROLE_ORDER, getRoleSettingsMap } from "../../../shared/role-config.js";
import { generateSecurePassword } from "../passwords.js";
import { findLogicalAccountConflict } from "../account-conflicts.js";
import {
  extractAccountProfileFields,
  hasSameParentHousehold,
  mergeParentStudentLinks,
  parentAccountsShareStudent,
} from "../account-links.js";
import { initAdmin } from "../firebase-admin.js";
import { withObservability } from "../observability.js";
import { buildSessionAccountPayload, buildUserProfilePayload } from "../user-profiles.js";
import {
  applyCors,
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
  normalizeSchoolId,
  requireSession,
} from "../security.js";

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

const ROLES_SYSTEME_ECRITURE = new Set(["direction", "admin", "comptable", "primaire", "college"]);

export function canManageTeacherScope(session, targetSection) {
  if (session.profile.role === "primaire") {
    return targetSection === "primaire";
  }
  if (session.profile.role === "college") {
    return targetSection === "college" || targetSection === "lycee";
  }
  return false;
}

export function canManageTargetRole(session, targetRole, targetData = {}) {
  if (session.profile.role === "superadmin") return true;
  if (session.profile.role === "direction") return true;
  if (session.profile.role === "admin") {
    if (ROLES_SYSTEME_ECRITURE.has(targetRole)) return false;
    return ["enseignant", "parent"].includes(targetRole);
  }
  if (session.profile.role === "primaire" || session.profile.role === "college") {
    if (targetRole !== "enseignant") return false;
    return canManageTeacherScope(session, targetData.section);
  }
  return false;
}

async function logAuditAction({ db, schoolId, auteur, action, cible, details = {} }) {
  try {
    await db.collection("ecoles").doc(schoolId).collection("audit_securite").add({
      auteur: {
        login: auteur.login || null,
        role: auteur.role || null,
        uid: auteur.uid || null,
      },
      action,
      cible,
      details,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("audit log error:", err);
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
    eleveIds: Array.isArray(body.eleveIds) ? body.eleveIds : null,
    elevesAssocies: Array.isArray(body.elevesAssocies) ? body.elevesAssocies : null,
    section: body.section || null,
    sections: Array.isArray(body.sections) ? body.sections : null,
    matiere: body.matiere || null,
    enseignantId: body.enseignantId || null,
    enseignantNom: body.enseignantNom || null,
    tuteur: body.tuteur || null,
    contactTuteur: body.contactTuteur || null,
    filiation: body.filiation || null,
    statut: body.statut || "Actif",
  };
}

async function findAccountsByRole({ db, schoolId, role }) {
  const snap = await db
    .collection("ecoles")
    .doc(schoolId)
    .collection("comptes")
    .where("role", "==", role)
    .get();

  return snap.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
}

function findParentHouseholdAccount(accounts = [], candidate = {}) {
  return accounts.find((account) => (
    hasSameParentHousehold(candidate, account)
    && !parentAccountsShareStudent(candidate, account)
  )) || null;
}

function buildMergedParentAccount(existingAccount = {}, candidate = {}) {
  const mergedLinks = mergeParentStudentLinks(existingAccount, candidate);

  return {
    ...existingAccount,
    ...candidate,
    login: existingAccount.login,
    mdp: existingAccount.mdp,
    uid: existingAccount.uid || null,
    role: existingAccount.role || candidate.role || "parent",
    nom: existingAccount.nom || candidate.nom || existingAccount.login,
    label: existingAccount.label || candidate.label || "Parent",
    statut: existingAccount.statut || candidate.statut || "Actif",
    premiereCo: existingAccount.premiereCo !== false,
    createdAt: existingAccount.createdAt || Date.now(),
    updatedAt: Date.now(),
    ...mergedLinks,
    tuteur: existingAccount.tuteur || candidate.tuteur || null,
    contactTuteur: existingAccount.contactTuteur || candidate.contactTuteur || null,
    filiation: existingAccount.filiation || candidate.filiation || null,
  };
}

async function syncUserProfile({ db, uid, schoolId, login, email, compteDocId, account }) {
  await db.collection("users").doc(uid).set(buildUserProfilePayload({
    account,
    schoolId,
    login,
    email,
    compteDocId,
  }), { merge: true });
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

async function handler(req, res) {
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
      return res.status(400).json({ error: "Identifiant ou code ecole invalide." });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres." });
    }
    if (!isAllowedSchoolRole(role)) {
      return res.status(400).json({ error: "Role de compte invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin", "primaire", "college"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    if (!canManageTargetRole(session, role, sanitizeAccountPayload({ ...req.body, role, login: normalizedLogin }))) {
      return res.status(403).json({ error: "Droits insuffisants pour creer ce compte." });
    }

    try {
      const accountFields = sanitizeAccountPayload({ ...req.body, role, login: normalizedLogin });
      const logicalAccounts = ["parent", "enseignant"].includes(role)
        ? await findAccountsByRole({ db, schoolId: normalizedSchoolId, role })
        : [];
      const logicalConflict = findLogicalAccountConflict(logicalAccounts, {
        role,
        ...accountFields,
      });
      if (logicalConflict) {
        return res.status(409).json({ error: logicalConflict.error });
      }

      const householdMatch = role === "parent"
        ? findParentHouseholdAccount(logicalAccounts, { role, ...accountFields })
        : null;
      const existing = await findAccount({ db, schoolId: normalizedSchoolId, login: normalizedLogin });
      if (existing && existing.id !== householdMatch?._id) {
        return res.status(409).json({ error: "Un compte existe deja avec cet identifiant." });
      }

      if (role === "parent") {
        if (householdMatch && householdMatch._id) {
          const householdRef = db
            .collection("ecoles")
            .doc(normalizedSchoolId)
            .collection("comptes")
            .doc(householdMatch._id);
          const merged = buildMergedParentAccount(householdMatch, { role, ...accountFields });
          delete merged._id;
          await householdRef.set({ ...merged, updatedAt: Date.now() }, { merge: true });

          if (householdMatch.uid) {
            const householdEmail = buildEmail(householdMatch.login, normalizedSchoolId);
            await authAdmin.setCustomUserClaims(householdMatch.uid, {
              role: "parent",
              schoolId: normalizedSchoolId,
            });
            await syncUserProfile({
              db,
              uid: householdMatch.uid,
              schoolId: normalizedSchoolId,
              login: householdMatch.login,
              email: householdEmail,
              compteDocId: householdMatch._id,
              account: { ...merged, uid: householdMatch.uid },
            });
          }

          return res.status(200).json({
            ok: true,
            merged: true,
            mergedIntoExisting: true,
            uid: householdMatch.uid || null,
            compteDocId: householdMatch._id,
            compte: buildSessionAccountPayload(
              { ...merged, uid: householdMatch.uid || null },
              householdMatch.login,
            ),
            message: `Eleve ajoute au compte parent existant "${householdMatch.login}". Le mot de passe initial reste inchange.`,
          });
        }
      }

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
        email,
        compteDocId: ref.id,
        account: {
          ...accountData,
          uid: userRecord.uid,
        },
      });

      return res.status(200).json({
        ok: true,
        uid: userRecord.uid,
        compteDocId: ref.id,
        compte: buildSessionAccountPayload({
          ...accountData,
          uid: userRecord.uid,
        }, normalizedLogin),
      });
    } catch (e) {
      console.error("account-manage create error:", e);
      return res.status(500).json({ error: "Erreur creation compte" });
    }
  }

  if (action === "sync_role_settings") {
    const normalizedSchoolId = normalizeSchoolId(req.body?.schoolId);
    if (!normalizedSchoolId || !isValidSchoolId(normalizedSchoolId)) {
      return res.status(400).json({ error: "Code Ã©cole invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction"],
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
          return res.status(409).json({ error: `L'identifiant ${config.login} est dÃ©jÃ  utilisÃ© par un autre compte.` });
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
              email,
              compteDocId: existing.id,
              account: {
                ...existing.data,
                login: config.login,
                role,
                nom: config.nom,
                label: config.label,
                statut,
              },
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
          email,
          compteDocId: ref.id,
          account: {
            login: config.login,
            role,
            nom: config.nom,
            label: config.label,
            statut,
            premiereCo: true,
            uid: userRecord.uid,
          },
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

      await logAuditAction({
        db,
        schoolId: normalizedSchoolId,
        auteur: session.profile,
        action: "sync_role_settings",
        cible: { rolesAffectes: updatedRoles, comptesGeneres: generatedAccounts.length },
      });

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
      return res.status(400).json({ error: "Code Ã©cole invalide." });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractÃ¨res." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin", "primaire", "college"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const account = await findAccount({ db, schoolId: normalizedSchoolId, accountId });
      if (!account) {
        return res.status(404).json({ error: "Compte introuvable." });
      }

      if (!canManageTargetRole(session, account.data.role, account.data)) {
        return res.status(403).json({ error: "Droits insuffisants pour reinitialiser ce compte." });
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
        email,
        compteDocId: account.id,
        account: {
          ...account.data,
          premiereCo: true,
          uid: userRecord.uid,
        },
      });

      await logAuditAction({
        db,
        schoolId: normalizedSchoolId,
        auteur: session.profile,
        action: "reset_password",
        cible: {
          accountId: account.id,
          login: account.data.login,
          role: account.data.role,
          nom: account.data.nom || null,
        },
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("account-manage reset error:", e);
      return res.status(500).json({ error: "Erreur rÃ©initialisation mot de passe" });
    }
  }

  if (action === "self_password_sync") {
    const mdp = req.body?.mdp || "";
    if (!mdp) {
      return res.status(400).json({ error: "Champ requis : mdp" });
    }
    if (mdp.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractÃ¨res." });
    }

    const session = await requireSession(req, res, { allowSuperadmin: true });
    if (!session) return;

    const schoolId = normalizeSchoolId(session.profile.schoolId);
    const login = normalizeLogin(session.profile.login);

    try {
      const account = await findAccount({ db, schoolId, accountId: session.profile.compteDocId || "", login });
      if (!account) {
        return res.status(404).json({ error: "Compte associÃ© introuvable." });
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
        ...extractAccountProfileFields(account.data),
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

export default withObservability(handler);


