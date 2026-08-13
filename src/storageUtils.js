// ── Stockage des fichiers (photos d'élèves, documents joints) ───────────────
// Les images étaient conservées en base64 DANS les colonnes (eleves.photo).
// À 3 000 élèves et ~100 ko par photo, la table pèserait 300 Mo et chaque
// lecture de la collection les retéléchargerait toutes. Elles vivent
// désormais dans le stockage objet ; la colonne ne garde qu'une URL.
//
// Le chemin d'envoi visait encore FIREBASE Storage, resté en place après la
// migration : une photo prise aujourd'hui partait vers un projet qui n'est
// plus la production. Firebase n'est conservé ici qu'en repli, chargé à la
// demande pour ne rien peser dans le bundle Supabase.
import { isSupabase } from "./backend";
import { getSupabase } from "./supabaseClient";

const BUCKET = "photos";

// Arborescence : <code_ecole>/<categorie>/<fichier>. Le premier segment est
// ce que la policy compare au code de l'école du compte (cf. storage.sql) —
// changer cette forme sans changer la policy casserait l'envoi.
export const cheminFichier = (schoolId, categorie, nom) => `${schoolId}/${categorie}/${nom}`;

// Nom indevinable : c'est lui qui protège l'image dans un bucket public,
// exactement comme le jeton aléatoire des URL Firebase qu'il remplace.
function nomAleatoire(extension) {
  const alea = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${alea}.${extension}`;
}

async function firebase() {
  const [{ getStorage, ref, uploadBytes, getDownloadURL, deleteObject }] = await Promise.all([
    import("firebase/storage"),
  ]);
  return { getStorage, ref, uploadBytes, getDownloadURL, deleteObject };
}

export async function uploadFichier(fichier, chemin) {
  if (isSupabase) {
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(chemin, fichier, {
      upsert: true,
      contentType: fichier?.type || undefined,
    });
    if (error) throw new Error(error.message);
    return sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
  }
  const { getStorage, ref, uploadBytes, getDownloadURL } = await firebase();
  const storageRef = ref(getStorage(), chemin);
  await uploadBytes(storageRef, fichier);
  return getDownloadURL(storageRef);
}

// Supprime un fichier à partir de son URL publique. Best-effort : un fichier
// déjà absent n'est pas une erreur pour l'appelant.
export async function supprimerFichier(url) {
  try {
    if (isSupabase) {
      const marqueur = `/object/public/${BUCKET}/`;
      const i = String(url || "").indexOf(marqueur);
      if (i === -1) return; // URL étrangère (ancienne Firebase) : rien à faire ici
      const chemin = decodeURIComponent(String(url).slice(i + marqueur.length));
      await getSupabase().storage.from(BUCKET).remove([chemin]);
      return;
    }
    const { getStorage, ref, deleteObject } = await firebase();
    await deleteObject(ref(getStorage(), url));
  } catch { /* déjà supprimé, ou URL non gérée */ }
}

// Photo d'élève : accepte une image base64 (appareil photo, import) ou une URL
// déjà stockée — dans ce cas elle est renvoyée telle quelle, ce qui rend la
// fonction idempotente et permet de la rappeler à chaque enregistrement.
export async function uploadPhotoEleve(photoBase64OuUrl, schoolId) {
  if (!photoBase64OuUrl) return "";
  if (photoBase64OuUrl.startsWith("http")) return photoBase64OuUrl;
  const res = await fetch(photoBase64OuUrl);
  const blob = await res.blob();
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return uploadFichier(blob, cheminFichier(schoolId, "photos", nomAleatoire(ext)));
}
