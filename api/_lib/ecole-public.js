import { FieldValue } from "firebase-admin/firestore";

export const ECOLE_PUBLIC_FIELDS = [
  "nom",
  "ville",
  "pays",
  "logo",
  "couleur1",
  "couleur2",
  "type",
  "accueil",
];

export function buildEcolePublicPayload(source = {}) {
  const payload = {};
  for (const key of ECOLE_PUBLIC_FIELDS) {
    if (source[key] !== undefined) {
      payload[key] = source[key];
    }
  }
  return payload;
}

export async function syncEcolePublic(db, schoolId, source) {
  const payload = buildEcolePublicPayload(source);
  if (Object.keys(payload).length === 0) {
    return { written: false };
  }
  await db.collection("ecoles_public").doc(schoolId).set(
    { ...payload, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { written: true };
}
