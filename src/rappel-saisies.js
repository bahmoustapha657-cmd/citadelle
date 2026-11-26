// ── Rappel des saisies restées sur l'appareil, EduGest fermé ─────────────────
// Les saisies faites sans réseau (file PowerSync, photos d'élèves, saisies
// mises de côté) ne partent que pendant qu'EduGest est ouvert : rien ne les
// envoie application fermée. Pour qu'elles ne restent pas oubliées, la page
// demande au navigateur de réveiller le service worker au retour du réseau
// (Background Sync : Chrome, Edge, application Android — ni Safari ni
// Firefox) ; il affiche alors une notification qui dit de rouvrir EduGest
// (rappelerSaisies, public/sw.js). Le service worker n'envoie rien lui-même :
// l'envoi reste celui de la page, avec la session et les règles habituelles.
//
// Le service worker ne voit ni la base locale ni la session : la page lui
// laisse dans Cache Storage le nombre de saisies en attente et le texte,
// traduit, de la notification.
// ⚠️ Mêmes noms que public/sw.js — à garder en phase, et SANS numéro de
// version : le service worker efface à l'activation tout cache inconnu.
export const CACHE_RAPPEL = "edugest-rappel";
export const CLE_ATTENTE = "/__rappel-saisies";
export const TAG_RAPPEL = "rappel-saisies";

// En ligne, application passée en arrière-plan : une demande au plus par
// intervalle, le navigateur réveillant aussitôt le service worker.
export const RELANCE_MS = 2 * 60 * 1000;

const environnementNavigateur = () => ({
  navigator: typeof navigator !== "undefined" ? navigator : undefined,
  document: typeof document !== "undefined" ? document : undefined,
  caches: typeof caches !== "undefined" ? caches : undefined,
  Notification: typeof Notification !== "undefined" ? Notification : undefined,
  maintenant: () => Date.now(),
});

// `env` : navigateur réel par défaut ; les tests passent le leur.
export function creerRappelSaisies(env = environnementNavigateur()) {
  let memorise = null;  // dernier contenu laissé au service worker
  let demande = { motif: "", quand: 0 };
  let dernierNombre = null;

  const enregistrement = async () => {
    const sw = env.navigator?.serviceWorker;
    if (!sw?.getRegistration) return null;
    return (await sw.getRegistration().catch(() => null)) || null;
  };

  async function memoriser(n, textes) {
    if (!env.caches) return;
    const contenu = JSON.stringify({ n, titre: textes?.titre || "", corps: textes?.corps || "" });
    if (contenu === memorise) return;
    memorise = contenu;
    try {
      const cache = await env.caches.open(CACHE_RAPPEL);
      await cache.put(CLE_ATTENTE, new Response(contenu, { headers: { "Content-Type": "application/json" } }));
    } catch {
      memorise = null; // réessayé au prochain passage
    }
  }

  async function demanderRappel() {
    const reg = await enregistrement();
    if (!reg?.sync?.register) return false; // Safari, Firefox : pas de rappel
    try {
      await reg.sync.register(TAG_RAPPEL);
      return true;
    } catch {
      return false; // synchronisation en arrière-plan bloquée pour ce site
    }
  }

  // Tout est parti : le rappel déjà affiché n'a plus lieu d'être.
  async function retirerRappel() {
    const reg = await enregistrement();
    if (!reg?.getNotifications) return;
    try {
      const affichees = await reg.getNotifications({ tag: TAG_RAPPEL });
      affichees.forEach((n) => n.close());
    } catch { /* rien d'affiché */ }
  }

  // Appelé à chaque nouveau compte des saisies en attente. Renvoie le motif
  // de la demande de rappel faite, ou "".
  async function suivre(n, textes) {
    const nombre = Math.max(0, Number(n) || 0);
    const precedent = dernierNombre;
    dernierNombre = nombre;
    await memoriser(nombre, textes);
    if (!nombre) {
      demande = { motif: "", quand: 0 };
      // Premier compte de cette ouverture compris : EduGest a pu être rouvert
      // sans toucher la notification.
      if (precedent !== 0) await retirerRappel();
      return "";
    }
    // Sans permission, le service worker ne pourrait rien afficher.
    if (env.Notification?.permission !== "granted") return "";
    const horsLigne = env.navigator?.onLine === false;
    const cachee = env.document?.visibilityState === "hidden";
    if (!horsLigne && !cachee) {
      demande = { ...demande, motif: "" };
      return "";
    }
    // Hors ligne : une demande suffit, le navigateur la garde jusqu'au retour
    // du réseau. En ligne et en arrière-plan : à intervalle, car chaque
    // demande réveille aussitôt le service worker.
    const motif = horsLigne ? "hors-ligne" : "arriere-plan";
    const maintenant = env.maintenant();
    if (motif === demande.motif && (motif === "hors-ligne" || maintenant - demande.quand < RELANCE_MS)) return "";
    if (!(await demanderRappel())) return "";
    demande = { motif, quand: maintenant };
    return motif;
  }

  return { suivre };
}

let parDefaut = null;
export function suivreSaisiesEnAttente(n, textes) {
  parDefaut ??= creerRappelSaisies();
  return parDefaut.suivre(n, textes);
}
