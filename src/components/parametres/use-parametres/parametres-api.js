// Appels réseau de l'écran « Paramètres de l'école » : sauvegarde de la
// monnaie (comptable), sauvegarde complète des paramètres, et cycle de vie
// (désactiver / supprimer).
import { JOURS_SEMAINE, getSectionsActives } from "../../../constants";
import { uploadImage } from "../../../storageUtils";
import { majReglagesCompta, sauverParametresEcole } from "../../../backend/data-supabase";

const normaliserMonnaie = (m) => (m || "GNF").trim().toUpperCase();

// Jours de classe : ordre canonique de la semaine, intrus écartés, jamais vide.
const joursValides = (brut) => {
  const retenus = Array.isArray(brut) ? JOURS_SEMAINE.filter((j) => brut.includes(j)) : [];
  return retenus.length ? retenus : [...JOURS_SEMAINE];
};

// Sauvegarde restreinte au seul champ `monnaie` (rôle comptable). RPC
// dédiée : la policy ecoles_update est fermée au comptable, un update direct
// y était refusé en silence (monnaie jamais enregistrée).
export async function sauvegarderMonnaie({ monnaie }) {
  const valeur = normaliserMonnaie(monnaie);
  await majReglagesCompta({ monnaie: valeur });
  return valeur;
}

// Sauvegarde complète des paramètres.
// Renvoie l'objet `data` écrit (pour mettre à jour schoolInfo côté hook).
export async function sauvegarderParametres({ schoolId, form, accueil, evaluationForms }) {
  // Logo et signature arrivent en base64 (l'écran en a besoin pour l'aperçu
  // et l'extraction des couleurs) mais ne doivent pas FINIR en base64 dans la
  // colonne : un logo de 339 ko repartait à chaque lecture de la fiche école.
  // uploadImage est idempotent — une valeur déjà en URL traverse sans rien
  // téléverser, donc enregistrer deux fois de suite ne duplique aucun fichier.
  const logo = await uploadImage(form.logo, schoolId, "logo");
  const signatureUrl = await uploadImage(form.signatureUrl, schoolId, "signatures");
  // Page publique : la bannière et la galerie suivaient le même chemin que le
  // logo — du base64 stocké dans extra.accueil, donc relu à chaque lecture de
  // la fiche école. Une galerie de dix photos pèse plus lourd qu'un logo.
  // Les photos partent EN PARALLÈLE : une galerie fraîchement remplie ferait
  // sinon patienter l'utilisateur sur autant d'envois enchaînés.
  const bannerUrl = await uploadImage(accueil.bannerUrl, schoolId, "accueil");
  const photos = await Promise.all(
    (accueil.photos || []).map(async (p) => ({
      ...p,
      url: await uploadImage(p.url, schoolId, "accueil"),
    })),
  );
  const data = {
    nom: form.nom.trim(),
    type: form.type.trim(),
    ville: form.ville.trim(),
    pays: form.pays.trim(),
    couleur1: form.couleur1,
    couleur2: form.couleur2,
    logo: logo || null,
    devise: form.devise.trim(),
    monnaie: normaliserMonnaie(form.monnaie),
    // ministere / ire / dpe / agrement : MIGRÉS vers le profil légal (colonne
    // ecoles.legal, édité via le widget Conformité). Plus écrits par ce formulaire.
    // Les valeurs existantes restent en place (fusion), utilisées par
    // resolveLegalFields() comme fallback tant que le profil légal structuré
    // n'est pas complet.
    moisDebut: form.moisDebut,
    systemeScolaire: form.systemeScolaire || "guineen",
    // Sections réellement ouvertes (école sans lycée…) — pilote l'UI.
    // Vide ou invalide : toutes, préscolaire compris.
    sectionsActives: getSectionsActives(form),
    modeleBulletin: form.modeleBulletin || "classique",
    signatureUrl: signatureUrl || null,
    periodicite: form.periodicite || "trimestre",
    periodicitePrimaire: form.periodicitePrimaire || "trimestre",
    periodiciteSecondaire: form.periodiciteSecondaire || "trimestre",
    periodicitePrescolaire: form.periodicitePrescolaire || form.periodicitePrimaire || "trimestre",
    // Jours de classe par section — colonnes de l'emploi du temps (écran + PDF).
    joursOuvrablesPrimaire: joursValides(form.joursOuvrablesPrimaire),
    joursOuvrablesSecondaire: joursValides(form.joursOuvrablesSecondaire),
    evaluationForms,
    accueil: {
      active: accueil.active,
      slogan: accueil.slogan.trim(),
      texteAccueil: accueil.texteAccueil.trim(),
      bannerUrl: bannerUrl.trim(),
      photos,
      showAnnonces: accueil.showAnnonces,
      showHonneurs: accueil.showHonneurs,
      showContact: accueil.showContact,
      telephone: accueil.telephone.trim(),
      email: accueil.email.trim(),
      facebook: accueil.facebook.trim(),
      whatsapp: accueil.whatsapp.trim(),
      adresse: accueil.adresse.trim(),
    },
  };
  // La page vitrine lit la fiche via la RPC etat_ecole : rien à synchroniser.
  await sauverParametresEcole(schoolId, data);
  return data;
}

// Action de cycle de vie (désactivation / suppression logique), par
// l'adaptateur superadmin (RLS is_superadmin). Renvoie { ok, data }.
export async function executerCycleVie({ schoolId, action, confirmation }) {
  const { executerCycleVieApi } = await import("../../../backend/superadmin-supabase");
  try {
    // Renvoie déjà { ok, data } : on ne réemballe pas.
    return await executerCycleVieApi({ schoolId, action, confirmation });
  } catch (e) {
    return { ok: false, data: { error: e.message } };
  }
}
