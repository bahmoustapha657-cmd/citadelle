// Prépare une seule fois les clés de l'application Android, à lancer par le
// propriétaire du projet, sur son poste (gh et la CLI Supabase déjà connectés) :
//
//   node scripts/preparer-android.mjs [google-services.json] [cle-compte-service.json]
//
// Sans argument, les deux fichiers sont cherchés dans le dossier Téléchargements.
// Crée la clé de signature, puis pose les secrets GitHub et Supabase. Aucune
// valeur secrète n'est affichée. Procédure : docs/application-android.md.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEPOT = "bahmoustapha657-cmd/citadelle";
const PROJET_SUPABASE = "pfzanslrcowkjjipuzpa";
const PAQUET = "com.edugest.app";
const ALIAS = "edugest";

// Renvoie l'identifiant du projet Firebase, ou s'arrête sur un fichier erroné.
export function verifierGoogleServices(texte) {
  const config = JSON.parse(texte);
  const paquets = (config.client || []).map((c) => c.client_info?.android_client_info?.package_name);
  if (!paquets.includes(PAQUET)) {
    throw new Error(`google-services.json ne contient pas l'application ${PAQUET}. Ajoutez-la dans Firebase, puis téléchargez-le à nouveau.`);
  }
  return config.project_info.project_id;
}

export function verifierCompteService(texte, projet) {
  const compte = JSON.parse(texte);
  if (compte.type !== "service_account" || !compte.private_key || !compte.client_email) {
    throw new Error("Ce fichier n'est pas une clé de compte de service Firebase.");
  }
  if (compte.project_id !== projet) {
    throw new Error(`La clé vient du projet ${compte.project_id}, pas de ${projet}.`);
  }
}

// Une seule ligne, entre apostrophes : les \n de la clé privée restent tels quels.
export const ligneEnv = (texte) => `FCM_SERVICE_ACCOUNT='${JSON.stringify(JSON.parse(texte))}'\n`;

function plusRecent(dossier, motif) {
  const trouves = readdirSync(dossier).filter((f) => motif.test(f)).map((f) => join(dossier, f));
  return trouves.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function executer(commande, args, options = {}) {
  const resultat = spawnSync(commande, args, { encoding: "utf8", ...options });
  if (resultat.status !== 0) throw new Error(`${commande} a échoué : ${(resultat.stderr || resultat.error || "").toString().trim()}`);
  return resultat.stdout;
}

const secretGitHub = (nom, valeur) => executer("gh", ["secret", "set", nom, "--repo", DEPOT], { input: valeur });

// La clé de signature ne se remplace pas : perdue, plus aucune mise à jour.
function cleSignature() {
  const dossier = join(homedir(), "edugest-android");
  const keystore = join(dossier, "edugest.keystore");
  const fichierMotDePasse = join(dossier, "mot-de-passe.txt");
  mkdirSync(dossier, { recursive: true });
  if (!existsSync(keystore)) {
    const motDePasse = randomBytes(24).toString("hex");
    executer("keytool", [
      "-genkeypair", "-keystore", keystore, "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
      "-storepass", motDePasse, "-keypass", motDePasse, "-dname", "CN=EduGest, O=EduGest, C=GN",
    ]);
    writeFileSync(fichierMotDePasse, motDePasse);
  }
  return { dossier, keystore, motDePasse: readFileSync(fichierMotDePasse, "utf8").trim() };
}

function principal() {
  const telechargements = join(homedir(), "Downloads");
  const cheminServices = process.argv[2] || join(telechargements, "google-services.json");
  const cheminCompte = process.argv[3] || plusRecent(telechargements, /firebase-adminsdk.*\.json$/);
  if (!existsSync(cheminServices)) throw new Error(`Fichier introuvable : ${cheminServices}`);
  if (!cheminCompte || !existsSync(cheminCompte)) throw new Error("Clé de compte de service introuvable dans Téléchargements.");

  const services = readFileSync(cheminServices, "utf8");
  const compte = readFileSync(cheminCompte, "utf8");
  verifierCompteService(compte, verifierGoogleServices(services));
  console.log("✓ Fichiers Firebase vérifiés");

  const { dossier, keystore, motDePasse } = cleSignature();
  console.log(`✓ Clé de signature prête : ${dossier}`);

  secretGitHub("GOOGLE_SERVICES_JSON", services);
  secretGitHub("ANDROID_KEYSTORE_BASE64", readFileSync(keystore).toString("base64"));
  secretGitHub("ANDROID_KEYSTORE_PASSWORD", motDePasse);
  secretGitHub("ANDROID_KEY_ALIAS", ALIAS);
  console.log("✓ Secrets GitHub posés");

  const temporaire = mkdtempSync(join(tmpdir(), "edugest-"));
  try {
    const fichierEnv = join(temporaire, "fcm.env");
    writeFileSync(fichierEnv, ligneEnv(compte));
    executer("npx", ["--yes", "supabase@2.120.0", "secrets", "set", "--env-file", fichierEnv, "--project-ref", PROJET_SUPABASE], { shell: true });
  } finally {
    rmSync(temporaire, { recursive: true, force: true });
  }
  console.log("✓ Secret Supabase posé");

  console.log(`\nTerminé. À faire maintenant :
  1. Sauvegardez le dossier ${dossier} (clé USB, Drive privé) : sans lui, plus de mise à jour possible.
  2. Supprimez la clé téléchargée : ${cheminCompte}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  }
}
