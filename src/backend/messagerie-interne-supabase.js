// ── Messagerie interne du personnel (Supabase) ──────────────────────────────
// Boîte de messages entre comptes du personnel : individuel (compte),
// en masse (postes ciblés) ou tout le personnel. La RLS de
// supabase/messagerie-interne.sql garantit que seuls l'expéditeur et les
// destinataires voient un message.
import { getSupabase } from "../supabaseClient";
import { envoyerPush, envoyerPushUtilisateurs, envoyerPushTousStaff } from "./push-supabase";

async function ecoleIdDepuisCode(sb, schoolCode) {
  const { data, error } = await sb.from("ecoles").select("id").eq("code", schoolCode).maybeSingle();
  if (error || !data) throw new Error("École introuvable.");
  return data.id;
}

// Comptes du personnel + postes de l'école (sélecteur de destinataires).
export async function chargerDestinataires() {
  const sb = getSupabase();
  const [{ data: comptes }, { data: postes }] = await Promise.all([
    sb.from("comptes").select("id, user_id, login, nom, label, role, poste_id")
      .not("role", "in", '("parent","enseignant","superadmin")').order("nom"),
    sb.from("postes").select("id, cle, label, actif").order("label"),
  ]);
  return {
    comptes: comptes || [],
    postes: (postes || []).filter((p) => p.actif !== false),
  };
}

// Envoie un message : cible = { compteId } OU { posteCles: [] } OU { tous: true }.
// Notification push best-effort selon la cible.
export async function envoyerMessageInterne({ schoolCode, expediteur, cible, sujet, corps }) {
  const sb = getSupabase();
  const texte = (corps || "").trim();
  if (!texte) throw new Error("Le message est vide.");
  const ecoleId = await ecoleIdDepuisCode(sb, schoolCode);

  const ligne = {
    ecole_id: ecoleId,
    de_compte_id: expediteur.compteId,
    de_nom: expediteur.nom || "",
    de_poste: expediteur.posteLabel || expediteur.label || null,
    a_compte_id: cible.compteId || null,
    a_postes: Array.isArray(cible.posteCles) && cible.posteCles.length ? cible.posteCles : null,
    a_tous: !!cible.tous,
    sujet: (sujet || "").trim() || null,
    corps: texte,
  };
  const { data, error } = await sb.from("messages_internes").insert(ligne).select("id").single();
  if (error) throw new Error(error.message || "Envoi impossible.");

  // Push best-effort (jamais bloquant pour l'envoi).
  const titre = `💬 ${expediteur.nom || "Message interne"}`;
  const apercu = texte.length > 90 ? `${texte.slice(0, 90)}…` : texte;
  try {
    if (cible.tous) await envoyerPushTousStaff(titre, apercu);
    else if (cible.compteId && cible.userId) await envoyerPushUtilisateurs([cible.userId], titre, apercu);
    else if (ligne.a_postes) await envoyerPush(ligne.a_postes, titre, apercu);
  } catch { /* le message est déjà en base */ }
  return { ok: true, id: data.id };
}

// Boîte du compte courant : messages visibles (RLS) + accusés de lecture.
export async function chargerMessagerie() {
  const sb = getSupabase();
  const [{ data: messages, error }, { data: lus }] = await Promise.all([
    sb.from("messages_internes").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("messages_internes_lus").select("message_id"),
  ]);
  if (error) throw new Error(error.message || "Chargement de la messagerie impossible.");
  return {
    messages: messages || [],
    lusIds: new Set((lus || []).map((l) => l.message_id)),
  };
}

export async function marquerMessageLu(messageId, compteId) {
  const sb = getSupabase();
  await sb.from("messages_internes_lus")
    .upsert({ message_id: messageId, compte_id: compteId }, { onConflict: "message_id,compte_id" });
}

export async function supprimerMessageInterne(messageId) {
  const sb = getSupabase();
  const { error } = await sb.from("messages_internes").delete().eq("id", messageId);
  if (error) throw new Error(error.message || "Suppression impossible.");
}
