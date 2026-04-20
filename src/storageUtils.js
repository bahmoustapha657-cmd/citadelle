import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const storage = getStorage();

export async function uploadFichier(fichier, chemin) {
  const storageRef = ref(storage, chemin);
  await uploadBytes(storageRef, fichier);
  return await getDownloadURL(storageRef);
}

export async function supprimerFichier(url) {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch { console.log("Fichier déjà supprimé"); }
}

// Upload une photo élève (base64 ou File/Blob) vers Firebase Storage.
// Si c'est déjà une URL https, retourne telle quelle.
export async function uploadPhotoEleve(photoBase64OuUrl, schoolId) {
  if (!photoBase64OuUrl) return "";
  if (photoBase64OuUrl.startsWith("http")) return photoBase64OuUrl;
  // Convertir base64 en Blob
  const res = await fetch(photoBase64OuUrl);
  const blob = await res.blob();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const nom = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const chemin = `ecoles/${schoolId}/photos/${nom}`;
  return await uploadFichier(blob, chemin);
}

export { storage };
