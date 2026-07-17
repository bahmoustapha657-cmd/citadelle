// ── Notifications push via Supabase ─────────────────────────────────────────
// Abonnement : enregistre la souscription du navigateur dans `push_subs`.
// Envoi : délègue à l'Edge Function `push` (clé VAPID privée côté serveur).
import { getSupabase } from "../supabaseClient";

async function ecoleIdParCode(sb, code) {
  const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
  return data?.id || null;
}

export async function sAbonnerAuxPush(utilisateurCo, sid) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const ecoleId = await ecoleIdParCode(sb, sid);
    if (!ecoleId) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });
    await sb.from("push_subs").upsert({
      ecole_id: ecoleId, user_id: user.id, subscription: sub.toJSON(),
      role: utilisateurCo.role, nom: utilisateurCo.nom,
      // Postes flexibles : la clé du poste sert de dimension de ciblage
      // (postes système = mêmes clés que les rôles historiques).
      poste_cle: utilisateurCo.posteCle || utilisateurCo.role,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // L'abonnement push est optionnel.
  }
}

export async function envoyerPush(cibles, titre, corps, url = "/") {
  const sid = localStorage.getItem("LC_schoolId");
  if (!sid) return;
  try {
    await getSupabase().functions.invoke("push", {
      body: { schoolId: sid, cibles, titre, corps, url },
    });
  } catch {
    // Best-effort.
  }
}
