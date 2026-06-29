// ── Authentification / session via Supabase ─────────────────────────────────
// Reproduit le contrat du backend Firebase : mêmes formes de retour pour que
// l'UI (useConnexion, useAuthSession) n'ait pas à savoir quel backend tourne.
//   - fetchEtatEcole(sid)      → { info, statut }
//   - ecoleLogin / superadminLogin({...}) → { ok, data:{ compte | error } }
//   - watchAuthState(cb)       → cb(utilisateur|null), renvoie un cleanup
//   - signOut()
// Pas de customToken : signInWithPassword établit directement la session.
import { getSupabase } from "../supabaseClient";
import { emailFor, superadminEmailFor } from "../backend";

// État public d'une école (avant connexion) via la RPC publique `etat_ecole`.
export async function fetchEtatEcole(sid) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("etat_ecole", { p_code: sid });
  if (error || !data || !data.length) return { info: null, statut: "" };
  const e = data[0];
  if (e.supprime === true) return { info: null, statut: "supprimee" };
  if (e.actif === false) return { info: null, statut: "inactive" };
  return { info: { nom: e.nom, logo: e.logo, couleur1: e.couleur1, couleur2: e.couleur2, code: e.code }, statut: "" };
}

// Construit l'utilisateur de session depuis la table `comptes` (filtrée par RLS).
// `schoolCode` est fourni à la connexion ; au refresh on le résout via ecole_id.
async function chargerCompte(sb, userId, schoolCode) {
  const { data: c } = await sb.from("comptes").select("*").eq("user_id", userId).maybeSingle();
  if (!c) return null;

  let code = schoolCode || null;
  if (!code && c.ecole_id) {
    const { data: ec } = await sb.from("ecoles").select("code").eq("id", c.ecole_id).maybeSingle();
    code = ec?.code || null;
  }

  const x = c.extra || {};
  return {
    uid: userId,
    login: c.login,
    nom: c.nom || c.login,
    role: c.role,
    label: c.label || c.role,
    premiereCo: !!c.premiere_co,
    compteDocId: c.id,
    schoolId: code,
    section: c.section || null,
    sections: Array.isArray(c.sections) ? c.sections : [],
    enseignantId: c.enseignant_id || null,
    enseignantNom: c.enseignant_nom || "",
    matiere: c.matiere || "",
    // Champs parent/élève : stockés dans `extra` côté Supabase.
    eleveId: x.eleveId || null,
    eleveIds: Array.isArray(x.eleveIds) ? x.eleveIds : [],
    eleveNom: x.eleveNom || "",
    eleveClasse: x.eleveClasse || "",
    elevesAssocies: Array.isArray(x.elevesAssocies) ? x.elevesAssocies : [],
    tuteur: x.tuteur || "",
    contactTuteur: x.contactTuteur || "",
    filiation: x.filiation || "",
  };
}

async function connexionParEmail(email, mdp, schoolCode) {
  const sb = getSupabase();
  const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: mdp });
  if (error || !auth?.user) {
    return { ok: false, data: { error: "Identifiant ou mot de passe incorrect." } };
  }
  const compte = await chargerCompte(sb, auth.user.id, schoolCode);
  if (!compte) {
    await sb.auth.signOut().catch(() => {});
    return { ok: false, data: { error: "Compte introuvable." } };
  }
  return { ok: true, data: { compte } };
}

// Connexion d'un utilisateur d'école.
export function ecoleLogin({ login, mdp, schoolId }) {
  return connexionParEmail(emailFor(login, schoolId), mdp, schoolId);
}

// Connexion superadmin (transversal, sans école).
export function superadminLogin({ login, mdp }) {
  return connexionParEmail(superadminEmailFor(login), mdp, null);
}

// Observe l'état d'auth Supabase ; appelle cb(utilisateur|null). Renvoie un cleanup.
export async function watchAuthState(callback) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  callback(session?.user ? await chargerCompte(sb, session.user.id, null) : null);

  const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
    callback(session?.user ? await chargerCompte(sb, session.user.id, null) : null);
  });
  return () => sub.subscription.unsubscribe();
}

export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}
