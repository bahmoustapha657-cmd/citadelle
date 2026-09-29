// ── Bootstrap PowerSync (singleton, paresseux) ──────────────────────────────
// Même esprit que supabaseClient.js : instance unique créée à la demande.
// Si VITE_POWERSYNC_URL est vide (instance PowerSync Cloud pas encore créée),
// le hors-ligne reste simplement désactivé — le reste de l'app Supabase
// continue de fonctionner normalement (comportement actuel inchangé).
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./schema";
import { SupabaseConnector } from "./connector";
import { attendreFileVide } from "./file-envoi";
import { powerSyncConfigured } from "./tables";
import { ecrireProprietaire, miroirAutreCompte, oublierProprietaire } from "./proprietaire";

export { powerSyncConfigured };

let db = null;
export function getPowerSync() {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: "edugest.sqlite" },
    });
  }
  return db;
}

// Purge, ouverture et fermeture s'exécutent dans l'ordre d'appel : une
// déconnexion suivie d'une connexion rapprochées (changement de compte) ne
// doivent jamais se croiser — la purge du miroir de l'ancien compte doit
// être finie avant que le suivant ne s'y connecte.
let enchainement = Promise.resolve();
function enFile(tache) {
  const etape = enchainement.then(tache, tache);
  enchainement = etape.catch(() => {});
  return etape;
}

let connecte = null; // uid du compte dont la synchro est ouverte

// Ouvre la synchro pour le compte `uid`. Le miroir est gardé d'une session à
// l'autre (cf. proprietaire.js) : on ne le vide que s'il appartient à un
// autre compte. La connexion réseau elle-même n'est pas attendue — PowerSync
// réessaie seul tant que le réseau manque, sans bloquer la file.
export function connectPowerSync(uid) {
  if (!powerSyncConfigured) return Promise.resolve();
  return enFile(async () => {
    if (connecte && connecte === uid) return;
    const ps = getPowerSync();
    if (miroirAutreCompte(uid)) await ps.disconnectAndClear();
    ecrireProprietaire(uid);
    connecte = uid;
    ps.connect(new SupabaseConnector()).catch((err) => {
      if (connecte === uid) connecte = null;
      console.warn("[powersync] connexion échouée :", err?.message || err);
    });
  }).catch((err) => {
    connecte = null;
    console.warn("[powersync] ouverture du miroir :", err?.message || err);
  });
}

// Attend que les écritures locales soient remontées à Supabase (file d'envoi
// vide), pour une opération serveur qui doit les voir aussitôt — rattacher
// à un compte parent des élèves tout juste inscrits. En ligne, la file se
// vide en une ou deux secondes (connector.js abandonne les écritures
// refusées au lieu de la bloquer). Renvoie false si elle n'est toujours pas
// vide au bout de `delaiMs` (hors ligne) : l'appelant tente quand même et
// affiche l'erreur du serveur.
export const attendreRemontee = (delaiMs = 15000) =>
  attendreFileVide(() => getPowerSync().getUploadQueueStats(), delaiMs);

// Appelé à la déconnexion : coupe la synchro mais GARDE le miroir et la file
// d'envoi. Au retour du même compte, seuls les changements voyagent, et les
// saisies hors ligne pas encore envoyées partent à la reconnexion au lieu
// d'être perdues (elles étaient effacées avec le miroir jusqu'ici). Un autre
// compte qui se connecte ensuite déclenche la purge (effacerMiroir).
export function disconnectPowerSync() {
  if (!db) return Promise.resolve();
  return enFile(async () => {
    connecte = null;
    await db.disconnect();
  }).catch((err) => {
    console.warn("[powersync] déconnexion :", err?.message || err);
  });
}

// Vide le miroir (données + file d'envoi) : un autre compte va ouvrir l'app
// sur cet appareil et ne doit pas y trouver les données du précédent.
export function effacerMiroir() {
  return enFile(async () => {
    connecte = null;
    await getPowerSync().disconnectAndClear();
    oublierProprietaire();
  });
}

// Changements du miroir local sur ces tables : données livrées par la
// synchro (première synchro après connexion, saisies d'un autre poste) ou
// écriture locale. Renvoie la fonction d'arrêt.
export function ecouterTables(tables, rappel) {
  return getPowerSync().onChange({ onChange: () => rappel() }, { tables, throttleMs: 500 });
}
