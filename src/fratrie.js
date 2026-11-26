// ── Fratrie d'un élève : les enfants d'un même tuteur ──────────────────────
// Module PUR (testé par tests/fratrie.test.js), utilisé par le reçu famille
// des mensualités. Deux élèves sont de la même famille :
//   • selon la règle des comptes parents (memeParent) : même nom de tuteur,
//     puis même numéro — ou, faute de numéro, même filiation ;
//   • OU avec un numéro de tuteur en commun, quel que soit le nom écrit sur
//     chaque fiche : le père sur l'une, la mère ou un oncle sur l'autre, un
//     nom abrégé (« Mamadou » / « Mamadou Saliou Diallo ») ou mal orthographié.
// Seule exception : un numéro COLLECTIF, inscrit sous SEUIL_COLLECTIF noms de
// tuteur sans rapport ou plus (celui de l'école pour des internes, un numéro
// de remplissage), n'est celui d'aucune famille ; il ne réunit que des noms
// compatibles. Un homonyme sans numéro ni filiation commune n'est pas
// rattaché. memeParent, elle, reste stricte : elle ouvre l'accès d'un compte
// parent aux fiches d'un enfant ; ici, le caissier décoche ce qui ne va pas
// avant d'imprimer.
import { normaliserTelGuinee } from "../shared/phone.js";
import { memeParent, nomComparable } from "./comptes-parents.js";

// Numéros d'une fiche (« 620 00 00 01 / 621 11 11 11 » : père et mère), au
// format +224…, sans doublon.
export function numerosTuteur(brut) {
  const morceaux = String(brut ?? "").split(/[/,;|]| ou | et /i);
  return [...new Set(morceaux.map(normaliserTelGuinee).filter(Boolean))];
}

// Civilités et titres, ignorés pour comparer deux noms (« El Hadj Mamadou
// Diallo », « Mme Diallo »).
const TITRES = new Set([
  "m", "mr", "mme", "mlle", "monsieur", "madame", "mademoiselle", "dr", "docteur",
  "el", "elh", "hadj", "hadja", "hadji", "elhadj", "elhadji", "elhadja",
]);
const motsNom = (brut) => nomComparable(brut).split(" ").filter((m) => m && !TITRES.has(m)).slice(0, 8);

// Distance d'édition : lettres ajoutées, retirées ou changées.
function distance(a, b) {
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prec = cour;
  }
  return prec[b.length];
}

// Deux mots du même nom : identiques, initiale (« A. » / « Alpha »), forme
// courte (« Abdoul » / « Abdoulaye », « Ba » / « Bah »), ou faute de frappe
// (une lettre sur un mot court, deux à partir de 6 lettres).
function motsProches(a, b) {
  if (a === b) return true;
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  if (court.length === 1) return long.startsWith(court);
  if (long.startsWith(court) && (court.length >= 4 || long.length - court.length === 1)) return true;
  if (court.length < 4) return false;
  return distance(court, long) <= (court.length >= 6 ? 2 : 1);
}

// Chaque mot de `court` trouve son mot dans `long`, un mot n'étant pris
// qu'une fois.
function inclus(court, long) {
  if (!court.length) return true;
  const [mot, ...reste] = court;
  return long.some((m, i) => motsProches(mot, m) && inclus(reste, [...long.slice(0, i), ...long.slice(i + 1)]));
}

// Noms de tuteur compatibles : le plus court tient tout entier dans l'autre.
export function nomsCompatibles(x, y) {
  const a = motsNom(x), b = motsNom(y);
  if (!a.length || !b.length) return false;
  return a.length <= b.length ? inclus(a, b) : inclus(b, a);
}

// Une famille écrit au plus quelques noms sur le même numéro (père, mères,
// oncle…) ; à partir de six noms sans rapport, le numéro est collectif.
export const SEUIL_COLLECTIF = 6;

// Numéros collectifs d'une liste d'élèves : chaque numéro compte ses noms de
// tuteur sans rapport entre eux (« Mamadou » et « Mamadou Diallo » n'en font
// qu'un ; une fiche sans nom n'en ajoute pas).
export function numerosCollectifs(eleves = []) {
  const noms = new Map();
  for (const e of eleves) {
    if (!motsNom(e?.tuteur).length) continue;
    for (const n of numerosTuteur(e?.contactTuteur)) {
      const liste = noms.get(n) || [];
      if (liste.length < SEUIL_COLLECTIF && !liste.some((x) => nomsCompatibles(x, e.tuteur))) liste.push(e.tuteur);
      noms.set(n, liste);
    }
  }
  return new Set([...noms].filter(([, liste]) => liste.length >= SEUIL_COLLECTIF).map(([n]) => n));
}

// `collectifs` : numéros collectifs de la liste (cf. numerosCollectifs) ;
// indexFratries les calcule.
export function memeFamille(a, b, collectifs = new Set()) {
  if (memeParent(a, b)) return true;
  const numerosB = new Set(numerosTuteur(b.contactTuteur));
  const communs = numerosTuteur(a.contactTuteur).filter((n) => numerosB.has(n));
  if (!communs.length) return false;
  return communs.some((n) => !collectifs.has(n)) || nomsCompatibles(a.tuteur, b.tuteur);
}

// Nom du tuteur à imprimer sur le reçu : celui du premier élève (l'enfant
// cliqué), dans sa forme la plus complète parmi les fiches où il est écrit
// autrement (« Mamadou Saliou Diallo » plutôt que « Mamadou ») ; la mère
// inscrite sur la fiche d'un cadet ne remplace pas le père. À égalité, celui
// du premier élève. Chaîne vide si aucune fiche ne le renseigne.
export function tuteurFamille(eleves = []) {
  let meilleur = "", mots = 0;
  for (const e of eleves) {
    const nom = String(e?.tuteur ?? "").trim();
    const n = motsNom(nom).length;
    if (!nom) continue;
    if (!meilleur) { meilleur = nom; mots = n; continue; }
    if (n > mots && nomsCompatibles(meilleur, nom)) { meilleur = nom; mots = n; }
  }
  return meilleur;
}

// Index des élèves par nom de tuteur et par numéro : la grille compte des
// centaines de lignes, comparer chacune à toutes les autres à chaque rendu
// serait coûteux. Renvoie fratrieDe(eleve) → [eleve, ...frères et sœurs]
// (l'élève d'abord, puis par classe et nom), sans doublon d'identifiant.
// Les liens se suivent de proche en proche (« Mamadou » → « Mamadou
// Diallo » → « M. Diallo », ou le numéro du père → une fiche aux numéros du
// père et de la mère → le numéro de la mère) : la famille est la même, quel
// que soit l'enfant cliqué.
export function indexFratries(eleves = []) {
  const collectifs = numerosCollectifs(eleves);
  const index = new Map();
  const ranger = (cle, e) => index.set(cle, [...(index.get(cle) || []), e]);
  const cles = (e) => {
    const nom = nomComparable(e?.tuteur);
    return [...(nom ? [`nom:${nom}`] : []), ...numerosTuteur(e?.contactTuteur).map((n) => `tel:${n}`)];
  };
  for (const e of eleves) for (const cle of cles(e)) ranger(cle, e);
  return (eleve) => {
    if (!eleve) return [];
    const vus = new Set([eleve._id]);
    const uniques = [];
    const aVoir = [eleve];
    while (aVoir.length) {
      const membre = aVoir.shift();
      for (const cle of cles(membre)) {
        for (const x of index.get(cle) || []) {
          if (vus.has(x._id) || !memeFamille(membre, x, collectifs)) continue;
          vus.add(x._id);
          uniques.push(x);
          aVoir.push(x);
        }
      }
    }
    uniques.sort((a, b) => String(a.classe || "").localeCompare(String(b.classe || ""), "fr", { numeric: true })
      || `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));
    return [eleve, ...uniques];
  };
}
