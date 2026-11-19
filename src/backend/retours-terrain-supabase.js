// ── Retours terrain via Supabase ────────────────────────────────────────────
// École : envoi par la fonction retour_envoyer (nom, rôle et école pris en
// base) et lecture de SES retours (RLS : l'auteur seul, jamais sa hiérarchie).
// Superadmin : lecture de tout, statut et réponse. Logique pure et libellés :
// src/retours-terrain.js. Table : supabase/migrations/20261119185253_retours_terrain.sql.
import { getSupabase } from "../supabaseClient";
import { modificationRetour } from "../retours-terrain";

const PAGE = 1000;

const versRetour = (d) => ({
  _id: d.id,
  ecoleId: d.ecole_id,
  ecoleNom: d.ecoles?.nom || "",
  ecoleCode: d.ecoles?.code || "",
  compteId: d.compte_id,
  auteur: d.auteur || "",
  role: d.role || "",
  genre: d.genre,
  message: d.message || "",
  contexte: d.contexte || {},
  statut: d.statut || "nouveau",
  reponse: d.reponse || "",
  reponduLe: d.repondu_le ? new Date(d.repondu_le).getTime() : 0,
  createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
});

// PostgREST plafonne une lecture à 1000 lignes : on pagine (cf. mémoire
// « plafond 1000 lignes »).
async function toutesLesPages(requete) {
  const lignes = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await requete(de, de + PAGE - 1);
    if (error) throw error;
    lignes.push(...(data || []));
    if (!data || data.length < PAGE) return lignes;
  }
}

// — Côté école —
export async function envoyerRetour({ genre, message, contexte }) {
  const { data, error } = await getSupabase().rpc("retour_envoyer", {
    p_genre: genre, p_message: message, p_contexte: contexte || {},
  });
  if (error) throw error;
  return data;
}

// Les retours du compte connecté (la RLS ne renvoie que les siens), du plus
// récent au plus ancien, avec la réponse d'EduGest.
export async function mesRetours() {
  const lignes = await toutesLesPages((de, a) => getSupabase().from("retours_terrain")
    // i18n-ignore — noms de colonnes
    .select("id, ecole_id, compte_id, genre, message, statut, reponse, repondu_le, created_at")
    .order("created_at", { ascending: false }).order("id").range(de, a));
  return lignes.map(versRetour);
}

// — Côté superadmin —
export async function tousLesRetours() {
  const lignes = await toutesLesPages((de, a) => getSupabase().from("retours_terrain")
    .select("*, ecoles(nom, code)")
    .order("created_at", { ascending: false }).order("id").range(de, a));
  return lignes.map(versRetour);
}

export async function compterRetoursNouveaux() {
  const { count, error } = await getSupabase().from("retours_terrain")
    .select("id", { count: "exact", head: true }).eq("statut", "nouveau");
  if (error) throw error;
  return count || 0;
}

// Statut et réponse. Une modification refusée par la RLS ne renvoie aucune
// ligne SANS erreur : on le vérifie pour ne pas annoncer un faux succès.
export async function traiterRetour(retour, { statut, reponse }) {
  const champs = modificationRetour(retour, { statut, reponse });
  const { data, error } = await getSupabase().from("retours_terrain")
    // i18n-ignore — noms de colonnes
    .update(champs).eq("id", retour._id).select("id, statut, reponse, repondu_le");
  if (error) throw error;
  if (!data?.length) throw new Error("refus");
  return {
    ...retour,
    statut: data[0].statut,
    reponse: data[0].reponse || "",
    reponduLe: data[0].repondu_le ? new Date(data[0].repondu_le).getTime() : 0,
  };
}
