// ════════════════════════════════════════════════════════════════════════
//  EduGest — Peuplement du périmètre d'écriture des enseignants
// ════════════════════════════════════════════════════════════════════════
// Pour chaque compte enseignant, calcule ses classes (emploi du temps + cahier
// de textes + fiche titulaire) PUIS les résout en VRAIS libellés de classe des
// élèves (tolérance de préfixe : « 4ème Année » → « 4ème Année A »), et écrit la
// table `enseignant_classes` (lue par la RLS, cf. teacher-security.sql).
//
// Prérequis : teacher-security.sql appliqué. Lancer : node supabase/populate-teacher-classes.mjs
// À RELANCER quand les affectations (emplois/enseignements/titulaire) changent.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { resolveCollection, transformRow } from "../src/backend/collection-map.js";
import { teacherAliases, matchesTeacherAlias, normalizeText, normalizeSection } from "../src/backend/teacher-scope.js";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const CAP = { primaire: "Primaire", college: "College", lycee: "Lycee" };

// Lecture admin (sans RLS) d'une collection pour une école donnée.
async function lire(ecoleId, nom) {
  const m = resolveCollection(nom);
  let q = sb.from(m.table).select("*").eq("ecole_id", ecoleId);
  if (m.section) q = q.eq("section", m.section);
  const { data } = await q;
  return (data || []).map((r) => transformRow(m.table, r));
}

async function perimetrePourCompte(ecoleId, compte) {
  const u = {
    nom: compte.nom, enseignantNom: compte.enseignant_nom, enseignantId: compte.enseignant_id,
    section: compte.section, sections: compte.sections, ...(compte.extra || {}),
  };
  const section = normalizeSection(u.section || u.sections?.[0] || "college");
  const C = CAP[section];
  const aliases = teacherAliases(u);

  const [emplois, ens, roster, elevesAll] = await Promise.all([
    lire(ecoleId, `classes${C}_emplois`), lire(ecoleId, `ens${C}_enseignements`),
    lire(ecoleId, `ens${C}`), lire(ecoleId, `eleves${C}`),
  ]);
  const fiches = roster.filter((f) =>
    (u.enseignantId && f._id === u.enseignantId) || matchesTeacherAlias(f.nom, aliases));
  const brutes = [
    ...emplois.filter((i) => matchesTeacherAlias(i.enseignant, aliases)).map((e) => e.classe),
    ...ens.filter((i) => matchesTeacherAlias(i.enseignantNom, aliases)).map((e) => e.classe),
    ...fiches.flatMap((f) => [f.classeTitle, f.classeTitre, f.classe, f.grade]),
    u.classeTitre, u.classe, ...(Array.isArray(u.classesTitulaire) ? u.classesTitulaire : []),
  ].filter(Boolean);
  const classNorm = [...new Set(brutes.map(normalizeText).filter(Boolean))];

  // Résolution en VRAIS libellés d'élèves (exact OU préfixe).
  const reelles = new Set();
  for (const e of elevesAll) {
    const ce = normalizeText(e.classe);
    if (classNorm.some((s) => ce === s || ce.startsWith(`${s} `))) reelles.add(e.classe);
  }
  return { section, classes: [...reelles] };
}

const { data: ecoles } = await sb.from("ecoles").select("id, code");
let total = 0;
for (const ec of ecoles) {
  const { data: comptes } = await sb.from("comptes").select("*").eq("ecole_id", ec.id).eq("role", "enseignant");
  for (const c of comptes || []) {
    const { section, classes } = await perimetrePourCompte(ec.id, c);
    await sb.from("enseignant_classes").delete().eq("compte_id", c.id);
    if (classes.length) {
      await sb.from("enseignant_classes").insert(classes.map((classe) => ({
        compte_id: c.id, ecole_id: ec.id, section, classe,
      })));
      total += classes.length;
    }
    console.log(`${ec.code}/${c.login.padEnd(24)} → ${classes.length ? classes.join(", ") : "(aucune classe)"}`);
  }
}
console.log(`\n✅ ${total} liens enseignant↔classe écrits.`);
