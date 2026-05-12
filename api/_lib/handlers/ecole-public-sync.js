import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "../firebase-admin.js";
import { withObservability } from "../observability.js";
import { syncEcolePublic } from "../ecole-public.js";
import {
  applyCors,
  isValidSchoolId,
  normalizeSchoolId,
  requireSession,
} from "../security.js";

async function syncSingleSchool(db, schoolId) {
  const snap = await db.collection("ecoles").doc(schoolId).get();
  if (!snap.exists) {
    return { ok: false, status: 404, error: "École introuvable." };
  }
  await syncEcolePublic(db, schoolId, snap.data() || {});
  return { ok: true };
}

async function backfillAll(db) {
  const snap = await db.collection("ecoles").get();
  let synced = 0;
  for (const doc of snap.docs) {
    await syncEcolePublic(db, doc.id, doc.data() || {});
    synced += 1;
  }
  return { ok: true, synced };
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

  const { action = "sync", schoolId } = req.body || {};
  const db = getFirestore();

  if (action === "backfill") {
    const session = await requireSession(req, res, { allowSuperadmin: true });
    if (!session) return;
    if (session.profile.role !== "superadmin") {
      return res.status(403).json({ error: "Accès réservé au superadmin." });
    }
    try {
      const result = await backfillAll(db);
      return res.status(200).json(result);
    } catch (e) {
      console.error("ecole-public-sync backfill error:", e);
      return res.status(500).json({ error: "Erreur backfill" });
    }
  }

  if (action === "sync") {
    const normalizedSchoolId = normalizeSchoolId(schoolId);
    if (!normalizedSchoolId || !isValidSchoolId(normalizedSchoolId)) {
      return res.status(400).json({ error: "schoolId invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const result = await syncSingleSchool(db, normalizedSchoolId);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("ecole-public-sync error:", e);
      return res.status(500).json({ error: "Erreur synchronisation" });
    }
  }

  return res.status(400).json({ error: "Action inconnue" });
}

export default withObservability(handler);
