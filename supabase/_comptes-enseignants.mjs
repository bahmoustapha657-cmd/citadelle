// ════════════════════════════════════════════════════════════════════════
//  EduGest — Comptes enseignants : périmètre d'écriture et reprise
// ════════════════════════════════════════════════════════════════════════
// Partagé par populate-teacher-classes.mjs (périmètre de TOUS les comptes) et
// reprendre-comptes-prescolaire.mjs (comptes de maternelle créés « primaire »).
// Aucun effet à l'import : les tests (tests/portail-prescolaire.test.js)
// chargent la logique pure sans base.
//
// Périmètre d'un compte = ses classes (emploi du temps + cahier de textes +
// fiche titulaire), résolues en VRAIS libellés de classe des élèves (tolérance
// de préfixe : « 4ème Année » → « 4ème Année A »), écrites dans la table
// `enseignant_classes` (lue par la RLS, cf. teacher-security.sql).
import { resolveCollection, transformRow } from "../src/backend/collection-map.js";
import {
  teacherAliases, matchesTeacherAlias, normalizeText, normalizeSection, teacherCollectionSlug,
} from "../src/backend/teacher-scope.js";

// PostgREST plafonne chaque réponse à 1000 lignes : sans pagination, une
// section de plus de 1000 élèves était tronquée EN SILENCE (classes absentes
// du périmètre). `construire` renvoie une requête neuve à chaque page.
export async function toutesLesLignes(construire) {
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire().order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    lignes.push(...data);
    if (data.length < 1000) break;
  }
  return lignes;
}

// Lecture admin (sans RLS) d'une collection de l'app pour une école.
export async function lireCollection(sb, ecoleId, nom) {
  const m = resolveCollection(nom);
  if (!m) throw new Error(`Collection sans table Supabase : ${nom}`);
  const lignes = await toutesLesLignes(() => {
    const q = sb.from(m.table).select("*").eq("ecole_id", ecoleId);
    return m.section ? q.eq("section", m.section) : q;
  });
  return lignes.map((r) => transformRow(m.table, r));
}

// Profil applicatif d'une ligne `comptes` (champs utiles au périmètre).
export function profilCompte(compte = {}) {
  return {
    nom: compte.nom, enseignantNom: compte.enseignant_nom, enseignantId: compte.enseignant_id,
    section: compte.section, sections: compte.sections, ...(compte.extra || {}),
  };
}

// Classes du périmètre, en libellés réels d'élèves (logique pure).
export function classesDuPerimetre(u, { emplois = [], enseignements = [], roster = [], eleves = [] } = {}) {
  const aliases = teacherAliases(u);
  const fiches = roster.filter((f) =>
    (u.enseignantId && f._id === u.enseignantId) || matchesTeacherAlias(f.nom, aliases));
  const brutes = [
    ...emplois.filter((i) => matchesTeacherAlias(i.enseignant, aliases)).map((e) => e.classe),
    ...enseignements.filter((i) => matchesTeacherAlias(i.enseignantNom, aliases)).map((e) => e.classe),
    ...fiches.flatMap((f) => [f.classeTitle, f.classeTitre, f.classe, f.grade]),
    u.classeTitre, u.classe, ...(Array.isArray(u.classesTitulaire) ? u.classesTitulaire : []),
  ].filter(Boolean);
  const classNorm = [...new Set(brutes.map(normalizeText).filter(Boolean))];

  // Résolution en VRAIS libellés d'élèves (exact OU préfixe).
  const reelles = new Set();
  for (const e of eleves) {
    const ce = normalizeText(e.classe);
    if (classNorm.some((s) => ce === s || ce.startsWith(`${s} `))) reelles.add(e.classe);
  }
  return [...reelles];
}

// Périmètre d'un compte, lu dans les collections de SA section. `cache`
// (une Map par école) évite de relire les mêmes collections pour chaque compte.
export async function perimetrePourCompte(sb, ecoleId, compte, cache = new Map()) {
  const u = profilCompte(compte);
  const section = normalizeSection(u.section || u.sections?.[0] || "college");
  const C = teacherCollectionSlug(section);
  const lire = (nom) => {
    if (!cache.has(nom)) cache.set(nom, lireCollection(sb, ecoleId, nom));
    return cache.get(nom);
  };
  const [emplois, enseignements, roster, eleves] = await Promise.all([
    lire(`classes${C}_emplois`), lire(`ens${C}_enseignements`), lire(`ens${C}`), lire(`eleves${C}`),
  ]);
  return { section, classes: classesDuPerimetre(u, { emplois, enseignements, roster, eleves }) };
}

// Remplace les lignes enseignant_classes d'un compte. `user_id` y est
// dupliqué pour le bucket PowerSync teacher_notes (powersync-scope.sql).
export async function ecrirePerimetre(sb, ecoleId, compte, { section, classes }) {
  const { error: eSuppr } = await sb.from("enseignant_classes").delete().eq("compte_id", compte.id);
  if (eSuppr) throw new Error(`enseignant_classes (suppression) : ${eSuppr.message}`);
  if (!classes.length) return 0;
  const { error: eAjout } = await sb.from("enseignant_classes").insert(classes.map((classe) => ({
    compte_id: compte.id, ecole_id: ecoleId, section, classe, user_id: compte.user_id,
  })));
  if (eAjout) throw new Error(`enseignant_classes (écriture) : ${eAjout.message}`);
  return classes.length;
}

// ── Reprise des comptes de maternelle créés en « primaire » ────────────────
// Jusqu'au 2026-09-24, le module École ramenait la section des enseignants de
// maternelle à « primaire » (teacherAccountSection). Un compte est concerné
// s'il est `enseignant`, de section « primaire », et que sa fiche
// (enseignant_id) est une fiche de MATERNELLE. Renvoie null s'il ne l'est
// pas ; sinon les champs à écrire, ou `aExaminer` si ses `sections` citent
// une autre section (cas qu'aucun écran ne produit : on n'y touche pas).
export function repriseMaternelle(compte = {}, fiche = null) {
  if (compte.role !== "enseignant" || compte.section !== "primaire") return null;
  if (!fiche || fiche.section !== "prescolaire") return null;
  const sections = Array.isArray(compte.sections) ? compte.sections : [];
  const autres = sections.filter((s) => s !== "primaire" && s !== "prescolaire");
  if (autres.length) return { aExaminer: `sections = ${JSON.stringify(sections)}` };
  return { section: "prescolaire", sections: ["prescolaire"] };
}
