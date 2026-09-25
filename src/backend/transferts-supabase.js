// ── Transferts d'élèves entre écoles via Supabase ───────────────────────────
// Génération : insert dans `transferts` (RLS école source). Vérif/accept : RPC
// SECURITY DEFINER (token = capability cross-école), cf. supabase/transferts.sql.
// Mêmes formes de retour que transferts-api.js.
import { getSupabase } from "../supabaseClient";

async function ecoleIdParCode(sb, code) {
  const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
  return data?.id || null;
}

// Seuls les élèves déjà « Transféré » se voient proposer un token : la fiche
// n'est plus touchée ici (l'ancienne écriture directe du statut contournait
// la file hors ligne pour ne rien changer).
export async function apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination }) {
  const sb = getSupabase();
  const ecoleSourceId = await ecoleIdParCode(sb, schoolId);
  if (!ecoleSourceId) return { error: "École source introuvable." };
  const { data, error } = await sb.from("transferts").insert({
    ecole_source_id: ecoleSourceId,
    ecole_destination: ecoleDestination || null,
    eleve_snapshot: eleveSnapshot,
  }).select("token, created_at").single();
  if (error) return { error: error.message };
  return { token: data.token, createdAt: data.created_at };
}

// Transferts émis par l'école (RLS : les siens seulement), du plus récent au
// plus ancien. Les tokens ne vivaient que dans l'état de l'écran : perdus au
// rechargement, et l'école pouvait en générer un second pour le même élève.
export async function apiListerTransferts() {
  const sb = getSupabase();
  const { data, error } = await sb.from("transferts")
    .select("token, statut, created_at, ecole_destination, eleveId:eleve_snapshot->>_id")
    .order("created_at", { ascending: false })
    .range(0, 999);
  if (error) return { error: error.message, transferts: [] };
  return {
    transferts: (data || []).map((t) => ({
      token: t.token, statut: t.statut, createdAt: t.created_at,
      ecoleDestination: t.ecole_destination || "", eleveId: t.eleveId || "",
    })),
  };
}

export async function apiVerifierToken(token) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("transfert_verifier", { p_token: token });
  if (error) return { error: error.message };
  if (!data) return { error: "Token introuvable, déjà utilisé ou expiré." };
  return data; // { eleveSnapshot, ecoleDestination, statut, expireLe }
}

export async function apiAccepterTransfert({ token, classe, matricule }) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("transfert_accepter", {
    p_token: token, p_classe: classe || null, p_matricule: matricule || null,
  });
  if (error) return { error: error.message };
  return data; // { ok, eleveId } | { error }
}
