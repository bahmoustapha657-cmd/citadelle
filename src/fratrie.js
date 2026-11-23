// ── Fratrie d'un élève : les enfants d'un même tuteur ──────────────────────
// Module PUR (testé par tests/fratrie.test.js), utilisé par le reçu famille
// des mensualités. Deux élèves sont de la même famille :
//   • selon la règle des comptes parents (memeParent) : même nom de tuteur,
//     puis même numéro — ou, faute de numéro, même filiation ;
//   • OU avec un numéro de tuteur en commun et des noms compatibles : l'un
//     abrège l'autre (« Mamadou » / « Mamadou Saliou Diallo »), aux fautes de
//     frappe près (« Mamadou Djallo »).
// Un numéro partagé par des tuteurs aux noms sans rapport (celui de l'école
// pour des internes) ne réunit personne, pas plus qu'un homonyme sans numéro
// ni filiation commune. memeParent, elle, reste stricte : elle ouvre l'accès
// d'un compte parent aux fiches d'un enfant ; ici, le caissier décoche ce
// qui ne va pas avant d'imprimer.
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

export function memeFamille(a, b) {
  if (memeParent(a, b)) return true;
  const numerosA = numerosTuteur(a.contactTuteur);
  if (!numerosA.length) return false;
  const numerosB = new Set(numerosTuteur(b.contactTuteur));
  return numerosA.some((n) => numerosB.has(n)) && nomsCompatibles(a.tuteur, b.tuteur);
}

// Nom du tuteur à imprimer sur le reçu : le plus complet des fiches
// (« Mamadou Saliou Diallo » plutôt que « Mamadou ») ; à égalité, celui du
// premier élève. Chaîne vide si aucune fiche ne le renseigne.
export function tuteurFamille(eleves = []) {
  let meilleur = "", mots = 0;
  for (const e of eleves) {
    const nom = String(e?.tuteur ?? "").trim();
    const n = motsNom(nom).length;
    if (nom && (!meilleur || n > mots)) { meilleur = nom; mots = n; }
  }
  return meilleur;
}

// Index des élèves par nom de tuteur et par numéro : la grille compte des
// centaines de lignes, comparer chacune à toutes les autres à chaque rendu
// serait coûteux. Renvoie fratrieDe(eleve) → [eleve, ...frères et sœurs]
// (l'élève d'abord, puis par classe et nom), sans doublon d'identifiant.
// Les liens se suivent de proche en proche (« Mamadou » → « Mamadou
// Diallo » → « M. Diallo ») : la famille est la même, quel que soit
// l'enfant cliqué.
export function indexFratries(eleves = []) {
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
          if (vus.has(x._id) || !memeFamille(membre, x)) continue;
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
