// ── Relais de secours des appels : logique audio pure ───────────────────────
// Quand ni la connexion directe ni le relais TURN ne passent, la voix transite
// par le canal privé Supabase de l'appel. Format simple, compris partout et
// sans dépendance : 8 kHz, IMA ADPCM 4 bits (32 kbit/s), paquets de 200 ms qui
// se lisent seuls (l'en-tête porte l'état du décodeur) : un paquet perdu
// n'abîme pas les suivants. Rien n'est envoyé pendant les silences, ce qui
// économise les données mobiles et le quota de messages Realtime. La voix est
// chiffrée juste après, cf. relais-chiffrement.js.

export const TAUX_RELAIS = 8000;
export const ECHANTILLONS_PAR_PAQUET = 1600;
const DUREE_PAQUET_S = ECHANTILLONS_PAR_PAQUET / TAUX_RELAIS;

// Niveau efficace (échantillons 16 bits) au-dessus duquel on considère que
// quelqu'un parle ; volontairement bas : mieux vaut un souffle qu'un mot coupé.
export const SEUIL_PAROLE = 160;
// Paquets encore envoyés après la parole (fin de phrase, 400 ms).
const PAQUETS_APRES_PAROLE = 2;

// Tampon de lecture : absorbe l'irrégularité du réseau (le paquet envoyé avant
// chaque phrase y ajoute 200 ms).
export const AVANCE_LECTURE_S = 0.2;
// Au-delà de ce retard, on jette pour rattraper le direct.
export const RETARD_MAX_S = 1.2;

const INDICES = [-1, -1, -1, -1, 2, 4, 6, 8];
const PAS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97,
  107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
  876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871,
  5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623,
  27086, 29794, 32767,
];

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const ENTETE = 3; // prédicteur (16 bits) + index

// Une étape du codec, commune aux deux sens : applique `code` à l'état.
function appliquerCode(etat, code) {
  const pas = PAS[etat.index];
  let ecart = pas >> 3;
  if (code & 4) ecart += pas;
  if (code & 2) ecart += pas >> 1;
  if (code & 1) ecart += pas >> 2;
  etat.predicteur = borner(etat.predicteur + (code & 8 ? -ecart : ecart), -32768, 32767);
  etat.index = borner(etat.index + INDICES[code & 7], 0, PAS.length - 1);
}

// Int16Array → paquet (`etat` { predicteur, index } est mis à jour).
export function encoderAdpcm(echantillons, etat) {
  const octets = new Uint8Array(ENTETE + Math.ceil(echantillons.length / 2));
  new DataView(octets.buffer).setInt16(0, etat.predicteur, true);
  octets[2] = etat.index;
  echantillons.forEach((echantillon, i) => {
    const pas = PAS[etat.index];
    let reste = echantillon - etat.predicteur;
    let code = 0;
    if (reste < 0) { code = 8; reste = -reste; }
    if (reste >= pas) { code |= 4; reste -= pas; }
    if (reste >= pas >> 1) { code |= 2; reste -= pas >> 1; }
    if (reste >= pas >> 2) code |= 1;
    appliquerCode(etat, code);
    octets[ENTETE + (i >> 1)] |= i & 1 ? code << 4 : code;
  });
  return octets;
}

// Paquet → Int16Array.
export function decoderAdpcm(octets) {
  const etat = {
    predicteur: new DataView(octets.buffer, octets.byteOffset).getInt16(0, true),
    index: borner(octets[2], 0, PAS.length - 1),
  };
  const sortie = new Int16Array((octets.length - ENTETE) * 2);
  sortie.forEach((_, i) => {
    const octet = octets[ENTETE + (i >> 1)];
    appliquerCode(etat, i & 1 ? octet >> 4 : octet & 15);
    sortie[i] = etat.predicteur;
  });
  return sortie;
}

export function versBase64(octets) {
  let texte = "";
  for (const octet of octets) texte += String.fromCharCode(octet);
  return btoa(texte);
}

export function depuisBase64(texte) {
  return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));
}

// Micro (flottants au taux du navigateur) → échantillons 16 bits à 8 kHz, par
// moyenne de chaque tranche : un filtre simple, suffisant pour la voix.
export function creerReducteur(tauxSource) {
  const pas = tauxSource / TAUX_RELAIS;
  let somme = 0;
  let nombre = 0;
  let position = 0;
  return (bloc) => {
    const sortie = [];
    for (const valeur of bloc) {
      somme += valeur;
      nombre += 1;
      position += 1;
      if (position >= pas) {
        sortie.push(borner(Math.round((somme / nombre) * 32767), -32768, 32767));
        somme = 0;
        nombre = 0;
        position -= pas;
      }
    }
    return sortie;
  };
}

function niveau(echantillons) {
  let somme = 0;
  for (const e of echantillons) somme += e * e;
  return Math.sqrt(somme / echantillons.length);
}

// Chaîne d'émission : blocs du micro → paquets (octets) passés à `envoyer`. Au
// début d'une phrase, le paquet précédent part aussi, pour ne pas la couper.
export function creerEmission(tauxSource, envoyer) {
  const reduire = creerReducteur(tauxSource);
  const tampon = new Int16Array(ECHANTILLONS_PAR_PAQUET);
  const etat = { predicteur: 0, index: 0 };
  let rempli = 0;
  let restants = 0; // paquets à envoyer encore après la parole
  let precedent = null;

  const fermerPaquet = () => {
    const parle = niveau(tampon) >= SEUIL_PAROLE;
    const paquet = encoderAdpcm(tampon, etat);
    if (parle) {
      if (restants === 0 && precedent) envoyer(precedent);
      restants = PAQUETS_APRES_PAROLE + 1;
    }
    if (restants > 0) {
      envoyer(paquet);
      restants -= 1;
      precedent = null;
    } else {
      precedent = paquet;
    }
  };

  return (bloc) => {
    for (const echantillon of reduire(bloc)) {
      tampon[rempli] = echantillon;
      rempli += 1;
      if (rempli === ECHANTILLONS_PAR_PAQUET) {
        fermerPaquet();
        rempli = 0;
      }
    }
  };
}

// Heure de lecture d'un paquet reçu : à la suite du précédent ; après un blanc,
// on se redonne de l'avance. null : trop de retard, ce paquet est jeté.
export function heureDeLecture(prochain, maintenant) {
  if (prochain - maintenant > RETARD_MAX_S) return null;
  return prochain <= maintenant ? maintenant + AVANCE_LECTURE_S : prochain;
}

export const finDeLecture = (debut) => debut + DUREE_PAQUET_S;
