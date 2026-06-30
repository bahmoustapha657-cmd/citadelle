// ── Panneau superadmin via Supabase ─────────────────────────────────────────
// Le superadmin a un bypass RLS (is_superadmin) → il lit/écrit toutes les écoles
// directement, sans Edge Function. Reproduit le contrat de ecoles-admin-api.js.
import { getSupabase } from "../supabaseClient";
import { NEW_SCHOOL_DEFAULTS } from "../components/superadmin/constants";

// Ligne `ecoles` (snake + extra) → forme attendue par l'UI (_id = code école).
function toEcole(r) {
  return {
    _id: r.code, code: r.code, nom: r.nom, pays: r.pays, logo: r.logo,
    couleur1: r.couleur1, couleur2: r.couleur2, plan: r.plan, planExpiry: r.plan_expiry,
    modeleBulletin: r.modele_bulletin, roleSettings: r.role_settings,
    actif: r.actif, supprime: r.supprime, ...(r.extra || {}),
  };
}

export async function chargerEcolesAvecStats() {
  const sb = getSupabase();
  const { data: rows } = await sb.from("ecoles").select("*");
  const liste = (rows || []).map(toEcole);
  const statsMap = {};
  const cnt = (t, id) => sb.from(t).select("*", { count: "exact", head: true }).eq("ecole_id", id).then((r) => r.count || 0);
  await Promise.all((rows || []).map(async (r) => {
    const [eleves, comptes, enseignants] = await Promise.all([cnt("eleves", r.id), cnt("comptes", r.id), cnt("enseignants", r.id)]);
    statsMap[r.code] = { eleves, comptes, enseignants };
  }));
  return { liste, statsMap };
}

// Pas de temps réel ici (v1) : on charge une fois et on renvoie un unsub neutre.
export function souscrireDemandes(onData) {
  const sb = getSupabase();
  sb.from("demandes_plan").select("*, ecoles(code)").order("created_at", { ascending: false }).then(({ data }) => {
    onData((data || []).map((d) => ({
      ...(d.extra || {}),
      _id: d.id, _schoolId: d.ecoles?.code, planDemande: d.plan_demande,
      statut: d.statut, createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
    })));
  });
  return () => {};
}

async function ecoleIdParCode(sb, code) {
  const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
  return data?.id || null;
}

export async function validerDemandeApi(demande) {
  const sb = getSupabase();
  const plan = demande.planDemande || "starter";
  const planExpiry = Date.now() + 365 * 86400000;
  const id = await ecoleIdParCode(sb, demande._schoolId);
  await sb.from("ecoles").update({ plan, plan_expiry: planExpiry }).eq("id", id);
  await sb.from("demandes_plan").update({ statut: "validee" }).eq("id", demande._id);
  return { plan, update: { plan, planExpiry } };
}

export async function rejeterDemandeApi(demande) {
  const sb = getSupabase();
  await sb.from("demandes_plan").update({ statut: "rejetee" }).eq("id", demande._id);
}

export async function appliquerPlan(ecoleId, update) {
  const sb = getSupabase();
  // ecoleId = code ; update camelCase → colonnes connues (le reste est ignoré).
  await sb.from("ecoles").update({ plan: update.plan, plan_expiry: update.planExpiry }).eq("code", ecoleId);
}

export async function executerCycleVieApi({ schoolId, action }) {
  const sb = getSupabase();
  if (action === "deactivate") await sb.from("ecoles").update({ actif: false }).eq("code", schoolId);
  else if (action === "reactivate") await sb.from("ecoles").update({ actif: true }).eq("code", schoolId);
  else if (action === "delete") {
    const { error } = await sb.from("ecoles").delete().eq("code", schoolId); // cascade
    if (error) return { ok: false, data: { error: error.message } };
  } else return { ok: false, data: { error: "Action inconnue." } };
  return { ok: true, data: { ok: true } };
}

export async function creerEcoleApi(nouvelleEcole, sid) {
  const sb = getSupabase();
  if (await ecoleIdParCode(sb, sid)) return { ok: false };
  const { plan, ...resteDefauts } = NEW_SCHOOL_DEFAULTS || {};
  const { error } = await sb.from("ecoles").insert({
    code: sid, nom: nouvelleEcole.nom.trim(),
    pays: (nouvelleEcole.pays || "").trim() || "Guinée",
    plan: plan || "gratuit",
    extra: { ...resteDefauts, ville: (nouvelleEcole.ville || "").trim(), createdAt: Date.now() },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Une école demande un plan (écran tableau de bord / modale d'upgrade).
export async function demanderPlan(schoolCode, plan, extra = {}) {
  const sb = getSupabase();
  const id = await ecoleIdParCode(sb, schoolCode);
  if (!id) throw new Error("École introuvable.");
  const { error } = await sb.from("demandes_plan").insert({
    ecole_id: id, plan_demande: plan, statut: "en_attente", extra,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
