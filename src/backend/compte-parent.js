// ── Compte parent : création, rattachement, lecture ────────────────────────
// C'est le serveur qui décide : si le parent a déjà son compte, les élèves y
// sont rattachés (mot de passe inchangé), sinon il le crée —
// supabase/functions/account-manage/foyer.ts.
// Les écritures passent par l'Edge Function, la RLS n'en permet aucune
// depuis le navigateur (supabase/historique/comptes-parents.sql).
import { payloadCompteParent } from "../comptes-parents";
import { getSupabase } from "../supabaseClient";
import { creerCompte as creerCompteSb, invoke } from "./account-manage-supabase";
import { powerSyncConfigured } from "./powersync/tables";

// Renvoie { login, rattache, dejaRattache }. `apresInscription` : élèves
// tout juste inscrits (saisie rapide) — en mode hors ligne ils sont d'abord
// écrits sur l'appareil, et le serveur ne les trouverait pas encore : on
// attend qu'ils soient remontés.
export async function creerOuRattacherCompteParent({ apresInscription = false, ...params }) {
  const payload = payloadCompteParent(params);
  if (apresInscription && powerSyncConfigured) {
    await import("./powersync/client").then((m) => m.attendreRemontee()).catch(() => {});
  }
  const data = await creerCompteSb(payload);
  return {
    login: data.login || data.compte?.login || payload.login,
    rattache: Boolean(data.merged || data.mergedIntoExisting),
    dejaRattache: Boolean(data.dejaRattache),
  };
}

const compteLu = (c) => ({
  id: c.id, login: c.login, nom: c.nom || "", telephone: c.telephone || "",
  statut: c.statut || "Actif", extra: c.extra || {},
});

// Comptes parents qui suivent un élève, avec leur lien de parenté.
export async function comptesParentsDeLEleve(eleveId) {
  const { data, error } = await getSupabase().from("parent_eleves")
    .select("lien, comptes(id, login, nom, telephone, statut, extra)")
    .eq("eleve_id", eleveId);
  if (error) throw new Error(error.message || "Lecture des comptes parents impossible.");
  return (data || []).filter((l) => l.comptes).map((l) => ({ ...compteLu(l.comptes), lien: l.lien || null }))
    .sort((a, b) => a.login.localeCompare(b.login));
}

// PostgREST plafonne chaque réponse à 1000 lignes : lecture par pages.
// `requete(de, a)` renvoie une requête neuve, triée, bornée à [de, a].
async function toutesLesPages(requete) {
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await requete(de, de + 999);
    if (error) throw new Error(error.message || "Lecture des comptes parents impossible.");
    lignes.push(...(data || []));
    if (!data || data.length < 1000) return lignes;
  }
}

// Tous les comptes parents de l'école (la RLS limite à l'école), avec leur
// nombre d'enfants — pour « Rattacher à un compte existant ».
export async function comptesParentsEcole() {
  const comptes = await toutesLesPages((de, a) => getSupabase().from("comptes")
    .select("id, login, nom, telephone, statut, extra, parent_eleves(count)")
    .eq("role", "parent").order("id").range(de, a));
  return comptes.map((c) => ({ ...compteLu(c), nbEnfants: c.parent_eleves?.[0]?.count ?? 0 }));
}

// Comptes parents de l'école et leurs liens, fiche des enfants comprise —
// pour la détection des doublons (doublons-parents.js). La RLS limite les
// deux lectures à l'école (supabase/historique/comptes-parents.sql pour les liens).
export async function donneesDoublonsParents() {
  const sb = getSupabase();
  const [comptes, liens] = await Promise.all([
    toutesLesPages((de, a) => sb.from("comptes")
      .select("id, login, nom, telephone, statut, premiere_co, created_at, extra")
      .eq("role", "parent").order("id").range(de, a)),
    toutesLesPages((de, a) => sb.from("parent_eleves")
      .select("compte_id, eleve_id, lien, eleves(prenom, nom, classe, section, tuteur, contact_tuteur, filiation)")
      .order("compte_id").order("eleve_id").range(de, a)),
  ]);
  return { comptes, liens };
}

// Fusion validée par la Direction : les enfants des comptes `sourceIds`
// passent au compte `cibleId`, les autres sont désactivés et bloqués.
export const fusionnerComptesParents = ({ schoolId, cibleId, sourceIds }) =>
  invoke({ action: "fusionner_parents", schoolId, cibleId, sourceIds }, "Fusion impossible.");

export const rattacherCompteParent = ({ schoolId, compteId, eleveId, lien }) =>
  invoke({ action: "rattacher_parent", schoolId, compteId, eleveId, lien: lien || null }, "Rattachement impossible.");

export const detacherCompteParent = ({ schoolId, compteId, eleveId }) =>
  invoke({ action: "detacher_parent", schoolId, compteId, eleveId }, "Détachement impossible.");
