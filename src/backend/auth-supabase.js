// ── Authentification / session via Supabase ─────────────────────────────────
// Reproduit le contrat du backend Firebase : mêmes formes de retour pour que
// l'UI (useConnexion, useAuthSession) n'ait pas à savoir quel backend tourne.
//   - fetchEtatEcole(sid)      → { info, statut }
//   - ecoleLogin / superadminLogin({...}) → { ok, data:{ compte | error } }
//   - watchAuthState(cb)       → cb(utilisateur|null), renvoie un cleanup
//   - signOut()
// Pas de customToken : signInWithPassword établit directement la session.
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { getSupabase, uidSessionEnregistree } from "../supabaseClient";
import { emailFor, superadminEmailFor } from "../backend";
import { identifiantConnexion } from "../comptes-parents";
import { powerSyncConfigured } from "./powersync/tables";
import { miroirAutreCompte } from "./powersync/proprietaire";

// ── Compte mémorisé : démarrage sans attendre le réseau ─────────────────────
// Le compte construit à la dernière ouverture est gardé sur l'appareil. Au
// lancement, l'app s'ouvre aussitôt dessus (hors ligne compris) ; la
// vérification serveur (poste désactivé, droits modifiés…) suit en arrière-
// plan et remplace ce compte s'il a changé. Effacé à la déconnexion.
const CLE_COMPTE = "LC_compte_session";

function lireCompteMemorise(uid) {
  try {
    const compte = JSON.parse(localStorage.getItem(CLE_COMPTE) || "null");
    return compte && compte.uid === uid ? compte : null;
  } catch {
    return null;
  }
}

function memoriserCompte(compte) {
  try { localStorage.setItem(CLE_COMPTE, JSON.stringify(compte)); } catch { /* stockage indisponible */ }
}

function oublierCompte() {
  try { localStorage.removeItem(CLE_COMPTE); } catch { /* stockage indisponible */ }
}

// Répercute sur le compte mémorisé un changement fait pendant la session.
// Indispensable pour `premiereCo` : sinon, au lancement suivant, l'app
// rouvrirait sur l'écran de changement de mot de passe — et y resterait hors
// ligne, faute de vérification serveur.
export function ajusterCompteMemorise(uid, champs) {
  const compte = lireCompteMemorise(uid);
  if (compte) memoriserCompte({ ...compte, ...champs });
}

// Le miroir hors ligne (PowerSync) porte les données d'un AUTRE compte : on
// le vide AVANT d'ouvrir l'app pour celui-ci, sinon ses premiers écrans
// liraient les données du précédent. Le moteur SQLite n'est chargé que dans
// ce cas (poste partagé) — le test lui-même est une simple lecture locale.
async function libererMiroirPour(uid) {
  if (!powerSyncConfigured || !miroirAutreCompte(uid)) return;
  try {
    const { effacerMiroir } = await import("./powersync/client");
    await effacerMiroir();
  } catch (err) {
    // connectPowerSync refera la purge avant de synchroniser ce compte.
    console.warn("[powersync] purge du miroir :", err?.message || err);
  }
}

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
// `schoolCode` est fourni à la connexion ; au refresh on le résout via ecole_id
// (sauf s'il est déjà connu du compte mémorisé : le code d'une école est
// immuable, c'est un aller-retour réseau de moins au démarrage).
// Le poste (permissions par module) est joint ; poste désactivé → connexion
// refusée (signalée par { desactive: true }).
// Renvoie null si le compte n'existe pas ; LÈVE une erreur si la base n'a pas
// pu répondre (réseau coupé ou trop lent) — ce n'est pas une preuve que le
// compte a disparu, et l'appelant ne doit surtout pas déconnecter pour ça.
async function chargerCompte(sb, userId, schoolCode) {
  let { data: c, error } = await sb.from("comptes")
    .select("*, poste:postes(id, cle, label, permissions, actif)")
    .eq("user_id", userId).maybeSingle();
  if (error) {
    // Base pas encore migrée (table postes absente) : repli sans jointure.
    ({ data: c, error } = await sb.from("comptes").select("*").eq("user_id", userId).maybeSingle());
  }
  if (error) throw new Error(error.message || "Lecture du compte impossible.");
  if (!c) return null;
  if (c.poste && c.poste.actif === false) return { desactive: true };
  // Compte parent absorbé par une fusion de doublons : refusé ici aussi, en
  // plus du blocage Supabase Auth posé par l'Edge Function.
  if (c.extra?.fusionneDans) return { desactive: true, regroupe: true };

  let code = schoolCode || null;
  if (!code && c.ecole_id) {
    const { data: ec, error: errEcole } = await sb.from("ecoles").select("code").eq("id", c.ecole_id).maybeSingle();
    if (errEcole) throw new Error(errEcole.message || "Lecture de l'école impossible.");
    code = ec?.code || null;
  }

  const x = c.extra || {};
  return {
    uid: userId,
    login: c.login,
    email: c.email || "",
    nom: c.nom || c.login,
    // Nom imprimé sous les signatures des documents que ce compte signe pour
    // son poste (Comptes & Postes) ; vide : le responsable du poste.
    nomSignature: String(x.nomSignature || "").trim(),
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

// Compte parent absorbé par une fusion de doublons (Comptes & Postes →
// Doublons parents) : sa connexion est bloquée côté Supabase Auth. Le parent
// doit apprendre pourquoi, plutôt que de croire son mot de passe faux.
export const MSG_ECOLE_HORS_SERVICE = {
  inactive: "Cet établissement est désactivé : la connexion est impossible. Contactez EduGest.",
  supprimee: "Cet établissement n'est plus disponible.",
};

export const MSG_COMPTE_REGROUPE = "Ce compte n'est plus actif : il a été regroupé avec un autre compte parent de l'école. Demandez votre identifiant à l'école.";

async function connexionParEmail(email, mdp, schoolCode) {
  const sb = getSupabase();
  const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: mdp });
  if (error || !auth?.user) {
    if (error?.code === "user_banned") return { ok: false, data: { error: MSG_COMPTE_REGROUPE } };
    return { ok: false, data: { error: "Identifiant ou mot de passe incorrect." } };
  }
  let compte;
  try {
    compte = await chargerCompte(sb, auth.user.id, schoolCode);
  } catch {
    // Mot de passe accepté mais compte illisible : réseau coupé entre les deux.
    await sb.auth.signOut().catch(() => {});
    return { ok: false, data: { error: "Connexion interrompue : vérifiez votre connexion internet puis réessayez." } };
  }
  if (!compte || compte.desactive) {
    await sb.auth.signOut().catch(() => {});
    return { ok: false, data: { error: compte?.regroupe ? MSG_COMPTE_REGROUPE
      : compte?.desactive ? "Compte désactivé par la direction." : "Compte introuvable." } };
  }
  await libererMiroirPour(compte.uid);
  memoriserCompte(compte);
  return { ok: true, data: { compte } };
}

// Connexion d'un utilisateur d'école. La saisie peut être l'identifiant
// interne OU l'e-mail réel du compte (résolu via la RPC publique
// login_pour_email — l'authentification reste l'e-mail synthétique).
export async function ecoleLogin({ login, mdp, schoolId }) {
  // École désactivée ou supprimée : la base refuse déjà tout accès à ses
  // comptes (ecole-hors-service.sql) — on le dit clairement plutôt que de
  // laisser croire à un mauvais mot de passe ou à un compte introuvable.
  const { statut } = await fetchEtatEcole(schoolId);
  if (statut) return { ok: false, data: { error: MSG_ECOLE_HORS_SERVICE[statut] } };
  let identifiant = String(login || "").trim();
  if (identifiant.includes("@")) {
    const { data, error } = await getSupabase()
      .rpc("login_pour_email", { p_code: schoolId, p_email: identifiant });
    if (error || !data) {
      // Même message générique qu'un mauvais mot de passe (pas d'énumération).
      return { ok: false, data: { error: "Identifiant ou mot de passe incorrect." } };
    }
    return connexionParEmail(emailFor(data, schoolId), mdp, schoolId);
  }
  const r = await connexionParEmail(emailFor(identifiant, schoolId), mdp, schoolId);
  // Parent dont l'identifiant est son numéro, écrit à sa façon
  // (« 622 12 34 56 », « +224 622… ») : second essai avec le numéro à 9
  // chiffres. L'identifiant exact passe toujours en premier, pour qu'aucun
  // compte existant ne change de comportement.
  const numero = identifiantConnexion(identifiant);
  if (r.ok || numero === identifiant || r.data?.error === MSG_COMPTE_REGROUPE) return r;
  return connexionParEmail(emailFor(numero, schoolId), mdp, schoolId);
}

// Connexion superadmin (transversal, sans école).
export function superadminLogin({ login, mdp }) {
  return connexionParEmail(superadminEmailFor(login), mdp, null);
}

// Observe l'état d'auth Supabase ; appelle cb(utilisateur|null). Renvoie un cleanup.
//
// Réseau faible : l'ouverture de l'app n'attend plus le réseau. Le compte
// mémorisé de la session enregistrée s'affiche aussitôt, la vérification
// serveur suit. Une vérification qui échoue faute de réseau ne déconnecte
// plus (elle vidait aussi le miroir hors ligne, à re-télécharger en entier) :
// seule une réponse du serveur (compte introuvable, poste désactivé) ou une
// vraie fin de session ramène à l'écran de connexion.
export async function watchAuthState(callback) {
  const sb = getSupabase();
  let dernier; // JSON du dernier état transmis (undefined : rien encore)

  // N'appelle cb que si l'état change : un compte identique renvoyé par la
  // vérification ne re-déclenche ni rendu ni rechargement.
  const transmettre = async (compte) => {
    const json = JSON.stringify(compte);
    if (json === dernier) return;
    dernier = json;
    if (compte) {
      await libererMiroirPour(compte.uid);
      memoriserCompte(compte);
    } else {
      oublierCompte();
    }
    callback(compte);
  };

  // Compte serveur de la session : null = pas de session, compte introuvable
  // ou poste désactivé (traité comme déconnecté) ; undefined = serveur
  // injoignable — on ne conclut rien et on garde l'état affiché.
  const resoudre = async (session) => {
    if (!session?.user) return null;
    try {
      const codeConnu = lireCompteMemorise(session.user.id)?.schoolId || null;
      const compte = await chargerCompte(sb, session.user.id, codeConnu);
      return !compte || compte.desactive ? null : compte;
    } catch {
      return undefined;
    }
  };
  const verifier = async (session) => {
    const compte = await resoudre(session);
    if (compte !== undefined) await transmettre(compte);
  };

  // 1) Ouverture immédiate sur le compte mémorisé, s'il est bien celui de la
  //    session enregistrée sur l'appareil (lue sans réseau).
  const memorise = lireCompteMemorise(uidSessionEnregistree());
  if (memorise) await transmettre(memorise);

  // 2) Session officielle : getSession() renouvelle un jeton expiré (réseau).
  const { data: { session }, error } = await sb.auth.getSession();
  if (session) {
    // App déjà ouverte sur le compte mémorisé : la vérification ne bloque rien.
    if (memorise) verifier(session).catch(() => {});
    else await verifier(session);
  } else if (!(error && isAuthRetryableFetchError(error))) {
    await transmettre(null);
  }
  // Jeton expiré et réseau absent : la session est gardée, supabase-js la
  // renouvellera au retour du réseau (TOKEN_REFRESHED ci-dessous). Sans
  // compte mémorisé, rien ne peut s'afficher d'ici là : écran de connexion.
  if (dernier === undefined) await transmettre(null);

  const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION : déjà traité par getSession() ci-dessus — le résoudre
    // une seconde fois doublait les requêtes du démarrage.
    if (event === "INITIAL_SESSION") return;
    // Différé : supabase-js déconseille d'appeler ses API dans ce rappel.
    setTimeout(() => {
      if (!session?.user) { transmettre(null).catch(() => {}); return; }
      // Connexion par le formulaire : connexionParEmail vient de lire et de
      // mémoriser ce compte — inutile de le relire. (SIGNED_IN revient aussi
      // quand l'onglet reprend le focus : même économie.)
      const memo = event === "SIGNED_IN" ? lireCompteMemorise(session.user.id) : null;
      (memo ? transmettre(memo) : verifier(session)).catch(() => {});
    }, 0);
  });
  return () => sub.subscription.unsubscribe();
}

export async function signOut() {
  // Oublié même si la révocation échoue (hors ligne) : au prochain lancement,
  // l'app ne s'ouvrira plus d'office sur ce compte.
  oublierCompte();
  const sb = getSupabase();
  await sb.auth.signOut();
}
