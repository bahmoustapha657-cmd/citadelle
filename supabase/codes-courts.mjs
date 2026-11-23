// ════════════════════════════════════════════════════════════════════════
//  Codes courts des écoles (migration 20261123184655_codes_ecole_courts.sql)
// ════════════════════════════════════════════════════════════════════════
// Pose, change ou retire le code court d'une ou plusieurs écoles : un mot de
// leur nom, accepté à la saisie EN PLUS du code d'origine, qui ne change
// jamais. Les codes validés se passent en arguments, jamais dans un fichier
// du dépôt (public) : les noms d'écoles sont souvent des noms de personnes.
//
// Usage :
//   node supabase/codes-courts.mjs                         → liste des écoles et de leurs codes
//   node supabase/codes-courts.mjs <code>=<court> …        → DRY-RUN : contrôle, rien n'est écrit
//   node supabase/codes-courts.mjs <code>=<court> … --appliquer
//   node supabase/codes-courts.mjs <code>= --appliquer     → retire le code court
//
// Contrôles (les mêmes que la base, qui refuserait de toute façon) : un seul
// mot, une lettre d'abord, pas un mot réservé, et aucun autre code — court
// ou d'origine, d'une autre école ou de la même liste — identique.
import { pathToFileURL } from "node:url";

const RESERVES = new Set(["superadmin", "admin", "api", "www", "demo"]);

// Même règle que normaliser_code_ecole (base) et codeEcoleSaisi (navigateur).
export const normaliserCode = (s) => String(s ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "");

// `ecoles` : [{ id, code, code_court, nom }] ; `paires` : ["code=court", …].
// Renvoie { changements: [{ ecole, avant, apres }], erreurs: [texte] }.
export function verifierCodesCourts(ecoles, paires) {
  const erreurs = [];
  const changements = [];
  const parCode = new Map(ecoles.map((e) => [e.code, e]));
  for (const paire of paires) {
    const egal = paire.indexOf("=");
    if (egal < 1) { erreurs.push(`« ${paire} » : attendu <code>=<code court>`); continue; }
    const code = normaliserCode(paire.slice(0, egal));
    const apres = normaliserCode(paire.slice(egal + 1)) || null;
    const ecole = parCode.get(code);
    if (!ecole) { erreurs.push(`« ${code} » : aucune école n'a ce code d'origine`); continue; }
    if (changements.some((c) => c.ecole.id === ecole.id)) { erreurs.push(`« ${code} » : école donnée deux fois`); continue; }
    if (apres !== null) {
      if (!/^[a-z][a-z0-9]{1,29}$/.test(apres)) { erreurs.push(`« ${apres} » : un seul mot (lettres et chiffres, une lettre d'abord, 2 à 30 signes)`); continue; }
      if (RESERVES.has(apres)) { erreurs.push(`« ${apres} » : mot réservé`); continue; }
    }
    changements.push({ ecole, avant: ecole.code_court || null, apres });
  }
  // Unicité, une fois toute la liste connue : codes courts finaux de chaque
  // école (ceux de la liste remplacent les actuels) contre tous les codes.
  const finalDe = new Map(ecoles.map((e) => [e.id, e.code_court || null]));
  for (const c of changements) finalDe.set(c.ecole.id, c.apres);
  for (const c of changements) {
    if (!c.apres) continue;
    const pris = ecoles.find((e) => e.id !== c.ecole.id && (e.code === c.apres || finalDe.get(e.id) === c.apres));
    if (pris) erreurs.push(`« ${c.apres} » : déjà le code de l'école « ${pris.code} »`);
  }
  return { changements: changements.filter((c) => c.avant !== c.apres), erreurs };
}

async function principal() {
  const args = process.argv.slice(2);
  const appliquer = args.includes("--appliquer");
  const paires = args.filter((a) => !a.startsWith("--"));
  const { createClient } = await import("@supabase/supabase-js");
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = await import("./_config.mjs");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) throw new Error("URL ou clé de service absente (supabase/config.local.mjs).");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: ecoles, error } = await sb.from("ecoles")
    .select("id, code, code_court, nom, actif, supprime, type_espace").order("created_at");
  if (error) {
    if (/code_court/.test(error.message)) throw new Error("Colonne code_court absente : la migration 20261123184655 n'est pas encore appliquée (déploiement).");
    throw new Error(error.message);
  }

  if (!paires.length) {
    for (const e of ecoles) {
      const etat = e.supprime ? " [supprimée]" : e.actif === false ? " [désactivée]" : "";
      console.log(`${e.code.padEnd(42)} ${(e.code_court || "—").padEnd(14)} ${e.nom}${etat}`);
    }
    return;
  }

  const { changements, erreurs } = verifierCodesCourts(ecoles, paires);
  for (const c of changements) console.log(`${c.ecole.code} : ${c.avant || "—"} → ${c.apres || "— (retiré)"}   (${c.ecole.nom})`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`REFUS ${e}`);
    process.exitCode = 1;
    return;
  }
  if (!changements.length) { console.log("Rien à changer."); return; }
  if (!appliquer) { console.log(`\nDRY-RUN : ${changements.length} changement(s), rien d'écrit. Relancer avec --appliquer.`); return; }

  // Une école à la fois, relue après écriture : la base a le dernier mot.
  // Les retraits d'abord : ils libèrent des mots que la liste redonne.
  const ordre = [...changements].sort((a, b) => (a.apres === null ? 0 : 1) - (b.apres === null ? 0 : 1));
  for (const c of ordre) {
    const { data, error: eMaj } = await sb.from("ecoles")
      .update({ code_court: c.apres }).eq("id", c.ecole.id).select("code_court").single();
    if (eMaj) { console.error(`ÉCHEC ${c.ecole.code} : ${eMaj.message}`); process.exitCode = 1; return; }
    console.log(`ÉCRIT ${c.ecole.code} → ${data.code_court || "—"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}
