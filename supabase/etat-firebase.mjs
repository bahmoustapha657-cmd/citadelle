// Lecture seule : écoles Firebase, verrou (basculeSupabase) et VOLUME réel
// (élèves = somme des 3 collections sectionnées) pour distinguer les écoles
// actives des simples inscriptions vides.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";

const HERE = dirname(fileURLToPath(import.meta.url));
const svcFile = readdirSync(HERE).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!svcFile) { console.error("❌ Clé de service Firebase introuvable dans", HERE); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(join(HERE, svcFile), "utf8"))) });

const db = admin.firestore();

// Écoles présentes sur Supabase (audit du 2026-07-19) — pour marquer l'overlap.
const SUR_SUPABASE = new Set([
  "balde-ibrahima", "citadelle", "ecole-adventiste-de-sarh", "ep-guemebo",
  "kalika", "mamadou-hawa-doumbouya", "oumar-competence", "parawi",
]);

async function compter(code, sub) {
  const s = await db.collection("ecoles").doc(code).collection(sub).count().get().catch(() => null);
  return s ? s.data().count : 0;
}

const snap = await db.collection("ecoles").get();
console.log(`Écoles dans Firebase prod : ${snap.size}\n`);
console.log("verrou  | overlap Supabase | code                         | élèves | comptes | école");
console.log("─".repeat(100));
const lignes = [];
for (const doc of snap.docs) {
  const d = doc.data();
  const eleves = (await compter(doc.id, "elevesPrimaire")) + (await compter(doc.id, "elevesCollege")) + (await compter(doc.id, "elevesLycee"));
  const comptes = await compter(doc.id, "comptes");
  lignes.push({ code: doc.id, nom: d.nom || "?", verrou: d.basculeSupabase === true, actif: d.actif !== false, eleves, comptes });
}
lignes.sort((a, b) => b.eleves - a.eleves);
for (const l of lignes) {
  const v = l.verrou ? "🔒" : "🔓";
  const o = SUR_SUPABASE.has(l.code) ? "✅ oui" : "❌ NON  ";
  console.log(`  ${v}    | ${o}          | ${l.code.padEnd(28)} | ${String(l.eleves).padStart(5)}  | ${String(l.comptes).padStart(6)}  | ${l.nom}${l.actif ? "" : " (inactif)"}`);
}

const orphelines = lignes.filter((l) => !SUR_SUPABASE.has(l.code) && l.eleves > 0);
console.log("\n" + "═".repeat(60));
console.log(`Écoles Firebase AVEC données mais SANS équivalent Supabase : ${orphelines.length}`);
orphelines.forEach((l) => console.log(`  ⚠️  ${l.code} — ${l.eleves} élèves`));
process.exit(0);
