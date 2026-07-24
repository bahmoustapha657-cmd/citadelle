// Audit read-only : qualité des numéros de tuteur (eleves.contact_tuteur)
// pour évaluer la faisabilité des notifications SMS/WhatsApp.
// Guinée : E.164 = +224 suivi de 9 chiffres (mobile commence par 6).
// Usage : node supabase/audit-telephones.mjs
import cfg from "file:///C:/Users/ADMIN/citadelle/supabase/config.local.mjs";
import { createClient } from "@supabase/supabase-js";
import { normaliserTelGuinee } from "file:///C:/Users/ADMIN/citadelle/shared/phone.js";

const sb = createClient(cfg.url, cfg.serviceRole);

async function pageComptes(table, cols) {
  const rows = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(table).select(cols).order("id").range(de, de + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const ecoles = await pageComptes("ecoles", "id, code, nom");
const eleves = await pageComptes("eleves", "id, ecole_id, contact_tuteur, statut");

const parEcole = {};
for (const ec of ecoles) parEcole[ec.id] = { code: ec.code, nom: ec.nom, total: 0, valides: 0, vides: 0, invalides: 0 };
for (const el of eleves) {
  const s = parEcole[el.ecole_id];
  if (!s) continue;
  s.total++;
  if (!el.contact_tuteur || !String(el.contact_tuteur).trim()) { s.vides++; continue; }
  if (normaliserTelGuinee(el.contact_tuteur)) s.valides++;
  else s.invalides++;
}

console.log("École                     | élèves | joignables | vides | invalides | %");
console.log("-".repeat(78));
for (const s of Object.values(parEcole).sort((a, b) => b.total - a.total)) {
  if (!s.total) continue;
  const pct = Math.round((s.valides / s.total) * 100);
  console.log(
    `${(s.nom || s.code).slice(0, 25).padEnd(25)} | ${String(s.total).padStart(6)} | ${String(s.valides).padStart(10)} | ${String(s.vides).padStart(5)} | ${String(s.invalides).padStart(9)} | ${pct}%`,
  );
}

// Échantillon de numéros invalides (pour voir les formats à récupérer).
const echantillon = eleves
  .filter((e) => e.contact_tuteur && String(e.contact_tuteur).trim() && !normaliserTelGuinee(e.contact_tuteur))
  .slice(0, 12)
  .map((e) => JSON.stringify(e.contact_tuteur));
console.log("\nÉchantillon de numéros NON normalisables :");
console.log(echantillon.join("  ") || "(aucun)");
process.exit(0);
