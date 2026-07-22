// ── Lecture de collections via Supabase (Tranche 2) ─────────────────────────
// Reproduit le contrat de lecture de useFirestore : renvoie des items camelCase
// (avec `_id`) identiques à Firestore. La sécurité reste assurée par la RLS
// (filtrage par école + rôle) ; on filtre aussi explicitement par ecole_id.
//
// Mode hors ligne (PowerSync, vague 1) : pour les tables de TABLES_HORS_LIGNE,
// lecture/écriture passent par le miroir SQLite local (local-data.js) au lieu
// d'un appel réseau direct — mêmes signatures, mêmes formes de retour, donc
// aucun changement côté appelants (useFirestore.js, teacher-portal-supabase.js…).
import { getSupabase } from "../supabaseClient";
import { resolveCollection, transformRow, toRow, ecritureSupportee } from "./collection-map";
// `tables.js` est un module léger (aucune dépendance @powersync/web/wa-sqlite) :
// import statique sûr dans les deux builds (Firebase et Supabase). Le reste de
// powersync/ (client/connector/local-data, qui embarquent le SQLite WASM) n'est
// chargé qu'en `import()` dynamique, uniquement quand `horsLigne()` est vrai —
// zéro coût de bundle pour les utilisateurs Firebase (prod).
import { estCouvertHorsLigne, powerSyncConfigured } from "./powersync/tables";

let localDataPromise = null;
function localData() {
  if (!localDataPromise) localDataPromise = import("./powersync/local-data");
  return localDataPromise;
}

// Tables filtrables par année (colonne `annee`).
const ANNEE_TABLES = new Set(["notes", "recettes", "depenses", "versements", "bons"]);

// schoolId applicatif = CODE de l'école ; les tables référencent l'uuid.
// Mis aussi en cache localStorage : nécessaire pour résoudre l'ecole_id hors
// ligne (premier chargement après un rechargement de page sans réseau).
const ecoleIdCache = new Map();
async function ecoleIdFromCode(sb, code) {
  if (ecoleIdCache.has(code)) return ecoleIdCache.get(code);
  const clefLocale = `LC_ecole_id_${code}`;
  try {
    const { data } = await sb.from("ecoles").select("id").eq("code", code).maybeSingle();
    const id = data?.id || null;
    if (id) {
      ecoleIdCache.set(code, id);
      localStorage.setItem(clefLocale, id);
      return id;
    }
  } catch { /* hors ligne : bascule sur le cache local ci-dessous */ }
  const idLocal = localStorage.getItem(clefLocale);
  if (idLocal) ecoleIdCache.set(code, idLocal);
  return idLocal || null;
}

// Utilise le miroir local uniquement si la table est couverte ET que
// l'instance PowerSync est configurée (sinon comportement en ligne inchangé).
const horsLigne = (table) => powerSyncConfigured && estCouvertHorsLigne(table);

// Renvoie { items, unsupported? }. `unsupported` = collection sans table Supabase.
export async function chargerCollection(schoolCode, nomCollection, { annee } = {}) {
  const map = resolveCollection(nomCollection);
  if (!map) return { items: [], unsupported: true };

  const sb = getSupabase();
  const ecoleId = await ecoleIdFromCode(sb, schoolCode);
  if (!ecoleId) return { items: [] };

  if (horsLigne(map.table)) {
    try {
      const { lireLocal } = await localData();
      const rows = await lireLocal(map.table, { ecoleId, section: map.section, annee });
      return { items: rows.map((r) => transformRow(map.table, r)) };
    } catch (err) {
      console.warn(`[powersync] lecture locale ${nomCollection} (${map.table}):`, err?.message || err);
      return { items: [] };
    }
  }

  // PostgREST plafonne chaque réponse à 1000 lignes : sans pagination, les
  // grosses collections (ex. 7 496 notes du primaire) étaient tronquées en
  // silence — l'app ne voyait que les 1 000 premières. On pagine par .range(),
  // trié par id pour que les pages ne se chevauchent pas.
  const PAGE = 1000;
  const rows = [];
  for (let de = 0; ; de += PAGE) {
    let q = sb.from(map.table).select("*").eq("ecole_id", ecoleId)
      .order("id").range(de, de + PAGE - 1);
    if (map.section) q = q.eq("section", map.section);
    if (annee && ANNEE_TABLES.has(map.table)) q = q.eq("annee", annee);

    const { data, error } = await q;
    if (error) {
      console.warn(`[supabase] lecture ${nomCollection} (${map.table}):`, error.message);
      return { items: [] };
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { items: rows.map((r) => transformRow(map.table, r)) };
}

// Info école (branding + plan) → objet camelCase prêt pour mergeSchoolInfo.
function ecoleVersInfo(data) {
  const x = data.extra || {};
  return {
    ...x,
    nom: data.nom, logo: data.logo, couleur1: data.couleur1, couleur2: data.couleur2,
    // La colonne `devise` porte la MAXIME de l'école (héritage Firebase, cf.
    // migration) ; la monnaie vit dans extra.monnaie. L'ancien mapping
    // `monnaie: data.devise || …` affichait la maxime devant les montants.
    pays: data.pays, devise: data.devise, monnaie: x.monnaie || "GNF",
    plan: data.plan, planExpiry: data.plan_expiry, modeleBulletin: data.modele_bulletin,
    roleSettings: data.role_settings, legal: data.legal, verrous: x.verrous,
  };
}

export async function chargerEcole(schoolCode) {
  // Miroir local d'abord (frais : PowerSync streame en continu) ; repli
  // réseau si la première sync n'a pas encore livré la ligne.
  if (horsLigne("ecoles")) {
    try {
      const { lireEcoleLocale } = await localData();
      const locale = await lireEcoleLocale(schoolCode);
      if (locale) return ecoleVersInfo(locale);
    } catch { /* miroir pas encore prêt → réseau */ }
  }
  const sb = getSupabase();
  const { data } = await sb.from("ecoles").select("*").eq("code", schoolCode).maybeSingle();
  if (!data) return null;
  return ecoleVersInfo(data);
}

// Sauvegarde des Paramètres de l'école côté Supabase : les champs qui ont une
// colonne réelle y vont, tout le reste est FUSIONNÉ dans extra (jsonb) — le
// miroir exact de chargerEcole ci-dessus (extra étalé + colonnes par-dessus).
// NB : la colonne `devise` porte la MAXIME de l'école (héritage Firebase) ;
// la monnaie va dans extra.monnaie.
export async function sauverParametresEcole(schoolCode, champs) {
  const sb = getSupabase();
  const { data, error } = await sb.from("ecoles").select("id, extra").eq("code", schoolCode).maybeSingle();
  if (error || !data) throw new Error(error?.message || "École introuvable.");
  const COLONNES = { nom: "nom", logo: "logo", couleur1: "couleur1", couleur2: "couleur2", pays: "pays", devise: "devise", modeleBulletin: "modele_bulletin" };
  const patch = {};
  const extraPatch = {};
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur === undefined) continue;
    if (COLONNES[cle]) patch[COLONNES[cle]] = valeur;
    else extraPatch[cle] = valeur;
  }
  patch.extra = { ...(data.extra || {}), ...extraPatch };
  const { error: e2 } = await sb.from("ecoles").update(patch).eq("id", data.id);
  if (e2) throw new Error(e2.message);
  return { ok: true };
}

// Bascule d'un verrou de correction (AdminPanel, direction). Les verrous
// vivent dans ecoles.extra.verrous — lecture/fusion/écriture du jsonb.
export async function majVerrou(schoolCode, cle, valeur) {
  const sb = getSupabase();
  const { data, error } = await sb.from("ecoles").select("id, extra").eq("code", schoolCode).maybeSingle();
  if (error || !data) throw new Error(error?.message || "École introuvable.");
  const extra = { ...(data.extra || {}), verrous: { ...((data.extra || {}).verrous || {}), [cle]: valeur } };
  const { error: e2 } = await sb.from("ecoles").update({ extra }).eq("id", data.id);
  if (e2) throw new Error(e2.message);
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

  if (horsLigne(map.table)) {
    const { insererLocal } = await localData();
    const cree = await insererLocal(map.table, row);
    return transformRow(map.table, cree);
  }

  const { data, error } = await sb.from(map.table).insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return transformRow(map.table, data);
}

// Insert en LOT : une seule requête PostgREST pour N items (vs N ajouterDoc).
// Renvoie les items créés (avec _id) au format camelCase.
export async function ajouterDocs(schoolCode, nomCollection, items) {
  if (!items.length) return [];
  const { sb, map, ecoleId } = await contexteEcriture(schoolCode, nomCollection);
  const rows = items.map((item) => {
    const { row } = toRow(map.table, item);
    row.ecole_id = ecoleId;
    if (map.section) row.section = map.section;
    return row;
  });

  if (horsLigne(map.table)) {
    const { insererLocal } = await localData();
    const crees = [];
    for (const row of rows) crees.push(await insererLocal(map.table, row));
    return crees.map((r) => transformRow(map.table, r));
  }

  const { data, error } = await sb.from(map.table).insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data || []).map((r) => transformRow(map.table, r));
}

// Upsert en LOT (items avec _id) : une seule requête pour N mises à jour.
// Chaque row doit porter toutes les colonnes not-null (l'ON CONFLICT réécrit la ligne).
export async function upsertDocs(schoolCode, nomCollection, items) {
  if (!items.length) return [];
  const { sb, map, ecoleId } = await contexteEcriture(schoolCode, nomCollection);
  const rows = items.map((item) => {
    const { row } = toRow(map.table, item);
    row.ecole_id = ecoleId;
    if (map.section) row.section = map.section;
    return { id: item._id, row };
  });

  if (horsLigne(map.table)) {
    const { upsertLocal } = await localData();
    const upserted = [];
    for (const { id, row } of rows) upserted.push(await upsertLocal(map.table, id, row));
    return upserted.map((r) => transformRow(map.table, r));
  }

  const { data, error } = await sb.from(map.table)
    .upsert(rows.map(({ id, row }) => ({ ...row, id })), { onConflict: "id" }).select("*");
  if (error) throw new Error(error.message);
  return (data || []).map((r) => transformRow(map.table, r));
}

export async function modifierDoc(schoolCode, nomCollection, item) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);
  const { row } = toRow(map.table, item);

  if (horsLigne(map.table)) {
    const { majLocal } = await localData();
    await majLocal(map.table, item._id, row);
    return;
  }

  const { error } = await sb.from(map.table).update(row).eq("id", item._id);
  if (error) throw new Error(error.message);
}

// Update partiel : ne touche que les champs fournis. Si certains partent dans le
// jsonb (extra/details), on fusionne avec l'existant (read-modify-write) pour ne
// pas écraser les autres clés. Fonctionne identiquement en local (hors ligne) :
// seule la source de la lecture préalable change.
export async function modifierChampDoc(schoolCode, nomCollection, id, champs) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);
  const { row, extraKeys, extraCol } = toRow(map.table, champs);

  if (horsLigne(map.table)) {
    const { majLocal, lireUneLocal } = await localData();
    if (extraCol && extraKeys.length) {
      const actuel = await lireUneLocal(map.table, id);
      row[extraCol] = { ...(actuel?.[extraCol] || {}), ...row[extraCol] };
    }
    await majLocal(map.table, id, row);
    return;
  }

  if (extraCol && extraKeys.length) {
    const { data: actuel } = await sb.from(map.table).select(extraCol).eq("id", id).maybeSingle();
    row[extraCol] = { ...(actuel?.[extraCol] || {}), ...row[extraCol] };
  }
  const { error } = await sb.from(map.table).update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supprimerDoc(schoolCode, nomCollection, id) {
  const { sb, map } = await contexteEcriture(schoolCode, nomCollection);

  if (horsLigne(map.table)) {
    const { supprimerLocal } = await localData();
    await supprimerLocal(map.table, id);
    return;
  }

  const { error } = await sb.from(map.table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
