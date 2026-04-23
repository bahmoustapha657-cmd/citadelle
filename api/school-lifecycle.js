import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { syncEcolePublic } from "./_lib/ecole-public.js";
import {
  applyCors,
  isValidSchoolId,
  normalizeSchoolId,
  requireSession,
} from "./_lib/security.js";

export const SCHOOL_LIFECYCLE_CONFIRMATIONS = {
  deactivate: "DESACTIVER",
  delete: "SUPPRIMER",
  reactivate: "ACTIVER",
};

export function normalizeSchoolLifecycleAction(action = "") {
  const normalized = typeof action === "string" ? action.trim().toLowerCase() : "";
  return Object.hasOwn(SCHOOL_LIFECYCLE_CONFIRMATIONS, normalized) ? normalized : "";
}

export function buildSchoolLifecyclePatch(action, session, now = Date.now()) {
  const actor = {
    uid: session?.uid || "",
    role: session?.profile?.role || "",
    at: now,
  };

  if (action === "deactivate") {
    return {
      actif: false,
      supprime: false,
      deactivatedAt: now,
      deactivatedBy: actor,
    };
  }

  if (action === "delete") {
    return {
      actif: false,
      supprime: true,
      deletedAt: now,
      deletedBy: actor,
    };
  }

  if (action === "reactivate") {
    return {
      actif: true,
      supprime: false,
      reactivatedAt: now,
      reactivatedBy: actor,
    };
  }

  return {};
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const schoolId = normalizeSchoolId(req.body?.schoolId);
  const action = normalizeSchoolLifecycleAction(req.body?.action);
  const confirmation = typeof req.body?.confirmation === "string"
    ? req.body.confirmation.trim().toUpperCase()
    : "";

  if (!schoolId || !isValidSchoolId(schoolId)) {
    return res.status(400).json({ error: "schoolId invalide." });
  }

  if (!action) {
    return res.status(400).json({ error: "Action invalide." });
  }

  const expectedConfirmation = SCHOOL_LIFECYCLE_CONFIRMATIONS[action];
  if (confirmation !== expectedConfirmation) {
    return res.status(400).json({ error: `Confirmation invalide. Entrez ${expectedConfirmation}.` });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)." });
  }

  const session = await requireSession(req, res, {
    roles: ["direction"],
    schoolId,
    allowSuperadmin: true,
  });
  if (!session) return;

  if (action === "reactivate" && session.profile.role !== "superadmin") {
    return res.status(403).json({ error: "Reactivation reservee au superadmin." });
  }

  const db = getFirestore();

  try {
    const ref = db.collection("ecoles").doc(schoolId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Ecole introuvable." });
    }

    const school = snap.data() || {};

    if (action === "deactivate" && school.actif === false && school.supprime !== true) {
      return res.status(409).json({ error: "Cette ecole est deja desactivee." });
    }
    if (action === "delete" && school.supprime === true) {
      return res.status(409).json({ error: "Cette ecole est deja supprimee." });
    }
    if (action !== "reactivate" && school.supprime === true) {
      return res.status(409).json({ error: "Cette ecole est deja supprimee." });
    }
    if (action === "reactivate" && school.actif === true && school.supprime !== true) {
      return res.status(409).json({ error: "Cette ecole est deja active." });
    }

    const patch = buildSchoolLifecyclePatch(action, session);
    await ref.set(patch, { merge: true });
    await syncEcolePublic(db, schoolId, { ...school, ...patch });

    return res.status(200).json({
      ok: true,
      action,
      schoolId,
      actif: patch.actif,
      supprime: patch.supprime,
    });
  } catch (error) {
    console.error("school-lifecycle error:", error);
    return res.status(500).json({ error: "Erreur lors de la mise a jour de l'ecole." });
  }
}
