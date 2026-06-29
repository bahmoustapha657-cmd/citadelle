// ── Gestion de comptes via Supabase ─────────────────────────────────────────
// - create / reset_password : délégués à l'Edge Function `account-manage`
//   (privilèges admin, service_role côté serveur uniquement).
// - changement de SON propre mot de passe : direct (auth.updateUser).
// - role_settings de l'école : direct (update ecoles, RLS staff).
import { getSupabase } from "../supabaseClient";

async function invoke(body, messageEchec) {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke("account-manage", { body });
  if (error) {
    // L'Edge Function renvoie { error } avec un status non-2xx → message utile.
    let msg = messageEchec;
    try { msg = (await error.context?.json())?.error || msg; } catch { /* garde le défaut */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || messageEchec);
  return data;
}

export function creerCompte({ schoolId, login, mdp, role, nom, label, ...reste }) {
  return invoke(
    { action: "create", schoolId, login, mdp, role, nom, label, statut: "Actif", ...reste },
    `Création du compte ${login} impossible.`,
  );
}

export function reinitialiserMotDePasse({ schoolId, accountId, mdp }) {
  return invoke(
    { action: "reset_password", schoolId, accountId, mdp },
    "Réinitialisation impossible.",
  );
}

// Un utilisateur change SON propre mot de passe (pas besoin d'admin).
export async function changerMotDePassePerso(nouveauMdp) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: nouveauMdp });
  if (error) throw new Error(error.message || "Changement de mot de passe impossible.");
  // Lever le drapeau première connexion sur son propre compte.
  const { data: { user } } = await sb.auth.getUser();
  if (user) await sb.from("comptes").update({ premiere_co: false }).eq("user_id", user.id);
  return { ok: true };
}

// Réglages de rôles de l'école (update direct, RLS staff).
export async function syncRoleSettings(schoolCode, roleSettings) {
  const sb = getSupabase();
  const { error } = await sb.from("ecoles").update({ role_settings: roleSettings }).eq("code", schoolCode);
  if (error) throw new Error(error.message || "Enregistrement des rôles impossible.");
  return { ok: true };
}
