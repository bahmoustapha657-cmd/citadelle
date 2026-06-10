// Accès Firestore/API transverses du shell : journal d'actions, année
// courante, synchronisation du profil public, notifications push.
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { getCurrentUser } from "../../firebaseAuth";

// Journalise une action (best-effort, jamais bloquant).
export function logActionDoc(action, details = "", auteur = "") {
  try {
    const sid = localStorage.getItem("LC_schoolId");
    if (!sid) return; // jamais de fallback vers une école par défaut
    addDoc(collection(db, "ecoles", sid, "historique"), { action, details, auteur, date: Date.now() }).catch(() => {});
  } catch {
    // Logging is best-effort only.
  }
}

// Persiste l'année courante (localStorage + config Firestore).
export function persisterAnnee(val) {
  localStorage.setItem("LC_annee", val);
  setDoc(doc(db, "config", "annee"), { valeur: val }).catch(() => {});
}

// Charge l'année courante depuis Firestore (null si absente/erreur).
export function chargerAnnee() {
  return getDoc(doc(db, "config", "annee"))
    .then((snap) => (snap.exists() ? snap.data().valeur || "2025-2026" : null))
    .catch(() => null);
}

// Synchronise le profil public de l'école.
export async function syncEcolePublic(schoolId) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  await apiFetch("/ecole-public-sync", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "sync", schoolId }),
  });
}

// Envoie une notification push (best-effort).
export async function envoyerPushApi(cibles, titre, corps, url = "/") {
  const sid = localStorage.getItem("LC_schoolId");
  if (!sid) return; // jamais de fallback vers une école par défaut
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  apiFetch("/push", {
    method: "POST",
    headers,
    body: JSON.stringify({ schoolId: sid, cibles, titre, corps, url }),
  }).catch(() => {});
}

// Abonnement push après login (silencieux si refus).
export async function sAbonnerAuxPush(utilisateurCo, sid) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const currentUser = await getCurrentUser();
    if (!currentUser?.uid) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });
    await setDoc(doc(db, "ecoles", sid, "pushSubs", currentUser.uid), {
      subscription: sub.toJSON(),
      role: utilisateurCo.role,
      nom: utilisateurCo.nom,
      uid: currentUser.uid,
      updatedAt: Date.now(),
    });
  } catch {
    // Push subscription is optional.
  }
}
