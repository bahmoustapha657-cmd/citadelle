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

export function shouldExposeEcolePublic(source = {}) {
  return source?.actif !== false && source?.supprime !== true;
}

export async function syncEcolePublic(db, schoolId, source) {
  const ref = db.collection("ecoles_public").doc(schoolId);

  if (!shouldExposeEcolePublic(source)) {
    await ref.delete().catch(() => {});
    return { written: false, deleted: true };
  }

  const payload = buildEcolePublicPayload(source);
  if (Object.keys(payload).length === 0) {
    await ref.delete().catch(() => {});
    return { written: false, deleted: true };
  }
  // Overwrite the public projection so removed branding fields disappear too.
  await ref.set({
    ...payload,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { written: true, deleted: false };
}
