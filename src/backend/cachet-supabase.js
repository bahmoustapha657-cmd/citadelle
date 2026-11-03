// ── Cachet et signature personnels ──────────────────────────────────────────
// Un comptable ou un chef de section dépose LUI-MÊME l'image de son cachet
// signé (menu profil). Elle est rangée dans le stockage (bucket photos,
// <code_ecole>/cachets/…) et son URL dans comptes.cachet_url, que seul le
// titulaire du compte peut écrire (trigger comptes_cachet_guard) — la
// Direction ne peut ni la poser ni la changer à sa place.
import { getSupabase } from "../supabaseClient";
import { supprimerFichier, uploadImage } from "../storageUtils";

const messageErreur = (error) => {
  const brut = String(error?.message || "");
  if (/cachet_url/.test(brut) && /column|colonne|schema cache/i.test(brut)) {
    return "Le dépôt du cachet n'est pas encore disponible sur le serveur. Réessayez après la prochaine mise à jour.";
  }
  if (error?.code === "42501" || /titulaire/i.test(brut)) {
    return "Seul le titulaire du compte peut déposer, remplacer ou retirer son cachet.";
  }
  return brut || "Enregistrement du cachet impossible.";
};

// `image` : data URL (nouveau cachet) ou "" (retirer). `ancienne` : URL du
// cachet remplacé, effacé du stockage une fois l'enregistrement confirmé.
// Renvoie l'URL enregistrée ("" si retiré). Réseau requis : l'image doit être
// en ligne pour que les autres appareils du titulaire l'impriment aussi.
export async function enregistrerMonCachet({ compteId, schoolId, image, ancienne = "" }) {
  if (!compteId || !schoolId) throw new Error("Compte inconnu : reconnectez-vous.");
  const url = image ? await uploadImage(image, schoolId, "cachets") : "";
  const sb = getSupabase();
  // `.select()` : un refus RLS ne lève pas d'erreur, il ne touche aucune ligne.
  const { data, error } = await sb.from("comptes")
    .update({ cachet_url: url || null }).eq("id", compteId).select("id");
  if (error || !data?.length) {
    if (url && url !== ancienne) supprimerFichier(url);
    throw new Error(error ? messageErreur(error) : "Enregistrement refusé : ce compte n'est pas le vôtre.");
  }
  if (ancienne && ancienne !== url) await supprimerFichier(ancienne);
  return url;
}
