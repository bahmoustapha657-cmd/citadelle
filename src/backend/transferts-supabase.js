// ── Transferts d'élèves entre écoles via Supabase ───────────────────────────
// Génération : insert dans `transferts` (RLS école source) + marque l'élève
// « Transféré ». Vérif/accept : RPC SECURITY DEFINER (token = capability
// cross-école). Mêmes formes de retour que transferts-api.js.
import { getSupabase } from "../supabaseClient";

async function ecoleIdParCode(sb, code) {
  const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
  return data?.id || null;
}

export async function apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination }) {
  const sb = getSupabase();
  const ecoleSourceId = await ecoleIdParCode(sb, schoolId);
  if (!ecoleSourceId) return { error: "École source introuvable." };
  const { data, error } = await sb.from("transferts").insert({
    ecole_source_id: ecoleSourceId,
    ecole_destination: ecoleDestination || null,
    eleve_snapshot: eleveSnapshot,
  }).select("token").single();
  if (error) return { error: error.message };
  if (eleveSnapshot?._id) {
    await sb.from("eleves").update({ statut: "Transféré" }).eq("id", eleveSnapshot._id);
  }
  return { token: data.token };
}

export async function apiVerifierToken(token) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("transfert_verifier", { p_token: token });
  if (error) return { error: error.message };
  if (!data) return { error: "Token introuvable ou expiré." };
  return data; // { eleveSnapshot, ecoleDestination, statut }
}

export async function apiAccepterTransfert({ token }) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("transfert_accepter", { p_token: token });
  if (error) return { error: error.message };
  return data; // { ok, eleveId } | { error }
}
