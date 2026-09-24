// Accès transverses du shell : journal d'actions, année courante,
// notifications push.
//
// Deux fonctions ont disparu avec la liquidation Firebase (lot 5) :
//   • chargerAnnee() lisait l'ancien doc global config/annee, d'avant la
//     migration vers ecoles/{id}.anneeScolaire — elle ne pouvait plus rien
//     ramener et son repli silencieux masquait ce fait.
//   • syncEcolePublic() alimentait le miroir ecoles_public de Firestore. Sur
//     Supabase il n'y a pas de miroir à tenir : la résolution publique passe
//     par la RPC etat_ecole. La fonction n'était plus qu'un `return` immédiat.
import { sAbonnerAuxPush as sAbonnerSupabase, envoyerPush as envoyerPushSupabase } from "../../backend/push-supabase";

// Journalise une action (best-effort, jamais bloquant).
// L'écriture passe par ajouterDoc, donc par le miroir local hors ligne : elle
// est mise en file et remonte à la reconnexion.
export function logActionDoc(action, details = "", auteur = "") {
  try {
    const sid = localStorage.getItem("LC_schoolId");
    if (!sid) return; // jamais de fallback vers une école par défaut
    const item = { action, details, auteur, date: Date.now() };
    import("../../backend/data-supabase")
      .then(({ ajouterDoc }) => ajouterDoc(sid, "historique", item))
      .catch(() => {});
  } catch {
    // Logging is best-effort only.
  }
}

// Persiste l'année courante de l'ÉCOLE (ecoles/{id}.anneeScolaire), et non de
// l'appareil : tous les postes de l'établissement doivent voir la même.
export function persisterAnnee(schoolId, val) {
  localStorage.setItem("LC_annee", val);
  if (!schoolId || schoolId === "superadmin") return Promise.resolve();
  return import("../../backend/data-supabase")
    .then(({ sauverParametresEcole }) => sauverParametresEcole(schoolId, { anneeScolaire: val }));
}

// Envoie une notification push (best-effort).
export const envoyerPushApi = (cibles, titre, corps, url = "/") =>
  envoyerPushSupabase(cibles, titre, corps, url);

// Abonnement push après login (silencieux si refus).
export const sAbonnerAuxPush = (utilisateurCo, sid) => sAbonnerSupabase(utilisateurCo, sid);
