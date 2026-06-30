// Accès Firestore / réseau des onglets Écoles / Plans / Demandes du panel
// super-admin : chargement écoles+stats, abonnement aux demandes, validation
// de plan, application de plan, cycle de vie et création d'école.
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { apiFetch, getAuthHeaders } from "../../../apiClient";
import { PLANS } from "../../../constants";
import { db } from "../../../firebaseDb";
import { safeOnSnapshot } from "../../../firestore-safe";
import { NEW_SCHOOL_DEFAULTS } from "../constants";
import { isSupabase } from "../../../backend";
import * as sbAdmin from "../../../backend/superadmin-supabase";

// Charge toutes les écoles + leurs stats (effectifs, comptes, enseignants).
export async function chargerEcolesAvecStats() {
  if (isSupabase) return sbAdmin.chargerEcolesAvecStats();
  const snap = await getDocs(collection(db, "ecoles"));
  const liste = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
  const statsMap = {};
  await Promise.all(liste.map(async (e) => {
    const sizeOf = (coll) => getDocs(collection(db, "ecoles", e._id, coll)).then(s => s.size).catch(() => 0);
    const [elevesP, elevesC, elevesL, comptes, ensP, ensC, ensL] = await Promise.all([
      sizeOf("elevesPrimaire"),
      sizeOf("elevesCollege"),
      sizeOf("elevesLycee"),
      sizeOf("comptes"),
      sizeOf("ensPrimaire"),
      sizeOf("ensCollege"),
      sizeOf("ensLycee"),
    ]);
    statsMap[e._id] = {
      eleves: elevesP + elevesC + elevesL,
      comptes,
      enseignants: ensP + ensC + ensL,
    };
  }));
  return { liste, statsMap };
}

// Abonnement temps réel aux demandes de plan (collectionGroup). Renvoie l'unsub.
export function souscrireDemandes(onData) {
  if (isSupabase) return sbAdmin.souscrireDemandes(onData);
  try {
    const q = collectionGroup(db, "demandes_plan");
    return safeOnSnapshot(q, snap => {
      const liste = snap.docs
        .map(d => ({ ...d.data(), _id: d.id, _schoolId: d.ref.parent.parent.id }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(liste);
    }, () => {});
  } catch { return () => {}; }
}

// Valide une demande : active le plan, marque la demande, trace l'historique.
// Renvoie { plan, update } pour la mise à jour optimiste côté hook.
export async function validerDemandeApi(demande) {
  if (isSupabase) return sbAdmin.validerDemandeApi(demande);
  const plan = demande.planDemande || "starter";
  const update = {
    plan, planExpiry: Date.now() + 365 * 86400000,
    planActivatedBy: "superadmin", planActivatedAt: Date.now(),
  };
  await updateDoc(doc(db, "ecoles", demande._schoolId), update);
  await updateDoc(doc(db, "ecoles", demande._schoolId, "demandes_plan", demande._id), { statut: "validee" });
  await addDoc(collection(db, "ecoles", demande._schoolId, "historique"), {
    action: "Plan active",
    details: `Plan ${PLANS[plan]?.label || plan} active par le superadmin - valable 1 an`,
    auteur: "EduGest", date: Date.now(),
  }).catch(() => {});
  return { plan, update };
}

export async function rejeterDemandeApi(demande) {
  if (isSupabase) return sbAdmin.rejeterDemandeApi(demande);
  await updateDoc(doc(db, "ecoles", demande._schoolId, "demandes_plan", demande._id), { statut: "rejetee" });
}

// Applique un plan (updateDoc bloquant) + notifications best-effort (historique, push).
export async function appliquerPlan(ecoleId, update, { planLabel, expMsg }) {
  if (isSupabase) return sbAdmin.appliquerPlan(ecoleId, update);
  await updateDoc(doc(db, "ecoles", ecoleId), update);
  addDoc(collection(db, "ecoles", ecoleId, "historique"), {
    action: "Plan mis a jour",
    details: `Plan ${planLabel} active par le superadmin${expMsg}`,
    auteur: "EduGest", date: Date.now(),
  }).catch(() => {});
  getAuthHeaders({ "Content-Type": "application/json" }).then(headers =>
    apiFetch("/push", {
      method: "POST", headers,
      body: JSON.stringify({
        schoolId: ecoleId,
        cibles: ["admin", "direction"],
        titre: `Plan ${planLabel} active`,
        corps: `Votre abonnement ${planLabel} est maintenant actif${expMsg}.`,
        url: "/",
      }),
    })
  ).catch(() => {});
}

// Action de cycle de vie sur une école. Renvoie { ok, data }.
export async function executerCycleVieApi({ schoolId, action, confirmation }) {
  if (isSupabase) return sbAdmin.executerCycleVieApi({ schoolId, action, confirmation });
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await apiFetch("/school-lifecycle", {
    method: "POST", headers,
    body: JSON.stringify({ schoolId, action, confirmation }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && data.ok, data };
}

// Crée une école si le code (slug) est libre, puis sync la page publique.
// Renvoie { ok:false } si le code existe déjà, sinon { ok:true }.
export async function creerEcoleApi(nouvelleEcole, sid) {
  if (isSupabase) return sbAdmin.creerEcoleApi(nouvelleEcole, sid);
  const existing = await getDoc(doc(db, "ecoles", sid));
  if (existing.exists()) return { ok: false };
  await setDoc(doc(db, "ecoles", sid), {
    ...NEW_SCHOOL_DEFAULTS,
    nom: nouvelleEcole.nom.trim(),
    ville: nouvelleEcole.ville.trim(),
    pays: nouvelleEcole.pays.trim() || "Guinee",
    createdAt: Date.now(),
  });
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    await apiFetch("/ecole-public-sync", {
      method: "POST", headers,
      body: JSON.stringify({ action: "sync", schoolId: sid }),
    });
  } catch { /* non-bloquant */ }
  return { ok: true };
}
