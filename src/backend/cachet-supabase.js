// ── Cachet et signature personnels ──────────────────────────────────────────
// Un comptable ou un chef de section dépose LUI-MÊME l'image de son cachet
// signé (menu profil). Elle est rangée dans le stockage (bucket photos,
// <code_ecole>/cachets/…) et son URL dans comptes.cachet_url, que seul le
// titulaire du compte peut écrire (trigger comptes_cachet_guard) — la
// Direction ne peut ni la poser ni la changer à sa place. Même règle pour sa
// taille à l'impression (comptes.cachet_taille).
import { getSupabase } from "../supabaseClient";
import { supprimerFichier, uploadImage } from "../storageUtils";
import { normaliserTailleCachet } from "../reports/signataire-session";

const messageErreur = (error) => {
  const brut = String(error?.message || "");
  if (/cachet_(url|taille)/.test(brut) && /column|colonne|schema cache/i.test(brut)) {
    return "Le dépôt du cachet n'est pas encore disponible sur le serveur. Réessayez après la prochaine mise à jour.";
  }
  if (error?.code === "42501" || /titulaire/i.test(brut)) {
    return "Seul le titulaire du compte peut déposer, remplacer ou retirer son cachet.";
  }
  return brut || "Enregistrement du cachet impossible.";
};

// Écrit les colonnes du cachet sur le compte. `.select()` : un refus RLS ne
// lève pas d'erreur, il ne touche aucune ligne.
async function ecrire(compteId, champs) {
  const { data, error } = await getSupabase().from("comptes")
    .update(champs).eq("id", compteId).select("id");
  if (error || !data?.length) {
    throw new Error(error ? messageErreur(error) : "Enregistrement refusé : ce compte n'est pas le vôtre.");
  }
}

// `image` : data URL (nouveau cachet) ou "" (retirer). `ancienne` : URL du
// cachet remplacé, effacé du stockage une fois l'enregistrement confirmé.
// `taille` : facteur à l'impression (remis à 1 si le cachet est retiré).
// Renvoie l'URL enregistrée ("" si retiré). Réseau requis : l'image doit être
// en ligne pour que les autres appareils du titulaire l'impriment aussi.
export async function enregistrerMonCachet({ compteId, schoolId, image, ancienne = "", taille = 1 }) {
  if (!compteId || !schoolId) throw new Error("Compte inconnu : reconnectez-vous.");
  const url = image ? await uploadImage(image, schoolId, "cachets") : "";
  try {
    await ecrire(compteId, { cachet_url: url || null, cachet_taille: url ? normaliserTailleCachet(taille) : 1 });
  } catch (e) {
    if (url && url !== ancienne) supprimerFichier(url);
    throw e;
  }
  if (ancienne && ancienne !== url) await supprimerFichier(ancienne);
  return url;
}

// Seule la taille du cachet déjà déposé change : pas de nouvelle photo.
// Renvoie la taille enregistrée.
export async function enregistrerTailleCachet({ compteId, taille }) {
  if (!compteId) throw new Error("Compte inconnu : reconnectez-vous.");
  const t = normaliserTailleCachet(taille);
  await ecrire(compteId, { cachet_taille: t });
  return t;
}
