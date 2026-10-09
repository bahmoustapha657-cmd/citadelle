// Accès transverses du shell : journal d'actions, année courante,
// notifications push.
import { sAbonnerAuxPush as sAbonnerSupabase, envoyerPush as envoyerPushSupabase } from "../../backend/push-supabase";

// Journalise une action (best-effort, jamais bloquant).
// Table `historique` via ajouterDoc — passe par le miroir local hors ligne
// (l'écriture est mise en file et remonte à la reconnexion).
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

// Persiste l'année courante de l'ÉCOLE (ecoles.extra.anneeScolaire)
// + cache local. Renvoie la promesse pour que l'appelant puisse signaler un
// refus (seule la Direction peut modifier la fiche école).
export function persisterAnnee(schoolId, val) {
  localStorage.setItem("LC_annee", val);
  if (!schoolId || schoolId === "superadmin") return Promise.resolve();
  return import("../../backend/data-supabase")
    .then(({ sauverParametresEcole }) => sauverParametresEcole(schoolId, { anneeScolaire: val }));
}

// Envoie une notification push (best-effort). `options.eleveId` : l'élève
// concerné quand on prévient ses parents (cf. push-supabase.js).
export function envoyerPushApi(cibles, titre, corps, url = "/", options = {}) {
  return envoyerPushSupabase(cibles, titre, corps, url, options);
}

// Abonnement push après login (silencieux si refus).
export function sAbonnerAuxPush(utilisateurCo, sid) {
  return sAbonnerSupabase(utilisateurCo, sid);
}
