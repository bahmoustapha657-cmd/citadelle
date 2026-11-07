// ── Une personne, plusieurs espaces ────────────────────────────────────────
// Comptes reliés d'une même personne (enseignant + parent + personnel…) :
// liste des espaces de la personne connectée, passage de l'un à l'autre sans
// mot de passe, et liaison par la Direction (Comptes & Postes).
// Serveur : RPC mes_espaces() et Edge account-manage (relier_comptes,
// detacher_compte, changer_espace) — supabase/functions/account-manage/espaces.ts.
import { getSupabase } from "../supabaseClient";
import { invoke } from "./account-manage-supabase";
import { ouvrirSessionParJeton } from "./auth-supabase";
import { powerSyncConfigured } from "./powersync/tables";

// Espaces de la personne connectée, le sien en premier ; [] si son compte
// n'est relié à aucun autre (ou base pas encore migrée).
export async function mesEspaces() {
  const { data, error } = await getSupabase().rpc("mes_espaces");
  if (error || !Array.isArray(data)) return [];
  return data.length > 1 ? data : [];
}

// Saisies hors ligne pas encore envoyées : le changement d'espace vide le
// miroir local (il appartient à un autre compte), elles seraient perdues.
async function fileEnvoiVide() {
  if (!powerSyncConfigured) return true;
  try {
    const { attendreRemontee, synchroOuverte } = await import("./powersync/client");
    // Pas de synchro ouverte (portail parent) : aucune saisie locale à attendre.
    if (!synchroOuverte()) return true;
    return await attendreRemontee(15000);
  } catch {
    return true;
  }
}

// Passe à l'espace `compteId` (relié au compte connecté). Renvoie le compte
// de session du nouvel espace ; lève une erreur lisible sinon.
export async function changerEspace(compteId, schoolCode) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Changer d'espace demande une connexion internet.");
  }
  if (!(await fileEnvoiVide())) {
    throw new Error("Des saisies attendent encore d'être envoyées : patientez qu'elles partent (connexion internet) avant de changer d'espace.");
  }
  const { tokenHash } = await invoke({ action: "changer_espace", compteId }, "Changement d'espace impossible.");
  const r = await ouvrirSessionParJeton(tokenHash, schoolCode);
  if (!r.ok) throw new Error(r.data.error);
  return r.data.compte;
}

// Direction : relier des comptes d'une même personne / en détacher un.
export const relierComptes = (compteIds) =>
  invoke({ action: "relier_comptes", compteIds }, "Liaison des comptes impossible.");

export const detacherCompte = (compteId) =>
  invoke({ action: "detacher_compte", compteId }, "Détachement impossible.");

// Comptes de l'école pour la carte de la Direction (liens et suggestions).
// Paginé : PostgREST plafonne une réponse à 1000 lignes.
export async function chargerComptesEspaces() {
  const sb = getSupabase();
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("comptes")
      .select("id, nom, role, label, login, email, statut, user_id, personne_id, extra")
      .order("id").range(de, de + 999);
    if (error) throw new Error(error.message || "Lecture des comptes impossible.");
    lignes.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return lignes;
}

// Compte de l'école qui utilise déjà cet identifiant ou cet e-mail (création
// d'un compte enseignant pour une personne qui en a déjà un). null sinon.
export async function compteExistantPour({ login, email }) {
  const sb = getSupabase();
  const champs = "id, nom, role, label, login, email";
  if (login) {
    const { data } = await sb.from("comptes").select(champs).eq("login", login).maybeSingle();
    if (data) return { ...data, par: "login" };
  }
  if (email) {
    // E-mails enregistrés en minuscules (account-manage, majEmailCompte).
    const { data } = await sb.from("comptes").select(champs).eq("email", String(email).toLowerCase()).limit(1);
    if (data?.[0]) return { ...data[0], par: "email" };
  }
  return null;
}
