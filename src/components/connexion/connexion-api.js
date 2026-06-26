// Accès réseau/Firestore de la connexion : résolution de l'état d'une école
// et appels d'authentification (superadmin + école standard).
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { apiFetch } from "../../apiClient";

// Interprète un snapshot d'école → { info, statut }.
// statut ∈ "" (ok), "supprimee", "inactive" ; info=null si indisponible.
function interpreterEtat(snap) {
  if (!snap.exists()) return { info: null, statut: "" };
  const data = snap.data() || {};
  if (data.supprime === true) return { info: null, statut: "supprimee" };
  if (data.actif === false) return { info: null, statut: "inactive" };
  return { info: data, statut: "" };
}

// Lookup de l'état d'une école (privé d'abord, repli public).
export async function fetchEtatEcole(sid) {
  const publicRef = doc(db, "ecoles_public", sid);
  const privateRef = doc(db, "ecoles", sid);
  try {
    const snap = await getDocFromServer(privateRef).catch(async () => getDocFromServer(publicRef));
    return interpreterEtat(snap);
  } catch {
    const snap = await getDoc(publicRef);
    return interpreterEtat(snap);
  }
}

async function postLogin(route, body) {
  // Timeout de 25 s : au-dela, on considere le serveur injoignable plutot que
  // de laisser la connexion tourner indefiniment.
  const reponse = await apiFetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 25000,
  });
  const data = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok && data.ok, data };
}

// Authentification superadmin.
export function superadminLogin({ login, mdp }) {
  return postLogin("/superadmin-login", { login: login.trim(), mdp });
}

// Authentification d'un utilisateur d'école.
export function ecoleLogin({ login, mdp, schoolId }) {
  return postLogin("/login", { login: login.trim().toLowerCase(), mdp, schoolId });
}
