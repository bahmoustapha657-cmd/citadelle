// ════════════════════════════════════════════════════════════════════════
//  EduGest — Contrôle avant/après la phase 2 de la paie des enseignants
// ════════════════════════════════════════════════════════════════════════
// LECTURE SEULE (clé service_role, aucune écriture). Répond, école par école :
// la paie de chaque enseignant est-elle bien dans `paie_enseignants` avant
// qu'on l'efface de `enseignants.extra` (migration *_paie_enseignants_hors_fiche) ?
//
//   node supabase/verifier-paie-enseignants.mjs
//
// Colonnes : fiches = enseignants de l'école · sur fiche = paie encore dans
// extra · en table = lignes de paie_enseignants · sans ligne = paie sur la
// fiche sans ligne en table (la migration les recopie) · écarts = paie de la
// fiche ≠ paie de la table (la TABLE fait foi : seule la Comptabilité y écrit ;
// la fiche a pu être réenregistrée par un autre compte). Aucun montant affiché.
//
// Avant la phase 2 : « sans ligne » et « écarts » doivent être relus.
// Après : « sur fiche » doit valoir 0 partout. Sortie 1 si des fiches portent
// encore une paie (utile après coup), 0 sinon.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { CLES_PAIE_ENSEIGNANT, extrairePaie } from "../src/paie-enseignants.js";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const PAGE = 1000;

async function toutLire(table, colonnes) {
  const lignes = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await sb.from(table).select(colonnes).order("id").range(de, de + PAGE - 1);
    if (error) throw new Error(`${table} : ${error.message}`);
    lignes.push(...data);
    if (data.length < PAGE) return lignes;
  }
}

// Comparaison stable (l'ordre des clés jsonb n'est pas garanti).
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

const [ecoles, fiches, paies] = await Promise.all([
  toutLire("ecoles", "id, code, nom"),
  toutLire("enseignants", "id, ecole_id, nom, prenom, section, extra"),
  toutLire("paie_enseignants", "id, ecole_id, extra"),
]);
const paieParId = new Map(paies.map((p) => [p.id, p]));

console.log(`Clés de paie : ${CLES_PAIE_ENSEIGNANT.join(", ")}\n`);
let surFicheTotal = 0;
for (const ecole of ecoles) {
  const siennes = fiches.filter((f) => f.ecole_id === ecole.id);
  if (!siennes.length) continue;
  const surFiche = siennes.filter((f) => Object.keys(extrairePaie(f.extra || {})).length);
  const sansLigne = surFiche.filter((f) => !paieParId.has(f.id));
  const ecarts = surFiche.filter((f) => paieParId.has(f.id)
    && stable(extrairePaie(f.extra)) !== stable(extrairePaie(paieParId.get(f.id).extra)));
  const enTable = paies.filter((p) => p.ecole_id === ecole.id).length;
  surFicheTotal += surFiche.length;
  console.log(`${ecole.nom || ecole.code} : ${siennes.length} fiches · ${surFiche.length} sur fiche · ${enTable} en table · ${sansLigne.length} sans ligne · ${ecarts.length} écarts`);
  const nom = (f) => `${f.prenom || ""} ${f.nom || ""}`.trim() + ` (${f.section})`;
  for (const f of sansLigne) console.log(`   sans ligne : ${nom(f)}`);
  for (const f of ecarts) {
    const cles = CLES_PAIE_ENSEIGNANT.filter((k) => stable(f.extra?.[k]) !== stable(paieParId.get(f.id).extra?.[k]));
    console.log(`   écart : ${nom(f)} — ${cles.join(", ")}`);
  }
}
console.log(`\nPaie encore sur les fiches : ${surFicheTotal}`);
process.exitCode = surFicheTotal ? 1 : 0;
