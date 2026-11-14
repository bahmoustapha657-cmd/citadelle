// ── Outils purs de la sauvegarde complète et du remontage ──────────────────
// Partagés par sauvegarde-base.mjs (sauvegarde) et scripts/remonter-edugest.mjs
// (remontage), testés seuls (tests/sauvegarde-sql.test.js). Aucun effet de bord.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Schémas copiés tels quels : données métier (public), comptes ET mots de
// passe hachés (auth), fichiers déposés (storage, métadonnées seulement : le
// contenu des fichiers est copié à part, cf. sauvegarde-base.mjs).
export const SCHEMAS_COPIES = ["public", "auth", "storage"];

// Jamais copiées : versions internes des services (la pile d'arrivée a les
// siennes) et codes de réinitialisation éphémères (cf. sauvegarde-tables.mjs).
export const TABLES_NON_COPIEES = ["auth.schema_migrations", "storage.migrations", "public.codes_reinitialisation"];

// Adresse Postgres → la même sans mot de passe + le mot de passe à part
// (passé par PGPASSWORD : il n'apparaît ni dans la ligne de commande, ni
// dans les journaux). Une adresse mal formée lève une erreur qui ne contient
// RIEN de l'adresse : l'erreur native de `new URL` la recopie en entier,
// mot de passe compris, et finirait dans le manifeste ou à l'écran.
export function decouperUrl(url) {
  const ATTENDUE = "adresse Postgres attendue : postgresql://utilisateur:motdepasse@hôte:port/base";
  let u;
  let mdp;
  try {
    u = new URL(String(url || "").trim());
    mdp = decodeURIComponent(u.password || "");
  } catch {
    throw new Error(`adresse de la base illisible (${ATTENDUE} ; un @, : ou % du mot de passe s'écrit %40, %3A ou %25)`);
  }
  if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) throw new Error(ATTENDUE);
  u.password = "";
  return { url: u.toString(), mdp };
}

// Nombre de lignes de chaque bloc COPY d'un dump pg_dump en SQL :
// { "public.eleves": 543, "auth.users": 176, … }. Sert à vérifier, après un
// remontage, que la base d'arrivée a exactement ce que contenait la copie.
export function compterLignesCopy(texte) {
  const comptes = {};
  let courante = null;
  for (const brute of String(texte).split("\n")) {
    const ligne = brute.endsWith("\r") ? brute.slice(0, -1) : brute;
    if (courante === null) {
      const m = /^COPY "?([^".\s]+)"?\."?([^".\s(]+)"?\s/.exec(ligne);
      if (m) { courante = `${m[1]}.${m[2]}`; comptes[courante] = 0; }
    } else if (ligne === "\\.") {
      courante = null;
    } else {
      comptes[courante] += 1;
    }
  }
  return comptes;
}

// Tables à vider sur la pile d'arrivée avant d'y verser la copie : tout ce
// que la copie remplit (les migrations y ont pu semer des lignes, comme le
// compartiment « messagerie » de storage.buckets).
export const SQL_TABLES_A_VIDER = `select string_agg(format('%I.%I', schemaname, tablename), ', ' order by 1)
  from pg_tables
  where schemaname in (${SCHEMAS_COPIES.map((s) => `'${s}'`).join(", ")})
    and format('%s.%s', schemaname, tablename) not in (${TABLES_NON_COPIEES.map((t) => `'${t}'`).join(", ")})`;

// SQL versé avant la copie, dans la même transaction : déclencheurs et clés
// étrangères suspendus (l'ordre des tables de la copie n'importe plus), puis
// tables vidées.
export function preambuleRemontage(tablesAVider) {
  return [
    "SET session_replication_role = replica;",
    tablesAVider ? `TRUNCATE ${tablesAVider} CASCADE;` : "",
    "",
  ].join("\n");
}

// Sortie de `supabase status -o env` (KEY="valeur") → objet.
export function lireEnv(texte) {
  const env = {};
  for (const ligne of String(texte).split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(?:"(.*)"|(.*))$/.exec(ligne.trim());
    if (m) env[m[1]] = m[2] ?? m[3];
  }
  return env;
}

// Sauvegarde la plus récente qui contient une copie complète de la base.
export function derniereSauvegardeComplete(dossier) {
  if (!existsSync(dossier)) return null;
  const candidates = readdirSync(dossier).filter((n) => n.startsWith("backup-")).sort().reverse();
  for (const nom of candidates) {
    const dir = join(dossier, nom);
    try {
      const manifeste = JSON.parse(readFileSync(join(dir, "_manifest.json"), "utf8"));
      if (manifeste.complet && manifeste.base?.ok && existsSync(join(dir, "base", "donnees.sql"))) return dir;
    } catch { /* sauvegarde illisible : la suivante */ }
  }
  return null;
}

// Écarts entre les lignes attendues (copie) et celles trouvées (pile
// d'arrivée) : [{ table, attendu, trouve }].
export function ecartsComptes(attendus, trouves) {
  return Object.entries(attendus)
    .filter(([table, n]) => (trouves[table] ?? 0) !== n)
    .map(([table, attendu]) => ({ table, attendu, trouve: trouves[table] ?? 0 }));
}
