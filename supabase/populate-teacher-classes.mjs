// ════════════════════════════════════════════════════════════════════════
//  EduGest — Peuplement du périmètre d'écriture des enseignants
// ════════════════════════════════════════════════════════════════════════
// Pour chaque compte enseignant, calcule ses classes (emploi du temps + cahier
// de textes + fiche titulaire) PUIS les résout en VRAIS libellés de classe des
// élèves (tolérance de préfixe : « 4ème Année » → « 4ème Année A »), et écrit la
// table `enseignant_classes` (lue par la RLS, cf. teacher-security.sql).
// Logique dans _comptes-enseignants.mjs (partagée avec la reprise des comptes
// de maternelle) ; chaque compte est lu dans les collections de SA section,
// maternelle comprise.
//
// Prérequis : teacher-security.sql appliqué. Lancer : node supabase/populate-teacher-classes.mjs
// À RELANCER quand les affectations (emplois/enseignements/titulaire) changent.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { toutesLesLignes, perimetrePourCompte, ecrirePerimetre } from "./_comptes-enseignants.mjs";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

const { data: ecoles } = await sb.from("ecoles").select("id, code");
let total = 0;
let echecs = 0;
for (const ec of ecoles) {
  const cache = new Map();
  const comptes = await toutesLesLignes(() =>
    sb.from("comptes").select("*").eq("ecole_id", ec.id).eq("role", "enseignant"));
  for (const c of comptes) {
    // Une lecture en échec ne doit pas effacer le périmètre existant : on
    // calcule d'abord, on n'écrit qu'ensuite.
    try {
      const perimetre = await perimetrePourCompte(sb, ec.id, c, cache);
      total += await ecrirePerimetre(sb, ec.id, c, perimetre);
      const { section, classes } = perimetre;
      console.log(`${ec.code}/${c.login.padEnd(24)} → ${classes.length ? `${classes.join(", ")} (${section})` : "(aucune classe)"}`);
    } catch (e) {
      echecs++;
      console.error(`${ec.code}/${c.login.padEnd(24)} ❌ ${e.message}`);
    }
  }
}
console.log(`\n✅ ${total} liens enseignant↔classe écrits.`);
if (echecs) {
  console.error(`❌ ${echecs} compte(s) en échec, voir ci-dessus.`);
  process.exit(1);
}
