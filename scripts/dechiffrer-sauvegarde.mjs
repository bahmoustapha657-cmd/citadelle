// ════════════════════════════════════════════════════════════════════════
//  EduGest — Rouvrir une sauvegarde récupérée de Google Drive
// ════════════════════════════════════════════════════════════════════════
// Le jour où le PC n'est plus là : télécharger le dossier
// « EduGest-sauvegardes » de Google Drive (clic droit → Télécharger, puis
// extraire le .zip), mettre sa clé privée dans un fichier texte, puis :
//
//   node scripts/dechiffrer-sauvegarde.mjs <dossier téléchargé> --cle <fichier de la clé>
//        [--sauvegarde backup-2026-11-17-01h41]   (défaut : la plus récente)
//        [--sortie C:/Users/ADMIN/edugest-recuperation]
//
// Écrit une sauvegarde ordinaire (base/donnees.sql, _manifest.json, et le
// miroir des fichiers), prête pour :
//   node scripts/remonter-edugest.mjs --sauvegarde <sortie>/<backup-…>
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { dechiffrer, lirePrivee } from "../supabase/chiffrage-sauvegarde.mjs";
import { compterLignesCopy } from "../supabase/sauvegarde-sql.mjs";

const args = process.argv.slice(2);
const valeur = (nom, defaut) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : defaut; };
const entree = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const fichierCle = valeur("--cle", "C:/Users/ADMIN/edugest-cle-sauvegardes/CLE-PRIVEE-SAUVEGARDES.txt");
const sortie = valeur("--sortie", "C:/Users/ADMIN/edugest-recuperation");

function racineDrive(dossier) {
  for (const candidat of [dossier, join(dossier, "EduGest-sauvegardes")]) {
    if (existsSync(join(candidat, "sauvegardes"))) return candidat;
  }
  throw new Error(`pas de dossier « sauvegardes » dans ${dossier} : est-ce bien le dossier EduGest-sauvegardes téléchargé de Drive ?`);
}

function* fichiersDe(dossier) {
  if (!existsSync(dossier)) return;
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) yield* fichiersDe(chemin);
    else yield chemin;
  }
}

function main() {
  if (!entree) throw new Error("usage : node scripts/dechiffrer-sauvegarde.mjs <dossier téléchargé de Drive> --cle <fichier de la clé privée>");
  if (!existsSync(fichierCle)) throw new Error(`clé privée introuvable : ${fichierCle} (option --cle)`);
  const cle = lirePrivee(readFileSync(fichierCle, "utf8"));
  const racine = racineDrive(entree);

  const disponibles = readdirSync(join(racine, "sauvegardes")).filter((n) => n.startsWith("backup-")).sort();
  const nom = valeur("--sauvegarde", disponibles.at(-1));
  if (!nom || !disponibles.includes(nom)) throw new Error(`sauvegarde introuvable (disponibles : ${disponibles.slice(-5).join(", ") || "aucune"})`);
  console.log(`🔓 ${nom} → ${sortie}`);

  const source = join(racine, "sauvegardes", nom);
  const cible = join(sortie, nom);
  const ouvrir = (fichier) => dechiffrer(readFileSync(join(source, fichier)), cle);
  // Rien n'est écrit avant d'être sûr que la clé ouvre la copie.
  const manifeste = JSON.parse(ouvrir("_manifest.json.chiffre").toString("utf8"));
  mkdirSync(join(cible, "base"), { recursive: true });
  writeFileSync(join(cible, "_manifest.json"), JSON.stringify(manifeste, null, 2));
  for (const fichier of ["donnees.sql", "schema-public.sql"]) {
    writeFileSync(join(cible, "base", fichier), gunzipSync(ouvrir(`${fichier}.gz.chiffre`)));
  }

  // La copie rouverte doit avoir exactement les lignes annoncées par son manifeste.
  const comptes = compterLignesCopy(readFileSync(join(cible, "base", "donnees.sql"), "utf8"));
  const attendus = manifeste.base?.lignes || {};
  const ecarts = Object.keys(attendus).filter((t) => attendus[t] !== comptes[t]);
  if (ecarts.length) throw new Error(`copie incomplète : ${ecarts.slice(0, 5).join(", ")}`);
  console.log(`  ✅ base : ${Object.values(comptes).reduce((s, n) => s + n, 0)} lignes, ${comptes["auth.users"] || 0} comptes (mots de passe compris)`);

  // Fichiers déposés : tout le miroir (ils s'accumulent nuit après nuit).
  let ouverts = 0;
  let deja = 0;
  const abimes = [];
  const sourceFichiers = join(racine, "fichiers");
  for (const chemin of fichiersDe(sourceFichiers)) {
    if (!chemin.endsWith(".chiffre")) continue;
    const destination = join(sortie, "fichiers", relative(sourceFichiers, chemin).slice(0, -".chiffre".length));
    if (existsSync(destination)) { deja += 1; continue; }
    try {
      const contenu = dechiffrer(readFileSync(chemin), cle);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, contenu);
      ouverts += 1;
    } catch (e) {
      abimes.push(`${relative(sourceFichiers, chemin)} (${e.message})`);
    }
  }
  console.log(`  ✅ fichiers : ${ouverts} rouverts${deja ? `, ${deja} déjà là` : ""}${abimes.length ? `, ${abimes.length} ABÎMÉS` : ""}`);
  for (const a of abimes.slice(0, 10)) console.log(`     ⚠️  ${a}`);
  if ((manifeste.fichiers?.total || 0) > ouverts + deja) {
    console.log(`  ⚠️  ${manifeste.fichiers.total - ouverts - deja} fichier(s) annoncés manquent : le téléchargement de Drive est-il complet ?`);
  }

  console.log(`\n👉 Pour remonter l'école :\n   node scripts/remonter-edugest.mjs --sauvegarde "${cible}"`);
  if (abimes.length) process.exitCode = 1;
}

try {
  main();
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
