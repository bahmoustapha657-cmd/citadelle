// ── Rattachement d'un espace enseignant à l'école qui adopte EduGest ──────
// Étape 3 : l'enseignant propose depuis son espace, la direction de l'école
// relie ses élèves et accepte. Serveur : Edge account-manage
// (demander_rattachement, annuler_rattachement, refuser_rattachement,
// accepter_rattachement — account-manage/rattachement.ts) et RPC
// rattachements_recus() / rattachement_apercu() (migration 20261118180200).
import { getSupabase } from "../supabaseClient";
import { invoke } from "./account-manage-supabase";
import { codeEcoleOrigine } from "./code-ecole-origine";
import i18n from "../i18n";

// Enseignant : propose de rattacher les classes de l'espace ouvert à l'école
// dont il saisit le code — d'origine ou court ; l'Edge Function cherche
// l'école par son code d'origine. Renvoie { demandeId, ecoleNom }.
export const demanderRattachement = async (codeEcole) =>
  invoke({ action: "demander_rattachement", codeEcole: await codeEcoleOrigine(codeEcole) }, i18n.t("rattachement.errRequest"));

export const annulerRattachement = () =>
  invoke({ action: "annuler_rattachement" }, i18n.t("rattachement.errCancel"));

// Direction : demandes en attente pour son école ; [] si aucune, hors ligne
// ou base pas encore migrée (le bandeau ne s'affiche simplement pas).
export async function rattachementsRecus() {
  const { data, error } = await getSupabase().rpc("rattachements_recus");
  if (error || !Array.isArray(data)) return [];
  return data;
}

// Direction : classes, élèves et matières que l'enseignant apporte.
export async function apercuRattachement(demandeId) {
  const { data, error } = await getSupabase().rpc("rattachement_apercu", { p_demande: demandeId });
  if (error) throw new Error(error.message || i18n.t("rattachement.errLoad"));
  if (!data) throw new Error(i18n.t("rattachement.errGone"));
  return data;
}

export const accepterRattachement = (demandeId, corps) =>
  invoke({ action: "accepter_rattachement", demandeId, ...corps }, i18n.t("rattachement.errAccept"));

export const refuserRattachement = (demandeId) =>
  invoke({ action: "refuser_rattachement", demandeId }, i18n.t("rattachement.errRefuse"));

// Lecture paginée : PostgREST plafonne une réponse à 1000 lignes.
async function toutesLesLignes(construire) {
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire().order("id").range(de, de + 999);
    if (error) throw new Error(error.message || i18n.t("rattachement.errLoad"));
    lignes.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return lignes;
}

// Direction : ce qu'il faut de l'école pour relier — ses classes, ses élèves
// actifs, ses matières et ses comptes enseignants.
export async function donneesEcolePourRattachement() {
  const sb = getSupabase();
  const [classes, eleves, matieres, comptes] = await Promise.all([
    toutesLesLignes(() => sb.from("classes").select("id, section, nom")),
    toutesLesLignes(() => sb.from("eleves").select("id, section, classe, nom, prenom, date_naissance, statut")),
    toutesLesLignes(() => sb.from("matieres").select("id, section, nom")),
    toutesLesLignes(() => sb.from("comptes").select("id, nom, login, role, section, matiere, enseignant_id").eq("role", "enseignant")),
  ]);
  return {
    classes,
    eleves: eleves.filter((e) => (e.statut || "Actif") === "Actif"),
    matieres: [...new Set(matieres.map((m) => String(m.nom || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    comptes,
  };
}
