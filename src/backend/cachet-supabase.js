// ── Cachet et signature personnels ──────────────────────────────────────────
// Un comptable ou un chef de section dépose LUI-MÊME l'image de son cachet
// signé (menu profil). Elle est rangée dans le stockage (bucket photos,
// <code_ecole>/cachets/…) et son URL dans comptes.cachet_url, que seul le
// titulaire du compte peut écrire (trigger comptes_cachet_guard) — la
// Direction ne peut ni la poser ni la changer à sa place. Même règle pour sa
// taille et sa position à l'impression (comptes.cachet_taille, cachet_dx,
// cachet_dy).
import { getSupabase } from "../supabaseClient";
import { supprimerFichier, uploadImage } from "../storageUtils";
import { normaliserDecalageCachet, normaliserTailleCachet } from "../reports/signataire-session";

const messageErreur = (error) => {
  const brut = String(error?.message || "");
  if (/cachet_\w+/.test(brut) && /column|colonne|schema cache/i.test(brut)) {
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

// Colonnes de la taille et de la position, normalisées comme à l'impression.
const colonnesPlacement = (taille, decalage) => {
  const { x, y } = normaliserDecalageCachet(decalage);
  return { cachet_taille: normaliserTailleCachet(taille), cachet_dx: x, cachet_dy: y };
};

// `image` : data URL (nouveau cachet) ou "" (retirer). `ancienne` : URL du
// cachet remplacé, effacé du stockage une fois l'enregistrement confirmé.
// `taille`, `decalage` : taille et position à l'impression (remises à 1 et au
// centre si le cachet est retiré).
// Renvoie l'URL enregistrée ("" si retiré). Réseau requis : l'image doit être
// en ligne pour que les autres appareils du titulaire l'impriment aussi.
export async function enregistrerMonCachet({ compteId, schoolId, image, ancienne = "", taille = 1, decalage = null }) {
  if (!compteId || !schoolId) throw new Error("Compte inconnu : reconnectez-vous.");
  const url = image ? await uploadImage(image, schoolId, "cachets") : "";
  try {
    await ecrire(compteId, { cachet_url: url || null, ...colonnesPlacement(url ? taille : 1, url ? decalage : null) });
  } catch (e) {
    if (url && url !== ancienne) supprimerFichier(url);
    throw e;
  }
  if (ancienne && ancienne !== url) await supprimerFichier(ancienne);
  return url;
}

// Seules la taille et la position du cachet déjà déposé changent : pas de
// nouvelle photo. Renvoie { taille, decalage } enregistrés.
export async function enregistrerPlacementCachet({ compteId, taille, decalage }) {
  if (!compteId) throw new Error("Compte inconnu : reconnectez-vous.");
  const colonnes = colonnesPlacement(taille, decalage);
  await ecrire(compteId, colonnes);
  return { taille: colonnes.cachet_taille, decalage: { x: colonnes.cachet_dx, y: colonnes.cachet_dy } };
}
