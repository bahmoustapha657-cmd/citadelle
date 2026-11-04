// Garde-fou des langues : compte, fichier par fichier, les textes français
// écrits en dur dans src/ au lieu de passer par t("clé") / tr("clé").
//
// Pourquoi : la traduction anglais/arabe (mai 2026) a dérivé. Chaque fonction
// ajoutée ensuite est restée en français seulement (~3 100 textes au
// 2026-11-04) et l'application s'affichait à moitié traduite. La référence
// scripts/textes-en-dur.json fige le nombre de textes en dur de chaque
// fichier ; tests/traductions.test.js refuse toute hausse.
//
//   node scripts/textes-en-dur.mjs          → bilan, fichiers les plus chargés
//   node scripts/textes-en-dur.mjs <motif>  → textes trouvés dans les fichiers du motif
//   npm run textes:maj                      → réécrit la référence (après une baisse)
//
// Une ligne qui doit rester en français (donnée, valeur comparée…) se marque
// d'un commentaire « i18n-ignore » sur la ligne même ou juste au-dessus.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import * as espree from "espree";

export const REFERENCE = "scripts/textes-en-dur.json";

const LETTRES = /\p{L}{2,}/u;
const ACCENTS = /[àâäéèêëîïôöùûüçœæÀÂÉÈÊËÎÏÔÙÛÇŒ]/;
const MOTS_FRANCAIS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "au", "aux",
  "pour", "par", "sur", "dans", "avec", "est", "sont", "pas", "ne", "ce",
  "cette", "ces", "son", "sa", "ses", "votre", "vos", "nous", "vous", "il", "elle",
  "qui", "que", "plus", "tout", "tous", "aucun", "aucune", "veuillez",
]);

// Attributs JSX que l'utilisateur lit, et attributs purement techniques.
const ATTRIBUTS_VISIBLES = /^(placeholder|title|alt|label|aria-label|aria-description|tooltip|titre|sousTitre|libelle|texte|message|description|aide|confirmation)$/i;
const ATTRIBUTS_TECHNIQUES = /^(className|style|key|id|type|name|href|src|rel|target|role|htmlFor|autoComplete|inputMode|method|accept|capture|lang|dir|value|defaultValue|pattern|form|data-.*)$/;
// Méthodes dont l'argument texte est une donnée comparée ou une clé, pas un affichage.
const METHODES_DONNEES = new Set([
  "includes", "startsWith", "endsWith", "indexOf", "split", "replace", "replaceAll",
  "match", "getItem", "setItem", "removeItem", "querySelector", "querySelectorAll",
  "addEventListener", "removeEventListener", "eq", "neq", "ilike", "like", "has", "get",
]);

const estAppelTraduction = (n) =>
  n.type === "CallExpression" &&
  ((n.callee.type === "Identifier" && /^(t|tr)$/.test(n.callee.name)) ||
    (n.callee.type === "MemberExpression" && !n.callee.computed && n.callee.property.name === "t"));

const estAppelMethode = (n, filtre) =>
  n.type === "CallExpression" &&
  n.callee.type === "MemberExpression" &&
  !n.callee.computed &&
  filtre(n.callee);

const nomAttribut = (n) =>
  n.name.type === "JSXNamespacedName" ? `${n.name.namespace.name}:${n.name.name.name}` : n.name.name;

const sansBalises = (texte) => texte.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function ressembleAuFrancais(texte) {
  if (!LETTRES.test(texte)) return false;
  if (ACCENTS.test(texte)) return true;
  if (!/\s/.test(texte)) return false;
  return texte.toLowerCase().split(/[^\p{L}']+/u).some((mot) => MOTS_FRANCAIS.has(mot));
}

// Le texte est-il technique (clé de traduction, import, console, comparaison…) ?
function estIgnore(chaine) {
  for (let enfant = chaine, n = chaine.parent; n; enfant = n, n = n.parent) {
    if (estAppelTraduction(n)) return true;
    if (estAppelMethode(n, (c) => c.object.type === "Identifier" && c.object.name === "console")) return true;
    if (estAppelMethode(n, (c) => METHODES_DONNEES.has(c.property.name)) && n.arguments.includes(enfant)) return true;
    if (n.type === "JSXAttribute" && ATTRIBUTS_TECHNIQUES.test(nomAttribut(n))) return true;
    if (/^(Import|Export(Named|All))Declaration$|^ImportExpression$/.test(n.type) && n.source === enfant) return true;
    if (n.type === "Property" && n.key === enfant && !n.computed) return true;
    if (n.type === "BinaryExpression" && /^[!=]==?$/.test(n.operator)) return true;
    if (n.type === "SwitchCase" && n.test === enfant) return true;
  }
  return false;
}

// Où atterrit le texte : « jsx » (affiché tel quel), « attribut » (attribut
// visible), sinon « ailleurs » (constante, message… jugé sur sa forme).
function destination(chaine) {
  for (let enfant = chaine, n = chaine.parent; n; enfant = n, n = n.parent) {
    switch (n.type) {
      case "JSXExpressionContainer":
        if (n.parent?.type !== "JSXAttribute") return "jsx";
        break;
      case "JSXAttribute":
        return ATTRIBUTS_VISIBLES.test(nomAttribut(n)) ? "attribut" : "ailleurs";
      case "ConditionalExpression":
        if (n.test === enfant) return "ailleurs";
        break;
      case "BinaryExpression":
        if (n.operator !== "+") return "ailleurs";
        break;
      case "LogicalExpression":
      case "TemplateLiteral":
      case "ArrayExpression":
        break;
      default:
        return "ailleurs";
    }
  }
  return "ailleurs";
}

function lignesIgnorees(commentaires) {
  const lignes = new Set();
  for (const c of commentaires) {
    if (!/i18n-ignore/.test(c.value)) continue;
    lignes.add(c.loc.start.line);
    lignes.add(c.loc.end.line + 1);
  }
  return lignes;
}

function parcourir(noeud, parent, visite) {
  if (!noeud || typeof noeud.type !== "string") return;
  noeud.parent = parent;
  visite(noeud);
  for (const cle of Object.keys(noeud)) {
    if (cle === "parent") continue;
    const valeur = noeud[cle];
    if (Array.isArray(valeur)) valeur.forEach((v) => parcourir(v, noeud, visite));
    else if (valeur && typeof valeur.type === "string") parcourir(valeur, noeud, visite);
  }
}

// Textes français en dur d'un fichier source : [{ ligne, texte }].
// Un gabarit `…${x}…` compte morceau par morceau (balises HTML retirées).
export function analyserSource(code) {
  const ast = espree.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    comment: true,
    loc: true,
  });
  const ignorees = lignesIgnorees(ast.comments);
  const trouves = [];
  parcourir(ast, null, (n) => {
    let texte;
    let porteur = n;
    if (n.type === "JSXText") texte = n.value;
    else if (n.type === "Literal" && typeof n.value === "string") texte = n.value;
    else if (n.type === "TemplateElement") {
      texte = sansBalises(n.value.cooked ?? "");
      porteur = n.parent;
    } else return;
    texte = texte.replace(/\s+/g, " ").trim();
    if (!LETTRES.test(texte) || ignorees.has(n.loc.start.line)) return;
    if (n.type !== "JSXText" && estIgnore(porteur)) return;

    const ou = n.type === "JSXText" ? "jsx" : destination(porteur);
    if (ou !== "ailleurs" || ressembleAuFrancais(texte)) {
      trouves.push({ ligne: n.loc.start.line, texte: texte.slice(0, 80) });
    }
  });
  return trouves;
}

function fichiersSource(dossier) {
  const fichiers = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) fichiers.push(...fichiersSource(chemin));
    else if (/\.(js|jsx|mjs)$/.test(e.name)) fichiers.push(chemin);
  }
  return fichiers;
}

// { "src/…/Fichier.jsx": [{ ligne, texte }] } pour tout src/ (hors src/i18n).
export function analyserDepot(racine = process.cwd()) {
  const resultat = {};
  for (const chemin of fichiersSource(join(racine, "src")).sort()) {
    const fichier = relative(racine, chemin).split(sep).join("/");
    if (fichier.startsWith("src/i18n/")) continue;
    let trouves;
    try {
      trouves = analyserSource(readFileSync(chemin, "utf8"));
    } catch (e) {
      throw new Error(`${fichier} : analyse impossible (${e.message})`, { cause: e });
    }
    if (trouves.length) resultat[fichier] = trouves;
  }
  return resultat;
}

export const compter = (analyse) =>
  Object.fromEntries(Object.entries(analyse).map(([f, t]) => [f, t.length]));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const analyse = analyserDepot();
  const comptes = compter(analyse);
  const total = Object.values(comptes).reduce((a, b) => a + b, 0);
  const motif = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (process.argv.includes("--maj")) {
    writeFileSync(REFERENCE, JSON.stringify(comptes, null, 2) + "\n");
    console.log(`Référence réécrite : ${total} textes en dur dans ${Object.keys(comptes).length} fichiers.`);
  } else if (motif) {
    for (const [f, trouves] of Object.entries(analyse).filter(([f]) => f.includes(motif))) {
      console.log(`\n${f} (${trouves.length})`);
      for (const { ligne, texte } of trouves) console.log(`  ${String(ligne).padStart(4)}  ${texte}`);
    }
  } else {
    console.log(`${total} textes français en dur dans ${Object.keys(comptes).length} fichiers.`);
    for (const [f, n] of Object.entries(comptes).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
      console.log(String(n).padStart(5), f);
    }
  }
}
