// ══════════════════════════════════════════════════════════════
//  Montant en toutes lettres
// ══════════════════════════════════════════════════════════════
// Une pièce comptable s'arrête « à la somme de cinq millions deux cent mille
// francs guinéens » : le montant en lettres est ce qui empêche d'ajouter un
// chiffre au stylo. Orthographe traditionnelle (traits d'union sous cent,
// « et » dans 21, 31… 71), accords de « vingt » et « cent » :
//   - 80, 200 prennent un s quand rien ne les suit : quatre-vingts, deux cents ;
//   - pas devant « mille », adjectif numéral : quatre-vingt mille ;
//   - mais bien devant « million(s) », nom : deux cents millions.

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

// 1 à 99.
function moinsDeCent(n) {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  // 70-79 et 90-99 : soixante / quatre-vingt + 10 à 19.
  if (d === 7) return `soixante${u === 1 ? " et " : "-"}${moinsDeCent(10 + u)}`;
  if (d === 9) return `quatre-vingt-${moinsDeCent(10 + u)}`;
  if (d === 8) return u === 0 ? "quatre-vingts" : `quatre-vingt-${UNITES[u]}`;
  if (u === 0) return DIZAINES[d];
  return `${DIZAINES[d]}${u === 1 ? " et " : "-"}${UNITES[u]}`;
}

// 1 à 999. `accord` : vingt et cent peuvent-ils prendre le s du pluriel ?
// Faux devant « mille ».
function moinsDeMille(n, accord = true) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  const mots = [];
  if (c === 1) mots.push("cent");
  else if (c > 1) mots.push(`${UNITES[c]} cent${r === 0 && accord ? "s" : ""}`);
  if (r > 0) mots.push(r === 80 && !accord ? "quatre-vingt" : moinsDeCent(r));
  return mots.join(" ");
}

// Entier positif en lettres : 1 250 000 → « un million deux cent cinquante
// mille ». Les décimales sont ignorées (les montants de l'école sont entiers).
export function nombreEnLettres(nombre) {
  let n = Math.floor(Math.abs(Number(nombre) || 0));
  if (n === 0) return "zéro";
  const parties = [];
  for (const [valeur, nom] of [[1e9, "milliard"], [1e6, "million"]]) {
    const q = Math.floor(n / valeur);
    if (q > 0) {
      const quantite = q < 1000 ? moinsDeMille(q) : nombreEnLettres(q);
      parties.push(`${quantite} ${nom}${q > 1 ? "s" : ""}`);
      n %= valeur;
    }
  }
  const milliers = Math.floor(n / 1000);
  if (milliers > 0) parties.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  const reste = n % 1000;
  if (reste > 0) parties.push(moinsDeMille(reste));
  return parties.join(" ");
}

// Nom de la monnaie en toutes lettres (pluriel) ; code tel quel sinon.
const MONNAIES_EN_LETTRES = {
  GNF: "francs guinéens",
  XOF: "francs CFA",
  XAF: "francs CFA",
  USD: "dollars américains",
  EUR: "euros",
  MAD: "dirhams",
};

// « Cinq millions deux cent mille francs guinéens ».
export function montantEnLettres(montant, monnaie = "GNF") {
  const code = String(monnaie || "GNF").trim().toUpperCase();
  const texte = `${nombreEnLettres(montant)} ${MONNAIES_EN_LETTRES[code] || code}`;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
