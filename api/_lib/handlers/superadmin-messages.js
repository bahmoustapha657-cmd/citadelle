import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "../firebase-admin.js";
import { applyCors, normalizeSchoolId, requireSession } from "../security.js";

function toMessageItem(docSnap) {
  return { _id: docSnap.id, ...docSnap.data() };
}

function normalizeTargetArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

export function isMessageVisibleToSchool(profile = {}, schoolId = "", message = {}) {
  const role = String(profile.role || "").trim();
  const normalizedSchoolId = normalizeSchoolId(schoolId || profile.schoolId || "");
  const cibleSchools = normalizeTargetArray(message.cibleSchools).map((value) => normalizeSchoolId(value));
  const cibleRoles = normalizeTargetArray(message.cibleRoles);

  if (!role || !normalizedSchoolId || cibleSchools.length === 0 || cibleRoles.length === 0) {
    return false;
  }

  const schoolMatches = cibleSchools.includes("*") || cibleSchools.includes(normalizedSchoolId);
  const roleMatches = cibleRoles.includes(role);

  return schoolMatches && roleMatches;
}

export default async function handler(req, res) {
  if (!applyCors(req, res, "GET,OPTIONS")) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const session = await requireSession(req, res, {
    roles: ["direction", "admin", "primaire", "college", "comptable", "enseignant"],
  });
  if (!session) return;

  try {
    const db = getFirestore();
    const schoolId = normalizeSchoolId(session.profile.schoolId);
    const snap = await db.collection("superadmin_messages").orderBy("createdAt", "desc").get();
    const messages = snap.docs
      .map(toMessageItem)
      .filter((message) => isMessageVisibleToSchool(session.profile, schoolId, message));

    return res.status(200).json({ ok: true, messages });
  } catch (error) {
    console.error("superadmin-messages error:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
