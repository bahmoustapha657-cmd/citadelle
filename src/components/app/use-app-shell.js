import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { getCurrentUser, signOutCurrentUser } from "../../firebaseAuth";
import { PLANS, getPrimaryModuleForRole, getRoleLabelForSchool } from "../../constants";

const GRACE_MS = 7 * 86400000; // 7 jours de grâce après expiration

// Logique transverse du shell applicatif : toasts, journal d'actions,
// notifications push, calcul du plan (freemium + grâce), année courante,
// connexion/déconnexion. La page et l'UI restent gérées par App.
export function useAppShell({
  schoolId, setSchoolId, schoolInfo, schoolInfoState,
  utilisateur, setUtilisateur, setPage, nowTs, totalElevesActifs, t,
}) {
  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  };

  const logAction = (action, details = "", auteur = "") => {
    try {
      const sid = localStorage.getItem("LC_schoolId") || "citadelle";
      addDoc(collection(db, "ecoles", sid, "historique"), { action, details, auteur, date: Date.now() }).catch(() => {});
    } catch {
      // Logging is best-effort only.
    }
  };

  const [annee, setAnneeState] = useState(() => localStorage.getItem("LC_annee") || "2025-2026");
  const setAnnee = (val) => {
    setAnneeState(val);
    localStorage.setItem("LC_annee", val);
    setDoc(doc(db, "config", "annee"), { valeur: val }).catch(() => {});
  };
  useEffect(() => {
    getDoc(doc(db, "config", "annee")).then((snap) => {
      if (snap.exists()) setAnneeState(snap.data().valeur || "2025-2026");
    }).catch(() => {});
  }, []);

  // ── Calcul planInfo (freemium + période de grâce 7 jours) ──
  const planCourant = schoolInfoState.plan || "gratuit";
  const planExpiry = schoolInfoState.planExpiry || null;
  const now = nowTs;
  const planExpiryBrut = planCourant !== "gratuit" && planExpiry && now > planExpiry;
  const enPeriodeGrace = planExpiryBrut && now < planExpiry + GRACE_MS;
  const planEstExpire = planExpiryBrut && !enPeriodeGrace; // vraiment expiré (après grâce)
  const joursGrace = enPeriodeGrace ? Math.ceil((planExpiry + GRACE_MS - now) / 86400000) : null;
  const joursRestants = planExpiry && !planExpiryBrut ? Math.ceil((planExpiry - now) / 86400000) : null;
  // Pendant la période de grâce : on garde les limites du plan payant
  const eleveLimit = planEstExpire
    ? PLANS.gratuit.eleveLimit
    : (PLANS[planCourant]?.eleveLimit ?? PLANS.gratuit.eleveLimit);
  const planInfo = {
    planCourant,
    planExpiry,
    planEstExpire,
    enPeriodeGrace,
    joursGrace,
    joursRestants,
    eleveLimit,
    totalElevesActifs,
    peutAjouterEleve: totalElevesActifs < eleveLimit,
    planLabel: t(`plans.${planCourant}`, PLANS[planCourant]?.label ?? "Gratuit"),
  };

  // Synchronise le profil public de l'école (direction/admin uniquement).
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return undefined;
    if (!["direction", "admin"].includes(utilisateur.role)) return undefined;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        if (annule) return;
        await apiFetch("/ecole-public-sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync", schoolId }),
        });
      } catch {
        // Best effort only: keep the public school profile aligned.
      }
    })();
    return () => { annule = true; };
  }, [schoolId, utilisateur]);

  const envoyerPush = async (cibles, titre, corps, url = "/") => {
    const sid = localStorage.getItem("LC_schoolId") || "citadelle";
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    apiFetch("/push", {
      method: "POST",
      headers,
      body: JSON.stringify({ schoolId: sid, cibles, titre, corps, url }),
    }).catch(() => {});
  };

  // Abonnement push après login (silencieux si refus).
  const sAbonnerAuxPush = async (utilisateurCo, sid) => {
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
  };

  const connecter = (c, sid) => {
    if (sid) { setSchoolId(sid); localStorage.setItem("LC_schoolId", sid); }
    setUtilisateur(c);
    setPage(getPrimaryModuleForRole(c.role, schoolInfo));
    const labelConnexion = getRoleLabelForSchool(c.role, schoolInfo) || c.label || c.role;
    logAction("Connexion", `${c.nom} (${labelConnexion})`, c.nom);
    const schoolIdEffectif = sid || localStorage.getItem("LC_schoolId") || "citadelle";
    sAbonnerAuxPush(c, schoolIdEffectif);
  };

  const deconnecter = () => {
    signOutCurrentUser().catch(() => {});
    setUtilisateur(null);
    setPage(null);
  };

  return { toasts, toast, logAction, annee, setAnnee, planInfo, envoyerPush, connecter, deconnecter };
}
