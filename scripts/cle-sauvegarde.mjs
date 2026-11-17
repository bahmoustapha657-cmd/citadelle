// ════════════════════════════════════════════════════════════════════════
//  EduGest — Clé des sauvegardes hors du PC
// ════════════════════════════════════════════════════════════════════════
// Crée une paire de clés pour les copies chiffrées rangées dans Google Drive :
//   • la clé PRIVÉE va dans un fichier à part (jamais affichée, jamais
//     écrasée) : à recopier en lieu sûr, elle seule ouvre les copies ;
//   • la clé PUBLIQUE s'ajoute à supabase/cles-sauvegarde.txt (sans danger,
//     versionnée) : la sauvegarde de la nuit chiffre pour elle.
//
//   node scripts/cle-sauvegarde.mjs [--libelle "clé principale"]
//        [--dossier C:/Users/ADMIN/edugest-cle-sauvegardes]
//   node scripts/cle-sauvegarde.mjs --verifier <fichier de la clé>
//        (une recopie, papier retapé ou gestionnaire de mots de passe,
//         est-elle juste ?)
//
// Un suppléant : relancer avec --libelle "suppléant" --dossier <son dossier>,
// fusionner, puis lui remettre son fichier. Il ouvre les copies faites ensuite.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ecrirePublique, genererCles, lirePrivee, priveeParGroupes, publiqueDe,
} from "../supabase/chiffrage-sauvegarde.mjs";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const FICHIER_PUBLIQUES = join(RACINE, "supabase", "cles-sauvegarde.txt");
const args = process.argv.slice(2);
const valeur = (nom, defaut) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : defaut; };

const ENTETE_PUBLIQUES = `# Clés PUBLIQUES des sauvegardes hors du PC (.github/workflows/sauvegarde-hors-pc.yml).
# Sans danger : elles ferment les copies, elles ne savent pas les ouvrir.
# Une clé par ligne, suivie d'un libellé (jamais un nom de personne : dépôt public).
# Le détenteur de la clé PRIVÉE correspondante ouvre les copies faites après
# l'ajout de sa ligne. Ajouter : node scripts/cle-sauvegarde.mjs --libelle "…"
# Retirer : supprimer la ligne (les copies déjà faites restent ouvrables par elle).
`;

function lignesPubliques() {
  return existsSync(FICHIER_PUBLIQUES) ? readFileSync(FICHIER_PUBLIQUES, "utf8").split(/\r?\n/) : [];
}

function verifier(fichier) {
  if (!existsSync(fichier)) throw new Error(`fichier introuvable : ${fichier}`);
  const publique = ecrirePublique(publiqueDe(lirePrivee(readFileSync(fichier, "utf8"))));
  const ligne = lignesPubliques().map((l) => l.replace(/#.*/, "").trim()).find((l) => l.split(/\s+/)[0] === publique);
  if (!ligne) throw new Error("clé lisible, mais elle n'est PAS dans supabase/cles-sauvegarde.txt : elle n'ouvre pas les sauvegardes");
  console.log(`✅ Clé juste : elle ouvre les sauvegardes (${ligne.slice(publique.length).trim() || "sans libellé"}).`);
}

function creer() {
  const libelle = valeur("--libelle", "clé principale").replace(/[\r\n#]/g, " ").trim();
  const dossier = valeur("--dossier", "C:/Users/ADMIN/edugest-cle-sauvegardes");
  const fichier = join(dossier, "CLE-PRIVEE-SAUVEGARDES.txt");
  if (existsSync(fichier)) {
    throw new Error(`une clé existe déjà dans ${fichier} : elle n'est jamais écrasée. Pour une clé de plus (suppléant) : --dossier <autre dossier>.`);
  }
  const { privee, publique } = genererCles();
  const ligne = ecrirePublique(publique);
  mkdirSync(dossier, { recursive: true });
  const contenu = `# ══════════════════════════════════════════════════════════════════
#  CLÉ PRIVÉE DES SAUVEGARDES EDUGEST (${libelle})
# ══════════════════════════════════════════════════════════════════
# Elle seule ouvre les copies rangées chaque nuit dans Google Drive.
#   • NE JAMAIS la donner, ni l'envoyer (WhatsApp, e-mail…), ni la mettre
#     en ligne (Drive, GitHub…).
#   • En garder 3 copies : gestionnaire de mots de passe, papier rangé en
#     lieu sûr, disque externe.
#   • Perdue = copies de Drive illisibles pour toujours (Google lui-même ne
#     peut pas les ouvrir).
# Sur papier : recopier les 4 lignes du bas telles quelles. Vérifier une
# recopie : node scripts/cle-sauvegarde.mjs --verifier <fichier>
# Créée le ${new Date().toISOString().slice(0, 10)}. Clé publique correspondante :
#   ${ligne}

${priveeParGroupes(privee)}
`;
  // « wx » : échoue plutôt que d'écraser, même en cas de course.
  writeFileSync(fichier, contenu, { flag: "wx", mode: 0o600 });
  if (!lirePrivee(readFileSync(fichier, "utf8")).equals(privee)) throw new Error("relecture de la clé écrite en échec");

  const existant = lignesPubliques();
  if (!existant.some((l) => l.trim())) writeFileSync(FICHIER_PUBLIQUES, ENTETE_PUBLIQUES);
  else if (existant.at(-1) !== "") appendFileSync(FICHIER_PUBLIQUES, "\n");
  appendFileSync(FICHIER_PUBLIQUES, `${ligne}  ${libelle}\n`);

  console.log(`🔑 Clé privée écrite (NON affichée) : ${fichier}`);
  console.log(`🔓 Clé publique ajoutée à supabase/cles-sauvegarde.txt (${libelle}) :\n   ${ligne}`);
  console.log("\n👉 Recopier la clé privée en lieu sûr (gestionnaire de mots de passe, papier, disque externe),");
  console.log("   puis vérifier chaque recopie : node scripts/cle-sauvegarde.mjs --verifier <fichier>");
}

try {
  const aVerifier = valeur("--verifier");
  if (aVerifier) verifier(aVerifier);
  else creer();
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
