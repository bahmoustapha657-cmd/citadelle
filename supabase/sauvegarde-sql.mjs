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
// tables vidées (sans les avis « truncate cascades to … », attendus).
export function preambuleRemontage(tablesAVider) {
  return [
    "SET session_replication_role = replica;",
    "SET client_min_messages = warning;",
    tablesAVider ? `TRUNCATE ${tablesAVider} CASCADE;` : "",
    "",
  ].join("\n");
}

// Requêtes du schéma de la base d'arrivée, pour adapterCopie.
export const SQL_COLONNES_LOCALES = `select table_schema || '.' || table_name, column_name
  from information_schema.columns
  where table_schema in (${SCHEMAS_COPIES.map((s) => `'${s}'`).join(", ")})
  order by 1, ordinal_position`;
export const SQL_SEQUENCES_LOCALES = `select schemaname || '.' || sequencename from pg_sequences
  where schemaname in (${SCHEMAS_COPIES.map((s) => `'${s}'`).join(", ")})`;

// Adapte la copie (texte de pg_dump) au schéma de la base d'arrivée.
// Les tables internes de Supabase (auth, storage) changent d'une version à
// l'autre : la production peut en avoir que la pile locale ignore encore
// (storage.bucket_lifecycle_states, constaté au premier exercice). Pour
// celles-là, une table absente est sautée et une colonne absente retirée,
// et le bilan le dit. Les tables de l'école (public), elles, sont rebâties
// par les migrations du dépôt : le moindre écart y est une erreur.
// `colonnesLocales` : { "schema.table": [colonnes] } ; `sequencesLocales` :
// ["schema.sequence"].
export function adapterCopie(texte, colonnesLocales, sequencesLocales = []) {
  const sortie = [];
  const ignorees = {};
  const colonnesRetirees = {};
  let bloc = null;
  for (const brute of String(texte).split("\n")) {
    const cr = brute.endsWith("\r") ? "\r" : "";
    const ligne = cr ? brute.slice(0, -1) : brute;
    if (bloc) {
      if (ligne === "\\.") {
        if (!bloc.ignorer) sortie.push(brute);
        bloc = null;
      } else if (bloc.ignorer) {
        ignorees[bloc.table] += 1;
      } else if (bloc.garder) {
        // Format texte de COPY : une tabulation DANS une valeur s'écrit \t,
        // donc chaque tabulation réelle sépare deux colonnes.
        const champs = ligne.split("\t");
        sortie.push(bloc.garder.map((i) => champs[i]).join("\t") + cr);
      } else {
        sortie.push(brute);
      }
      continue;
    }
    const copie = /^COPY "([^"]+)"\."([^"]+)" \(([^)]*)\) FROM stdin;$/.exec(ligne);
    if (copie) {
      const [, schema, nom, liste] = copie;
      const table = `${schema}.${nom}`;
      const colonnes = liste.split(", ").map((c) => c.replace(/^"|"$/g, ""));
      const locales = colonnesLocales[table];
      if (!locales) {
        if (schema === "public") throw new Error(`table ${table} absente de la base d'arrivée (migrations du dépôt en retard ?)`);
        ignorees[table] = 0;
        bloc = { table, ignorer: true };
        continue;
      }
      const absentes = colonnes.filter((c) => !locales.includes(c));
      if (absentes.length && schema === "public") {
        throw new Error(`colonnes ${absentes.join(", ")} de ${table} absentes de la base d'arrivée (migrations du dépôt en retard ?)`);
      }
      if (absentes.length) {
        colonnesRetirees[table] = absentes;
        const garder = colonnes.map((c, i) => [c, i]).filter(([c]) => locales.includes(c));
        sortie.push(`COPY "${schema}"."${nom}" (${garder.map(([c]) => `"${c}"`).join(", ")}) FROM stdin;${cr}`);
        bloc = { table, garder: garder.map(([, i]) => i) };
        continue;
      }
      sortie.push(brute);
      bloc = { table };
      continue;
    }
    const sequence = /^SELECT pg_catalog\.setval\('"([^"]+)"\."([^"]+)"'/.exec(ligne);
    if (sequence && !sequencesLocales.includes(`${sequence[1]}.${sequence[2]}`)) {
      if (sequence[1] === "public") throw new Error(`séquence ${sequence[1]}.${sequence[2]} absente de la base d'arrivée`);
      continue;
    }
    sortie.push(brute);
  }
  return { texte: sortie.join("\n"), ignorees, colonnesRetirees };
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
