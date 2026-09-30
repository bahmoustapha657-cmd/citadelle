// ── Photos d'élèves : hors ligne et réseau faible ───────────────────────────
// Deux défauts constatés sur le terrain (2026-09-30) :
//   • Prendre la photo d'un élève SANS RÉSEAU empêchait d'enregistrer l'élève :
//     la photo partait d'abord vers le stockage Supabase, l'envoi échouait
//     (« Erreur upload photo ») et la fiche n'était pas enregistrée. Sur réseau
//     faible, l'enregistrement restait bloqué le temps de l'envoi.
//   • Les photos déjà en ligne ne s'affichaient plus hors ligne : Supabase
//     Storage ne laisse le navigateur les garder qu'une heure (max-age=3600)
//     et le service worker ne mettait en cache que l'ancien stockage Firebase.
//
// Remède : l'URL publique d'une photo se calcule SANS réseau (chemin connu
// d'avance). La photo est rangée tout de suite dans le cache que le service
// worker sert pour ces URL (affichage immédiat, hors ligne compris) ; si
// l'envoi ne passe pas, elle attend dans une file sur l'appareil et part au
// retour du réseau (envoyerPhotosEnAttente). La fiche de l'élève, elle, est
// enregistrée aussitôt avec son URL définitive.
//
// Stockage : Cache Storage (pas localStorage : une photo pèse 100 à 400 Ko).
// ⚠️ Mêmes noms de cache que public/sw.js — à garder en phase, et SANS numéro
// de version : le service worker efface à l'activation tout cache inconnu, ce
// qui viderait la file d'attente à chaque mise à jour de l'app.
export const CACHE_PHOTOS = "edugest-photos";
export const CACHE_PHOTOS_ATTENTE = "edugest-photos-attente";

// Au-delà, l'enregistrement n'attend plus l'envoi : la photo passe en file et
// l'envoi en cours continue en arrière-plan.
export const DELAI_ENVOI_MS = 8000;
// Échecs NON réseau (session expirée, refus du stockage…) tolérés avant
// d'abandonner une photo en attente — la file ne doit pas renvoyer 300 Ko
// indéfiniment sur une connexion faible.
export const ESSAIS_MAX = 5;

const cachesDisponibles = () => typeof caches !== "undefined";

// Même critère que powersync/connector.js : réseau absent ou coupé, à
// réessayer plus tard — par opposition à un refus du serveur.
export function estErreurReseau(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err?.name === "TypeError") return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")
    || msg.includes("load failed") || msg.includes("délai");
}

function avecDelai(promesse, ms) {
  let minuteur;
  const delai = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error("timeout : délai d'envoi dépassé")), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

// Range l'image sous son URL publique : c'est ce cache que le service worker
// sert pour les photos du stockage Supabase.
async function garderLocalement(url, blob) {
  const cache = await caches.open(CACHE_PHOTOS);
  await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } }));
}

async function mettreEnAttente(url, chemin, blob, essais = 0) {
  const file = await caches.open(CACHE_PHOTOS_ATTENTE);
  await file.put(url, new Response(blob, {
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      "X-Chemin": encodeURIComponent(chemin),
      "X-Essais": String(essais),
    },
  }));
}

async function retirerDeLaFile(url) {
  try { await (await caches.open(CACHE_PHOTOS_ATTENTE)).delete(url); } catch { /* rien à retirer */ }
}

// Envoie l'image, sans jamais bloquer l'enregistrement sur le réseau.
//   envoyer : () => Promise — l'envoi réel vers le stockage ;
//   url     : son URL publique définitive (calculée sans réseau).
// Renvoie `url` dès que l'image est en sécurité sur l'appareil ; lève
// seulement sur un REFUS du serveur (comportement d'avant : l'écran l'affiche).
export async function envoyerSansAttendreLeReseau({ blob, chemin, url, envoyer, delaiMs = DELAI_ENVOI_MS }) {
  if (!cachesDisponibles()) { // navigateur sans Cache Storage : comme avant
    await envoyer();
    return url;
  }
  await garderLocalement(url, blob);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await mettreEnAttente(url, chemin, blob);
    return url;
  }
  const envoi = envoyer();
  try {
    await avecDelai(envoi, delaiMs);
    return url;
  } catch (err) {
    if (!estErreurReseau(err)) throw err;
    await mettreEnAttente(url, chemin, blob);
    // Envoi trop lent mais toujours en cours : s'il aboutit, inutile de le refaire.
    envoi.then(() => retirerDeLaFile(url), () => {});
    return url;
  }
}

// Vide la file des photos en attente, une à la fois (connexion faible).
//   envoyer  : (blob, chemin) => Promise — l'envoi vers le stockage ;
//   schoolId : code de l'école connectée — seules SES photos partent (le
//              stockage refuserait celles d'une autre école : elles attendent
//              le retour de leur compte au lieu de s'user en essais).
// Renvoie le nombre de photos envoyées.
let envoiEnCours = null;
export function envoyerPhotosEnAttente(envoyer, schoolId) {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    if (!cachesDisponibles() || !schoolId) return 0;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
    const file = await caches.open(CACHE_PHOTOS_ATTENTE);
    let envoyees = 0;
    for (const requete of await file.keys()) {
      const reponse = await file.match(requete);
      if (!reponse) continue;
      const chemin = decodeURIComponent(reponse.headers.get("X-Chemin") || "");
      if (!chemin) { await file.delete(requete); continue; }
      if (!chemin.startsWith(`${schoolId}/`)) continue;
      const blob = await reponse.blob();
      try {
        await envoyer(blob, chemin);
        await file.delete(requete);
        envoyees += 1;
      } catch (err) {
        if (estErreurReseau(err)) break; // réseau reparti : on réessaiera au prochain passage
        const essais = Number(reponse.headers.get("X-Essais") || 0) + 1;
        if (essais >= ESSAIS_MAX) {
          console.error(`[photos] envoi abandonné après ${essais} refus (${chemin}) :`, err?.message || err);
          await file.delete(requete);
        } else {
          await mettreEnAttente(requete.url, chemin, blob, essais);
        }
      }
    }
    return envoyees;
  })().finally(() => { envoiEnCours = null; });
  return envoiEnCours;
}

// Nombre de photos encore sur l'appareil, en attente d'envoi.
export async function compterPhotosEnAttente() {
  if (!cachesDisponibles()) return 0;
  try { return (await (await caches.open(CACHE_PHOTOS_ATTENTE)).keys()).length; } catch { return 0; }
}

// Connexion à ménager : l'utilisateur a demandé l'économie de données, ou le
// réseau est de type 2G. Les photos se mettront alors en cache à l'affichage.
function connexionAMenager() {
  const c = typeof navigator !== "undefined" ? navigator.connection : null;
  return !!c && (c.saveData || ["slow-2g", "2g"].includes(c.effectiveType));
}

// Télécharge à l'avance, une à la fois, les photos pas encore sur l'appareil,
// pour qu'elles s'affichent hors ligne même si elles n'ont jamais été vues ici.
// S'arrête à la première erreur réseau. Renvoie le nombre de photos ajoutées.
let prechargementEnCours = null;
export function prechargerPhotos(urls) {
  if (prechargementEnCours) return prechargementEnCours;
  prechargementEnCours = (async () => {
    if (!cachesDisponibles() || connexionAMenager()) return 0;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
    const cache = await caches.open(CACHE_PHOTOS);
    let ajoutees = 0;
    for (const url of new Set(urls)) {
      if (!/^https:\/\//.test(url) || await cache.match(url)) continue;
      try {
        const reponse = await fetch(url, { mode: "cors", credentials: "omit" });
        if (reponse.ok) { await cache.put(url, reponse); ajoutees += 1; }
      } catch {
        break;
      }
    }
    return ajoutees;
  })().finally(() => { prechargementEnCours = null; });
  return prechargementEnCours;
}
