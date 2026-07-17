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
// Conservé pour compat (mode Firebase / anciennes écoles) — le modèle
// Supabase vit désormais dans la table `postes` ci-dessous.
export async function syncRoleSettings(schoolCode, roleSettings) {
  const sb = getSupabase();
  const { error } = await sb.from("ecoles").update({ role_settings: roleSettings }).eq("code", schoolCode);
  if (error) throw new Error(error.message || "Enregistrement des rôles impossible.");
  return { ok: true };
}

// ── Postes flexibles (table `postes`, RLS : lecture staff, écriture direction) ─
async function ecoleIdDepuisCode(sb, schoolCode) {
  const { data, error } = await sb.from("ecoles").select("id").eq("code", schoolCode).maybeSingle();
  if (error || !data) throw new Error("École introuvable.");
  return data.id;
}

// Postes de l'école + nombre de comptes rattachés à chacun.
export async function chargerPostes() {
  const sb = getSupabase();
  const { data, error } = await sb.from("postes")
    .select("*, comptes(count)")
    .order("systeme", { ascending: false })
    .order("label");
  if (error) throw new Error(error.message || "Chargement des postes impossible.");
  return (data || []).map((p) => ({
    id: p.id, cle: p.cle, label: p.label, systeme: !!p.systeme, actif: !!p.actif,
    permissions: p.permissions || {}, nbComptes: p.comptes?.[0]?.count ?? 0,
  }));
}

// Crée ou met à jour un poste (RLS : direction/superadmin uniquement).
export async function sauverPoste(schoolCode, poste) {
  const sb = getSupabase();
  const champs = {
    cle: poste.cle, label: poste.label, actif: poste.actif !== false,
    systeme: !!poste.systeme, permissions: poste.permissions || {},
  };
  if (poste.id) {
    const { error } = await sb.from("postes").update(champs).eq("id", poste.id);
    if (error) throw new Error(error.message || "Enregistrement du poste impossible.");
    return { ok: true, id: poste.id };
  }
  const ecoleId = await ecoleIdDepuisCode(sb, schoolCode);
  const { data, error } = await sb.from("postes")
    .insert({ ...champs, ecole_id: ecoleId }).select("id").single();
  if (error) throw new Error(error.message || "Création du poste impossible.");
  return { ok: true, id: data.id };
}

// Supprime un poste SANS comptes rattachés (garde-fou côté client).
export async function supprimerPoste(posteId) {
  const sb = getSupabase();
  const { count, error: cErr } = await sb.from("comptes")
    .select("id", { count: "exact", head: true }).eq("poste_id", posteId);
  if (cErr) throw new Error(cErr.message || "Vérification du poste impossible.");
  if ((count ?? 0) > 0) throw new Error("Des comptes sont rattachés à ce poste — détachez-les d'abord.");
  const { error } = await sb.from("postes").delete().eq("id", posteId);
  if (error) throw new Error(error.message || "Suppression du poste impossible.");
  return { ok: true };
}

// Rattache les comptes legacy (role enum) aux postes système de même clé —
// bootstrap des nouvelles écoles et rattrapage après création des postes.
export async function rattacherComptesAuxPostes(postes) {
  const sb = getSupabase();
  for (const poste of postes) {
    const { error } = await sb.from("comptes")
      .update({ poste_id: poste.id })
      .eq("role", poste.cle).is("poste_id", null);
    if (error) throw new Error(error.message || `Rattachement au poste ${poste.label} impossible.`);
  }
  return { ok: true };
}
