// ── Retours terrain : logique pure ──────────────────────────────────────────
// Une école signale un problème, propose une idée, pose une question ou dit
// ce qui marche ; EduGest (superadmin) lit, classe et répond. Ici : genres,
// validation, contexte joint automatiquement à l'envoi, filtres et messages
// d'erreur. Module sans effet de bord (testé dans tests/retours-terrain.test.js).
// La table et ses règles : supabase/migrations/20261119185253_retours_terrain.sql.

// Mêmes valeurs que le check SQL `genre in (...)`. Libellés : feedback.genres.*
export const GENRES = [
  { id: "probleme", icone: "🐞" },
  { id: "idee", icone: "💡" },
  { id: "question", icone: "❓" },
  { id: "bravo", icone: "👏" },
];

// Mêmes valeurs que le check SQL `statut in (...)`. Libellés : feedback.statuts.*
export const STATUTS = ["nouveau", "lu", "traite"];

// Bornes du check SQL `char_length(btrim(message)) between 3 and 2000`.
export const MESSAGE_MIN = 3;
export const MESSAGE_MAX = 2000;
export const REPONSE_MAX = 2000;
// Le contexte (jsonb) est limité à 2000 caractères en base : on reste loin
// en dessous en coupant chaque valeur.
const VALEUR_MAX = 160;

export const genreDe = (id) => GENRES.find((g) => g.id === id) || null;

// Clé de traduction de l'erreur à afficher, ou null si le retour peut partir.
export function verifierRetour({ genre, message } = {}) {
  if (!genreDe(genre)) return "feedback.errors.genre";
  const n = String(message || "").trim().length;
  if (n < MESSAGE_MIN) return "feedback.errors.tooShort";
  if (n > MESSAGE_MAX) return "feedback.errors.tooLong";
  return null;
}

// « Android · Chrome », « iPhone · Safari », « Windows · Edge »… : de quoi
// reproduire un problème sans garder toute la signature du navigateur.
export function appareilCourt(ua = "") {
  const s = String(ua);
  const systeme =
    /iPhone|iPad|iPod/i.test(s) ? (/iPad/i.test(s) ? "iPad" : "iPhone")
      : /Android/i.test(s) ? "Android"
        : /Windows/i.test(s) ? "Windows"
          : /Mac OS X|Macintosh/i.test(s) ? "Mac"
            : /CrOS/i.test(s) ? "ChromeOS"
              : /Linux/i.test(s) ? "Linux"
                : "";
  const navigateur =
    /EdgA?\//.test(s) ? "Edge"
      : /SamsungBrowser\//.test(s) ? "Samsung Internet"
        : /OPR\/|Opera/.test(s) ? "Opera"
          : /Firefox\/|FxiOS\//.test(s) ? "Firefox"
            : /Chrome\/|CriOS\//.test(s) ? "Chrome"
              : /Safari\//.test(s) ? "Safari"
                : "";
  return [systeme, navigateur].filter(Boolean).join(" · ");
}

const couper = (v) => (typeof v === "string" ? v.slice(0, VALEUR_MAX) : v);

// Contexte joint à l'envoi : écran ouvert, version de l'app, langue, état du
// réseau, taille d'écran, appareil, application installée ou non. Les valeurs
// vides sont omises ; rien de personnel (ni nom, ni école : la base les
// ajoute elle-même depuis le compte connecté).
export function contexteRetour({ ecran, version, langue, enLigne, largeur, hauteur, userAgent, installee } = {}) {
  const c = {
    ecran: couper(ecran || ""),
    version: couper(version || ""),
    langue: couper(langue || ""),
    enLigne: typeof enLigne === "boolean" ? enLigne : undefined,
    taille: largeur && hauteur ? `${Math.round(largeur)}x${Math.round(hauteur)}` : "",
    appareil: couper(appareilCourt(userAgent)),
    installee: typeof installee === "boolean" ? installee : undefined,
  };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "" && v !== undefined));
}

// Ligne lisible du contexte pour le panneau super-admin.
export function resumeContexte(contexte = {}) {
  const c = contexte && typeof contexte === "object" ? contexte : {};
  return [c.ecran, c.version && `v ${c.version}`, c.langue, c.appareil, c.taille]
    .filter(Boolean).join(" · ");
}

// Clé de traduction d'une erreur d'envoi. Réseau coupé = on garde le texte.
export function cleErreurEnvoi(err) {
  const msg = String(err?.message || err || "");
  if (err?.code === "P0001" || /Trop de retours/i.test(msg)) return "feedback.errors.tooMany";
  if (err?.code === "42501") return "feedback.errors.account";
  if (err?.name === "TypeError" || /Failed to fetch|NetworkError|network|fetch failed|Load failed/i.test(msg)) {
    return "feedback.errors.network";
  }
  return "feedback.errors.generic";
}

export const compterNouveaux = (retours = []) => retours.filter((r) => r.statut === "nouveau").length;

const sansAccents = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Filtre du panneau super-admin : statut, genre (« » = tous) et recherche
// libre dans le message, l'école, l'auteur et la réponse.
export function filtrerRetours(retours = [], { statut = "", genre = "", q = "" } = {}) {
  const nq = sansAccents(q.trim());
  return retours.filter((r) =>
    (!statut || r.statut === statut)
    && (!genre || r.genre === genre)
    && (!nq || sansAccents(`${r.message} ${r.ecoleNom} ${r.ecoleCode} ${r.auteur} ${r.role} ${r.reponse || ""}`).includes(nq)));
}

// Ce qu'enregistre le super-admin : la date de réponse ne bouge que si la
// réponse change (une simple relecture ne la réécrit pas).
export function modificationRetour(retour, { statut, reponse }, maintenant = new Date()) {
  const texte = String(reponse ?? "").trim();
  const avant = String(retour?.reponse ?? "").trim();
  const champs = { statut: STATUTS.includes(statut) ? statut : retour?.statut || "nouveau" };
  if (texte !== avant) {
    champs.reponse = texte || null;
    champs.repondu_le = texte ? maintenant.toISOString() : null;
  }
  return champs;
}
