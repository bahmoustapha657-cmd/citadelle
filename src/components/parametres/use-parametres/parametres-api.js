// Appels réseau / Firestore de l'écran « Paramètres de l'école » :
// sauvegarde de la monnaie (comptable), sauvegarde complète des paramètres
// + sync de la page publique, et cycle de vie (désactiver / supprimer).
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../../apiClient";

const normaliserMonnaie = (m) => (m || "GNF").trim().toUpperCase();

// Sauvegarde restreinte au seul champ `monnaie` (rôle comptable).
export async function sauvegarderMonnaie({ schoolId, monnaie }) {
  const valeur = normaliserMonnaie(monnaie);
  await updateDoc(doc(db, "ecoles", schoolId), { monnaie: valeur });
  return valeur;
}

// Sauvegarde complète des paramètres puis sync de la page publique.
// Renvoie l'objet `data` écrit (pour mettre à jour schoolInfo côté hook).
export async function sauvegarderParametres({ schoolId, form, accueil, evaluationForms }) {
  const data = {
    nom: form.nom.trim(),
    type: form.type.trim(),
    ville: form.ville.trim(),
    pays: form.pays.trim(),
    couleur1: form.couleur1,
    couleur2: form.couleur2,
    logo: form.logo || null,
    devise: form.devise.trim(),
    monnaie: normaliserMonnaie(form.monnaie),
    // ministere / ire / dpe / agrement : MIGRÉS vers /ecoles/{schoolId}/config/legal
    // (édités via le widget Conformité). Plus écrits par ce formulaire.
    // Les valeurs Firestore existantes restent en place (updateDoc merge),
    // utilisées par resolveLegalFields() comme fallback tant que le profil
    // légal structuré n'est pas complet.
    moisDebut: form.moisDebut,
    systemeScolaire: form.systemeScolaire || "guineen",
    periodicite: form.periodicite || "trimestre",
    periodicitePrimaire: form.periodicitePrimaire || "trimestre",
    periodiciteSecondaire: form.periodiciteSecondaire || "trimestre",
    evaluationForms,
    accueil: {
      active: accueil.active,
      slogan: accueil.slogan.trim(),
      texteAccueil: accueil.texteAccueil.trim(),
      bannerUrl: accueil.bannerUrl.trim(),
      photos: accueil.photos,
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
  await updateDoc(doc(db, "ecoles", schoolId), data);
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    await apiFetch("/ecole-public-sync", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "sync", schoolId }),
    });
  } catch { /* non-bloquant : la source privée est à jour */ }
  return data;
}

// Action de cycle de vie (désactivation / suppression logique).
// Renvoie { ok, data } ; le décodage JSON est tolérant aux réponses vides.
export async function executerCycleVie({ schoolId, action, confirmation }) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await apiFetch("/school-lifecycle", {
    method: "POST",
    headers,
    body: JSON.stringify({ schoolId, action, confirmation }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && data.ok, data };
}
