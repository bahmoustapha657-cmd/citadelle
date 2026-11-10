// ── Envoi immédiat et brouillons ────────────────────────────────────────────
// Sur réseau faible, un message n'apparaissait qu'après la réponse du serveur
// et la saisie restait bloquée pendant ce temps. Il s'affiche désormais tout
// de suite (`envoi: "en_cours"`), avec l'identifiant qu'il gardera en base :
// la ligne du serveur, reçue par la réponse ou par le temps réel, remplace la
// provisoire sans doublon, et un nouvel essai ne crée jamais deux messages.
// Module sans dépendance, testé sous Node : tests/messagerie-envoi-local.test.js.

const uuid = (env) => env.crypto?.randomUUID?.()
  // Navigateur ancien : même forme, tirage ordinaire.
  || "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

// Message texte affiché avant la réponse du serveur. Daté après le dernier
// message du fil : une horloge d'appareil en retard ne le range pas plus haut.
export function messageProvisoire({ convId, moi, corps, reponseA = null, dernier = null, maintenant = Date.now(), env = globalThis }) {
  const apres = dernier ? Date.parse(dernier) + 1 : 0;
  return {
    id: uuid(env), conversation_id: convId, de_compte_id: moi, type: "texte",
    corps: String(corps || "").trim().slice(0, 4000), reponse_a: reponseA,
    created_at: new Date(Math.max(maintenant, apres || 0)).toISOString(),
    supprime: false, modifie_at: null, envoi: "en_cours",
  };
}

export const enEnvoi = (message) => message?.envoi === "en_cours";
export const envoiEchoue = (message) => message?.envoi === "echec";
// Pas encore en base : ni réponse, ni correction, ni suppression possibles.
export const estProvisoire = (message) => !!message?.envoi;

// Ajoute des messages à un fil, sans doublon. La version du serveur remplace
// la provisoire de même identifiant ; l'inverse jamais.
export function fusionnerFil(actuels, ajoutes, { enTete = false } = {}) {
  const parId = new Map(actuels.map((m) => [m.id, m]));
  const nouveaux = [];
  let remplace = false;
  for (const m of ajoutes) {
    const connu = parId.get(m.id);
    if (!connu) { nouveaux.push(m); parId.set(m.id, m); } else if (connu.envoi && !m.envoi) { parId.set(m.id, m); remplace = true; }
  }
  const base = remplace ? actuels.map((m) => parId.get(m.id)) : actuels;
  const messages = enTete ? [...nouveaux, ...base] : [...base, ...nouveaux];
  return messages.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

// Messages restés « non envoyés » dans tous les fils (relance au retour du réseau).
export const messagesEchoues = (fils) => Object.values(fils || {})
  .flatMap((f) => (f?.messages || []).filter(envoiEchoue));

// ── Brouillons : le texte commencé dans une discussion y attend ─────────────
// Gardés sur l'appareil, par compte : jamais envoyés au serveur.
const BROUILLONS_MAX = 40;
const cleBrouillons = (moi) => `LC_msg_brouillons_${moi}`;

function lireTous(moi, env) {
  try {
    const brut = JSON.parse(env.localStorage?.getItem(cleBrouillons(moi)) || "{}");
    return brut && typeof brut === "object" && !Array.isArray(brut) ? brut : {};
  } catch { return {}; }
}

export function lireBrouillon(moi, convId, env = globalThis) {
  if (!moi || !convId) return "";
  const texte = lireTous(moi, env)[convId];
  return typeof texte === "string" ? texte : "";
}

// Texte vide : le brouillon disparaît. Au-delà de la limite, les plus anciens
// partent d'abord.
export function ecrireBrouillon(moi, convId, texte, env = globalThis) {
  if (!moi || !convId) return;
  try {
    const tous = lireTous(moi, env);
    delete tous[convId];
    if (String(texte || "").trim()) tous[convId] = String(texte).slice(0, 4000);
    const gardes = Object.entries(tous).slice(-BROUILLONS_MAX);
    if (gardes.length) env.localStorage?.setItem(cleBrouillons(moi), JSON.stringify(Object.fromEntries(gardes)));
    else env.localStorage?.removeItem(cleBrouillons(moi));
  } catch { /* stockage refusé : pas de brouillon, la saisie continue */ }
}
