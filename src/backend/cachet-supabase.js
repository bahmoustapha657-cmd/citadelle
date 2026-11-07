// ── Cachet et signature personnels ──────────────────────────────────────────
// Un comptable ou un chef de section dépose LUI-MÊME l'image de son cachet
// (tampon) et, s'il le souhaite, celle de sa signature à part (menu profil).
// Elles sont rangées dans le stockage (bucket photos, <code_ecole>/cachets/…)
// et leurs URL dans comptes.cachet_url et comptes.signature_url, que seul le
// titulaire du compte peut écrire (trigger comptes_cachet_guard) — la
// Direction ne peut ni les poser ni les changer à sa place. Même règle pour
// leur taille et leur position à l'impression (comptes.cachet_taille,
// cachet_dx, cachet_dy, et les mêmes pour signature_*).
import { getSupabase } from "../supabaseClient";
import { supprimerFichier, uploadImage } from "../storageUtils";
import { normaliserDecalageCachet, normaliserTailleCachet } from "../reports/signataire-session";

// Les deux images d'un compte, préfixe de leurs colonnes.
export const ELEMENTS_CACHET = ["cachet", "signature"];

const messageErreur = (error) => {
  const brut = String(error?.message || "");
  if (/(cachet|signature)_\w+/.test(brut) && /column|colonne|schema cache/i.test(brut)) {
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

const verifierElement = (element) => {
  if (!ELEMENTS_CACHET.includes(element)) throw new Error(`Élément inconnu : ${element}`);
};

// Taille et position d'un élément, normalisées comme à l'impression.
export const placementNormalise = (placement) => ({
  taille: normaliserTailleCachet(placement?.taille),
  decalage: normaliserDecalageCachet(placement?.decalage),
});

// Colonnes de la taille et de la position des éléments de `placements`
// ({ cachet: { taille, decalage }, signature: { … } }, chacun facultatif).
const colonnesPlacement = (placements = {}) => Object.fromEntries(
  ELEMENTS_CACHET.filter((element) => placements[element]).flatMap((element) => {
    const { taille, decalage } = placementNormalise(placements[element]);
    return [[`${element}_taille`, taille], [`${element}_dx`, decalage.x], [`${element}_dy`, decalage.y]];
  }));

// Dépose, remplace ou retire l'image d'un élément (`element` : "cachet" ou
// "signature"). `image` : data URL (nouvelle image) ou "" (retirer).
// `ancienne` : URL remplacée, effacée du stockage une fois l'enregistrement
// confirmé. `placements` : taille et position de chaque élément, enregistrées
// avec ; celles d'un élément retiré reviennent à 1 et au centre.
// Renvoie l'URL enregistrée ("" si retirée). Réseau requis : l'image doit être
// en ligne pour que les autres appareils du titulaire l'impriment aussi.
export async function enregistrerMonCachet({ compteId, schoolId, element = "cachet", image, ancienne = "", placements = {} }) {
  verifierElement(element);
  if (!compteId || !schoolId) throw new Error("Compte inconnu : reconnectez-vous.");
  const url = image ? await uploadImage(image, schoolId, "cachets") : "";
  const reglages = { ...placements, [element]: url ? placements[element] || {} : {} };
  try {
    await ecrire(compteId, { [`${element}_url`]: url || null, ...colonnesPlacement(reglages) });
  } catch (e) {
    if (url && url !== ancienne) supprimerFichier(url);
    throw e;
  }
  if (ancienne && ancienne !== url) await supprimerFichier(ancienne);
  return url;
}

// Seules la taille et la position des images déjà déposées changent : pas de
// nouvelle photo. Renvoie les placements enregistrés, normalisés.
export async function enregistrerPlacementCachet({ compteId, placements = {} }) {
  if (!compteId) throw new Error("Compte inconnu : reconnectez-vous.");
  const colonnes = colonnesPlacement(placements);
  if (!Object.keys(colonnes).length) return {};
  await ecrire(compteId, colonnes);
  return Object.fromEntries(ELEMENTS_CACHET.filter((element) => placements[element])
    .map((element) => [element, placementNormalise(placements[element])]));
}
