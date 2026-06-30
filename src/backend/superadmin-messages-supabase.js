// ── Messages de diffusion SuperAdmin via Supabase ───────────────────────────
// Superadmin : liste/envoi/suppression + stats de lecture (bypass RLS).
// École : lecture des messages qui la ciblent (RLS) + accusé de lecture.
import { getSupabase } from "../supabaseClient";

const toMsg = (d) => ({
  _id: d.id, titre: d.titre, corps: d.corps, niveau: d.niveau,
  cibleSchools: d.cible_schools || [], cibleRoles: d.cible_roles || [],
  auteur: d.auteur, createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
});

// — Côté superadmin —
export function subscribeMessages(onData) {
  const sb = getSupabase();
  sb.from("superadmin_messages").select("*").order("created_at", { ascending: false })
    .then(({ data }) => onData((data || []).map(toMsg)));
  return () => {};
}

export async function fetchStatsLectures(messages) {
  const sb = getSupabase();
  const stats = {};
  await Promise.all((messages || []).map(async (m) => {
    const { data } = await sb.from("superadmin_message_lectures").select("ecole_code").eq("message_id", m._id);
    const ecoles = new Set((data || []).map((x) => x.ecole_code).filter(Boolean));
    stats[m._id] = { lectures: data?.length || 0, ecoles: ecoles.size };
  }));
  return stats;
}

export function envoyerMessage({ titre, corps, niveau, cibleSchools, cibleRoles, auteur }) {
  return getSupabase().from("superadmin_messages").insert({
    titre, corps, niveau,
    cible_schools: cibleSchools || [], cible_roles: cibleRoles || [], auteur,
  });
}

export function supprimerMessageApi(id) {
  return getSupabase().from("superadmin_messages").delete().eq("id", id);
}

// — Côté école —
export async function fetchSuperadminMessages() {
  const sb = getSupabase();
  const { data } = await sb.from("superadmin_messages").select("*").order("created_at", { ascending: false });
  return (data || []).map(toMsg);
}

export async function enregistrerLecture(msgId, { schoolId, role, login }) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("superadmin_message_lectures").upsert({
    message_id: msgId, user_id: user.id, ecole_code: schoolId, role, login: login || null,
  });
}
