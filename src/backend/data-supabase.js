// ── Lecture de collections via Supabase (Tranche 2) ─────────────────────────
// Reproduit le contrat de lecture de useFirestore : renvoie des items camelCase
// (avec `_id`) identiques à Firestore. La sécurité reste assurée par la RLS
// (filtrage par école + rôle) ; on filtre aussi explicitement par ecole_id.
import { getSupabase } from "../supabaseClient";
import { resolveCollection, transformRow } from "./collection-map";

// schoolId applicatif = CODE de l'école ; les tables référencent l'uuid.
const ecoleIdCache = new Map();
async function ecoleIdFromCode(sb, code) {
  if (ecoleIdCache.has(code)) return ecoleIdCache.get(code);
  const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
  const id = data?.id || null;
  if (id) ecoleIdCache.set(code, id);
  return id;
}

// Renvoie { items, unsupported? }. `unsupported` = collection sans table Supabase.
export async function chargerCollection(schoolCode, nomCollection, { annee } = {}) {
  const map = resolveCollection(nomCollection);
  if (!map) return { items: [], unsupported: true };

  const sb = getSupabase();
  const ecoleId = await ecoleIdFromCode(sb, schoolCode);
  if (!ecoleId) return { items: [] };

  let q = sb.from(map.table).select("*").eq("ecole_id", ecoleId);
  if (map.section) q = q.eq("section", map.section);
  if (annee && map.table === "notes") q = q.eq("annee", annee);

  const { data, error } = await q;
  if (error) {
    console.warn(`[supabase] lecture ${nomCollection} (${map.table}):`, error.message);
    return { items: [] };
  }
  return { items: (data || []).map((r) => transformRow(map.table, r)) };
}

// Info école (branding + plan) → objet camelCase prêt pour mergeSchoolInfo.
export async function chargerEcole(schoolCode) {
  const sb = getSupabase();
  const { data } = await sb.from("ecoles").select("*").eq("code", schoolCode).maybeSingle();
  if (!data) return null;
  const x = data.extra || {};
  return {
    ...x,
    nom: data.nom, logo: data.logo, couleur1: data.couleur1, couleur2: data.couleur2,
    pays: data.pays, devise: data.devise, monnaie: data.devise || x.monnaie,
    plan: data.plan, planExpiry: data.plan_expiry, modeleBulletin: data.modele_bulletin,
    roleSettings: data.role_settings, legal: data.legal, verrous: x.verrous,
  };
}

// Les écritures ne sont pas encore portées (Tranche 3). On échoue clairement
// plutôt que de corrompre/perdre des données silencieusement.
export const ERREUR_ECRITURE = "Mode Supabase : écriture non encore disponible (lecture seule — Tranche 2).";
