// ── Messagerie interne v2 (Supabase) ────────────────────────────────────────
// Discussions (directes / groupes), messages vocaux, appels audio et annonces
// entre personnel et enseignants. La RLS et les fonctions de
// supabase/messagerie-v2.sql font autorité : ce module ne fait qu'appeler.
import { getSupabase } from "../supabaseClient";
import { envoyerPushUtilisateurs } from "./push-supabase";
import { extensionPourType } from "../components/messagerie/documents";

const BUCKET = "messagerie";

async function rpc(nom, params) {
  const { data, error } = await getSupabase().rpc(nom, params);
  if (error) throw new Error(error.message || "Opération impossible.");
  return data;
}

// ── Annuaire & boîte ──
export const chargerAnnuaire = async () => (await rpc("msg_annuaire")) || [];
export const chargerBoite = async () => (await rpc("msg_boite")) || [];

// Page de messages d'une discussion, du plus ancien au plus récent.
// `avant` : date ISO du plus ancien message déjà affiché (pagination).
export async function chargerMessages(conversationId, { avant = null, limite = 40 } = {}) {
  let requete = getSupabase().from("msg_messages").select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (avant) requete = requete.lt("created_at", avant);
  const { data, error } = await requete;
  if (error) throw new Error(error.message || "Chargement des messages impossible.");
  return (data || []).reverse();
}

// Recherche plein texte (simple) dans les discussions du compte (RLS).
export async function rechercherMessages(terme) {
  const nettoye = String(terme || "").trim().replace(/[%_\\]/g, (c) => `\\${c}`);
  if (nettoye.length < 2) return [];
  const { data, error } = await getSupabase().from("msg_messages")
    .select("id, conversation_id, de_compte_id, corps, created_at")
    .eq("type", "texte").eq("supprime", false)
    .ilike("corps", `%${nettoye}%`)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message || "Recherche impossible.");
  return data || [];
}

// ── Discussions ──
export const ouvrirDirecte = (compteId) => rpc("msg_ouvrir_directe", { p_compte: compteId });
export const creerGroupe = (titre, membres) => rpc("msg_creer_groupe", { p_titre: titre, p_membres: membres });
export const ajouterMembres = (conv, membres) => rpc("msg_ajouter_membres", { p_conv: conv, p_membres: membres });
export const retirerMembre = (conv, compteId) => rpc("msg_retirer_membre", { p_conv: conv, p_compte: compteId });
export const definirAdmin = (conv, compteId, admin) =>
  rpc("msg_definir_admin", { p_conv: conv, p_compte: compteId, p_admin: admin });
export const renommerGroupe = (conv, titre) => rpc("msg_renommer_groupe", { p_conv: conv, p_titre: titre });
export const marquerLu = (conv) => rpc("msg_marquer_lu", { p_conv: conv });
export const definirPreferences = (conv, { archive = null, epingle = null, sourdine = null }) =>
  rpc("msg_preferences", { p_conv: conv, p_archive: archive, p_epingle: epingle, p_sourdine: sourdine });

// ── Messages ──
export async function envoyerTexte({ conversationId, ecoleId, moi, corps, reponseA = null }) {
  const texte = String(corps || "").trim();
  if (!texte) throw new Error("Le message est vide.");
  const { data, error } = await getSupabase().from("msg_messages").insert({
    conversation_id: conversationId, ecole_id: ecoleId, de_compte_id: moi,
    type: "texte", corps: texte.slice(0, 4000), reponse_a: reponseA,
  }).select("*").single();
  if (error) throw new Error(error.message || "Envoi impossible.");
  return data;
}

const EXTENSIONS_AUDIO = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/wav": "wav" };

// Dépose le vocal (bucket privé, dossier de la discussion) puis crée le
// message ; si l'insertion échoue, le fichier orphelin est effacé.
export async function envoyerVocal({ conversationId, ecoleId, moi, blob, duree, reponseA = null }) {
  const sb = getSupabase();
  const contentType = String(blob?.type || "audio/webm").split(";")[0];
  const ext = EXTENSIONS_AUDIO[contentType] || "webm";
  const chemin = `${ecoleId}/${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error: errUpload } = await sb.storage.from(BUCKET).upload(chemin, blob, { contentType, upsert: false });
  if (errUpload) throw new Error(errUpload.message || "Envoi du vocal impossible.");
  const { data, error } = await sb.from("msg_messages").insert({
    conversation_id: conversationId, ecole_id: ecoleId, de_compte_id: moi,
    type: "audio", audio_path: chemin, audio_duree: Math.max(0, Math.min(600, Math.round(duree || 0))),
    reponse_a: reponseA,
  }).select("*").single();
  if (error) {
    sb.storage.from(BUCKET).remove([chemin]).catch(() => {});
    throw new Error(error.message || "Envoi du vocal impossible.");
  }
  return data;
}

export const modifierMessage = (id, corps) => rpc("msg_modifier_message", { p_id: id, p_corps: corps });

export async function supprimerMessage(id) {
  const chemin = await rpc("msg_supprimer_message", { p_id: id });
  if (chemin) getSupabase().storage.from(BUCKET).remove([chemin]).catch(() => {});
}

// Vocaux et documents : téléchargés une fois (requête authentifiée, bucket
// privé) puis servis en blob: — pas d'URL signée à régénérer, et compatible
// COEP.
const cacheFichiers = new Map();
export async function urlStockage(chemin) {
  if (cacheFichiers.has(chemin)) return cacheFichiers.get(chemin);
  const promesse = getSupabase().storage.from(BUCKET).download(chemin).then(({ data, error }) => {
    if (error || !data) throw new Error(error?.message || "Fichier indisponible.");
    return URL.createObjectURL(data);
  });
  cacheFichiers.set(chemin, promesse);
  promesse.catch(() => cacheFichiers.delete(chemin));
  return promesse;
}
export const urlVocal = urlStockage;

// Document joint à une discussion : dépôt dans le dossier de la discussion,
// puis message « fichier » (la légende éventuelle en corps). Si l'insertion
// échoue, le fichier orphelin est effacé.
export async function envoyerFichier({ conversationId, ecoleId, moi, fichier, type, nom, legende = "", reponseA = null }) {
  const sb = getSupabase();
  const chemin = `${ecoleId}/${conversationId}/${crypto.randomUUID()}.${extensionPourType(type, nom)}`;
  const { error: errUpload } = await sb.storage.from(BUCKET).upload(chemin, fichier, { contentType: type, upsert: false });
  if (errUpload) throw new Error(errUpload.message || `Envoi de « ${nom} » impossible.`);
  const { data, error } = await sb.from("msg_messages").insert({
    conversation_id: conversationId, ecole_id: ecoleId, de_compte_id: moi,
    type: "fichier", corps: String(legende || "").trim().slice(0, 4000) || null,
    fichier_path: chemin, fichier_nom: String(nom).slice(0, 200), fichier_type: type, fichier_taille: fichier.size,
    reponse_a: reponseA,
  }).select("*").single();
  if (error) {
    sb.storage.from(BUCKET).remove([chemin]).catch(() => {});
    throw new Error(error.message || `Envoi de « ${nom} » impossible.`);
  }
  return data;
}

// ── Annonces ──
export async function chargerAnnonces() {
  const sb = getSupabase();
  const [{ data: annonces, error }, { data: lus }] = await Promise.all([
    sb.from("msg_annonces").select("*").order("created_at", { ascending: false }).limit(150),
    sb.from("msg_annonces_lus").select("annonce_id, lu_at, confirme_at"),
  ]);
  if (error) throw new Error(error.message || "Chargement des annonces impossible.");
  return {
    annonces: annonces || [],
    lus: new Map((lus || []).map((l) => [l.annonce_id, l])),
  };
}

export async function chargerStatsAnnonces() {
  try {
    const lignes = (await rpc("msg_annonces_stats")) || [];
    return new Map(lignes.map((l) => [l.annonce_id, l]));
  } catch { return new Map(); }
}

export async function publierAnnonce({ ecoleId, moi, titre, corps, priorite, accuseRequis, epinglee, cible }) {
  const texte = String(corps || "").trim();
  if (!texte) throw new Error("L'annonce est vide.");
  const { data, error } = await getSupabase().from("msg_annonces").insert({
    ecole_id: ecoleId, de_compte_id: moi,
    titre: String(titre || "").trim() || null,
    corps: texte,
    priorite: priorite || "normale",
    accuse_requis: !!accuseRequis,
    epinglee: !!epinglee,
    a_tous: !!cible.tous,
    a_personnel: !!cible.personnel,
    a_enseignants: !!cible.enseignants,
    a_postes: cible.postes?.length ? cible.postes : null,
    a_comptes: cible.comptes?.length ? cible.comptes : null,
  }).select("*").single();
  if (error) throw new Error(error.message || "Publication impossible.");
  return data;
}

export const lireAnnonce = (id, confirmer = false) => rpc("msg_annonce_lire", { p_id: id, p_confirmer: confirmer });
export const suiviAnnonce = async (id) => (await rpc("msg_annonce_suivi", { p_id: id })) || [];
export const epinglerAnnonce = (id, epinglee) => rpc("msg_annonce_epingler", { p_id: id, p_epinglee: epinglee });

// Pièce jointe d'annonce : déposée APRÈS la publication (son chemin porte
// l'id de l'annonce, que la policy de stockage vérifie).
export async function televerserPieceAnnonce({ ecoleId, annonceId, fichier, type, nom }) {
  const chemin = `${ecoleId}/annonces/${annonceId}/${crypto.randomUUID()}.${extensionPourType(type, nom)}`;
  const { error } = await getSupabase().storage.from(BUCKET).upload(chemin, fichier, { contentType: type, upsert: false });
  if (error) throw new Error(error.message || `Envoi de « ${nom} » impossible.`);
  return { path: chemin, nom: String(nom).slice(0, 200), type, taille: fichier.size };
}

export const joindreAnnonce = (id, pieces) => rpc("msg_annonce_joindre", { p_id: id, p_pieces: pieces });

// Retire l'annonce ET ses pièces jointes (les fichiers d'abord : la policy
// de stockage vérifie les droits sur l'annonce, qui doit encore exister).
export async function supprimerAnnonce(annonce) {
  const chemins = (annonce.pieces_jointes || []).map((p) => p.path).filter(Boolean);
  if (chemins.length) await getSupabase().storage.from(BUCKET).remove(chemins).catch(() => {});
  const { error } = await getSupabase().from("msg_annonces").delete().eq("id", annonce.id);
  if (error) throw new Error(error.message || "Suppression impossible.");
}

// ── Appels ──
export const lancerAppel = (conv, offre) => rpc("msg_appel_lancer", { p_conv: conv, p_offre: offre });
export const repondreAppel = (id, reponse) => rpc("msg_appel_repondre", { p_id: id, p_reponse: reponse });
export const terminerAppel = (id, statut) => rpc("msg_appel_terminer", { p_id: id, p_statut: statut });

// Appels entrants qui sonnent encore (ouverture de l'app depuis une
// notification « X vous appelle »).
export async function appelsEntrantsEnAttente(moi, depuisMs = 45000) {
  const depuis = new Date(Date.now() - depuisMs).toISOString();
  const { data } = await getSupabase().from("msg_appels").select("*")
    .eq("appele_id", moi).eq("statut", "sonne").gt("created_at", depuis)
    .order("created_at", { ascending: false }).limit(1);
  return data || [];
}

// Serveurs ICE : TURN éphémère si l'Edge Function est configurée, sinon STUN.
const STUN_DEFAUT = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
export async function serveursIce() {
  try {
    const { data, error } = await getSupabase().functions.invoke("turn-credentials", { body: {} });
    if (!error && Array.isArray(data?.iceServers) && data.iceServers.length) return data.iceServers;
  } catch { /* fonction non déployée : STUN */ }
  return STUN_DEFAUT;
}

// ── Notifications push (best-effort, jamais bloquant) ──
export function notifier(userIds, titre, corps, url = "/") {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  envoyerPushUtilisateurs(ids, titre, corps, url).catch(() => {});
}

// ── Appels de groupe (réunions, SFU Cloudflare via l'Edge Function reunion) ──
export const demarrerReunion = (conv) => rpc("msg_reunion_demarrer", { p_conv: conv });
export const etatReunion = (id, { micro = null, camera = null } = {}) =>
  rpc("msg_reunion_etat", { p_reunion: id, p_micro: micro, p_camera: camera });
export const quitterReunion = (id) => rpc("msg_reunion_quitter", { p_reunion: id });
export const reunionsActives = async () => (await rpc("msg_reunions_actives")) || [];

export async function participantsReunion(id) {
  const { data, error } = await getSupabase().from("msg_reunion_participants")
    .select("compte_id, session_id, pistes, micro, camera, rejoint_at, quitte_at").eq("reunion_id", id);
  if (error) throw new Error(error.message || "Participants indisponibles.");
  return data || [];
}

// Action auprès du serveur d'appels (rejoindre, publier, recevoir,
// renegocier, fermer). Les refus arrivent avec un message explicite.
export async function actionReunion(action, corps) {
  const { data, error } = await getSupabase().functions.invoke("reunion", { body: { action, ...corps } });
  if (error) {
    let message = "Serveur d'appels injoignable.";
    try { message = (await error.context?.json())?.error || message; } catch { /* message par défaut */ }
    throw new Error(message);
  }
  return data;
}

// ── Présence (supabase/presence.sql) ──
export const signalerPresence = (etat) => rpc("msg_presence", { p_etat: etat });
export const chargerPresences = async () => (await rpc("msg_presences")) || [];
