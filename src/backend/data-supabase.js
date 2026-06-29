// ── Lecture de collections via Supabase (Tranche 2) ─────────────────────────
// Reproduit le contrat de lecture de useFirestore : renvoie des items camelCase
// (avec `_id`) identiques à Firestore. La sécurité reste assurée par la RLS
// (filtrage par école + rôle) ; on filtre aussi explicitement par ecole_id.
import { getSupabase } from "../supabaseClient";
import { resolveCollection, transformRow, toRow, ecritureSupportee } from "./collection-map";

// Tables filtrables par année (colonne `annee`).
const ANNEE_TABLES = new Set(["notes", "recettes", "depenses", "versements", "bons"]);

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
  if (annee && ANNEE_TABLES.has(map.table)) q = q.eq("annee", annee);

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

// ── Écritures (Tranche 3) ───────────────────────────────────────────────────
// Message d'erreur pour les collections sans table/écriture portée.
export const ERREUR_ECRITURE = "Mode Supabase : écriture non disponible pour cette section (non encore modélisée).";

// Résout map + ecole_id ou lève une erreur claire si la collection n'est pas portée.
async function contexteEcriture(schoolCode, nomCollection) {
  const map = resolveCollection(nomCollection);
  if (!map || !ecritureSupportee(map.table)) throw new Error(ERREUR_ECRITURE);
  const sb = getSupabase();
  const ecoleId = await ecoleIdFromCode(sb, schoolCode);
  if (!ecoleId) throw new Error("École introuvable.");
  return { sb, map, ecoleId };
}

export async function ajouterDoc(schoolCode, nomCollection, item) {
  const { sb, map, ecoleId } = await contexteEcriture(schoolCode, nomCollection);
  const { row } = toRow(map.table, item);
  row.ecole_id = ecoleId;
  if (map.section) row.section = map.section;
  const { data, error } = await sb.from(map.table).insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return transformRow(map.table, data);
}

export async function modifierDoc(schoolCode, nomCollection, item) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);
  const { row } = toRow(map.table, item);
  const { error } = await sb.from(map.table).update(row).eq("id", item._id);
  if (error) throw new Error(error.message);
}

// Update partiel : ne touche que les champs fournis. Si certains partent dans le
// jsonb (extra/details), on fusionne avec l'existant (read-modify-write) pour ne
// pas écraser les autres clés.
export async function modifierChampDoc(schoolCode, nomCollection, id, champs) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);
  const { row, extraKeys, extraCol } = toRow(map.table, champs);
  if (extraCol && extraKeys.length) {
    const { data: actuel } = await sb.from(map.table).select(extraCol).eq("id", id).maybeSingle();
    row[extraCol] = { ...(actuel?.[extraCol] || {}), ...row[extraCol] };
  }
  const { error } = await sb.from(map.table).update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supprimerDoc(schoolCode, nomCollection, id) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);
  const { error } = await sb.from(map.table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
