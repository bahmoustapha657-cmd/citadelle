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
// Le poste (permissions par module) est joint ; poste désactivé → connexion
// refusée (signalée par { desactive: true }).
async function chargerCompte(sb, userId, schoolCode) {
  let { data: c, error } = await sb.from("comptes")
    .select("*, poste:postes(id, cle, label, permissions, actif)")
    .eq("user_id", userId).maybeSingle();
  if (error) {
    // Base pas encore migrée (table postes absente) : repli sans jointure.
    ({ data: c } = await sb.from("comptes").select("*").eq("user_id", userId).maybeSingle());
  }
  if (!c) return null;
  if (c.poste && c.poste.actif === false) return { desactive: true };

  let code = schoolCode || null;
  if (!code && c.ecole_id) {
    const { data: ec } = await sb.from("ecoles").select("code").eq("id", c.ecole_id).maybeSingle();
    code = ec?.code || null;
  }

  const x = c.extra || {};
  return {
    uid: userId,
    login: c.login,
    email: c.email || "",
    nom: c.nom || c.login,
    role: c.role,
    label: c.poste?.label || c.label || c.role,
    // Poste flexible : permissions par module (null = compte legacy, repli
    // rôle via getSessionPermissions côté UI).
    posteId: c.poste?.id || c.poste_id || null,
    posteCle: c.poste?.cle || null,
    posteLabel: c.poste?.label || null,
    permissions: c.poste?.permissions || null,
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
  if (!compte || compte.desactive) {
    await sb.auth.signOut().catch(() => {});
    return { ok: false, data: { error: compte?.desactive
      ? "Compte désactivé par la direction." : "Compte introuvable." } };
  }
  return { ok: true, data: { compte } };
}

// Connexion d'un utilisateur d'école. La saisie peut être l'identifiant
// interne OU l'e-mail réel du compte (résolu via la RPC publique
// login_pour_email — l'authentification reste l'e-mail synthétique).
export async function ecoleLogin({ login, mdp, schoolId }) {
  let identifiant = String(login || "").trim();
  if (identifiant.includes("@")) {
    const { data, error } = await getSupabase()
      .rpc("login_pour_email", { p_code: schoolId, p_email: identifiant });
    if (error || !data) {
      // Même message générique qu'un mauvais mot de passe (pas d'énumération).
      return { ok: false, data: { error: "Identifiant ou mot de passe incorrect." } };
    }
    identifiant = data;
  }
  return connexionParEmail(emailFor(identifiant, schoolId), mdp, schoolId);
}

// Connexion superadmin (transversal, sans école).
export function superadminLogin({ login, mdp }) {
  return connexionParEmail(superadminEmailFor(login), mdp, null);
}

// Observe l'état d'auth Supabase ; appelle cb(utilisateur|null). Renvoie un cleanup.
export async function watchAuthState(callback) {
  const sb = getSupabase();
  // Poste désactivé pendant la session → traité comme déconnecté.
  const resoudre = async (session) => {
    if (!session?.user) return null;
    const compte = await chargerCompte(sb, session.user.id, null);
    return compte?.desactive ? null : compte;
  };
  const { data: { session } } = await sb.auth.getSession();
  callback(await resoudre(session));

  const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
    callback(await resoudre(session));
  });
  return () => sub.subscription.unsubscribe();
}

export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}
