// Garde-fou des langues (français, anglais, arabe) — voir scripts/textes-en-dur.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyserDepot, analyserSource, compter, REFERENCE } from "../scripts/textes-en-dur.mjs";

const LANGUES = ["fr", "en", "ar"];
const lireLangue = (l) => JSON.parse(readFileSync(`src/i18n/locales/${l}.json`, "utf8"));
const aplatir = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? aplatir(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const dictionnaires = Object.fromEntries(LANGUES.map((l) => [l, Object.fromEntries(aplatir(lireLangue(l)))]));
const variables = (texte) => [...String(texte).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

// JSON.parse garde silencieusement la dernière de deux clés identiques : un
// 2e bloc "modules" a ainsi effacé les noms traduits du menu (corrigé le
// 2026-11-04).
function clesEnDouble(texte) {
  const pile = [];
  const doublons = [];
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "{") pile.push(new Set());
    else if (c === "}") pile.pop();
    else if (c === '"') {
      let j = i + 1;
      while (texte[j] !== '"') j += texte[j] === "\\" ? 2 : 1;
      const chaine = texte.slice(i + 1, j);
      let k = j + 1;
      while (/\s/.test(texte[k])) k++;
      if (texte[k] === ":") {
        const cles = pile[pile.length - 1];
        if (cles.has(chaine)) doublons.push(chaine);
        cles.add(chaine);
      }
      i = j;
    }
  }
  return doublons;
}

test("aucune clé en double dans les fichiers de langue", () => {
  for (const l of LANGUES) {
    assert.deepEqual(clesEnDouble(readFileSync(`src/i18n/locales/${l}.json`, "utf8")), [], `${l}.json`);
  }
  assert.deepEqual(clesEnDouble('{"a": {"b": 1, "b": 2}, "c": ["a", "a"]}'), ["b"]);
});

test("les trois langues ont exactement les mêmes clés", () => {
  const fr = Object.keys(dictionnaires.fr);
  for (const l of ["en", "ar"]) {
    const autre = Object.keys(dictionnaires[l]);
    assert.deepEqual(fr.filter((k) => !(k in dictionnaires[l])), [], `clés absentes de ${l}.json`);
    assert.deepEqual(autre.filter((k) => !(k in dictionnaires.fr)), [], `clés de ${l}.json absentes de fr.json`);
  }
});

test("aucune traduction vide, et les mêmes {{variables}} dans chaque langue", () => {
  for (const [cle, texteFr] of Object.entries(dictionnaires.fr)) {
    for (const l of LANGUES) {
      const texte = dictionnaires[l][cle];
      assert.ok(typeof texte === "string" && texte.trim(), `${l}.json : « ${cle} » est vide`);
      assert.deepEqual(variables(texte), variables(texteFr), `${l}.json : « ${cle} » n'a pas les mêmes {{variables}} que le français`);
    }
  }
});

test("toute clé de traduction écrite dans le code existe dans fr.json", () => {
  const absentes = [];
  const parcourir = (dossier) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.(js|jsx)$/.test(e.name)) {
        const code = readFileSync(chemin, "utf8");
        for (const m of code.matchAll(/\b(?:t|tr|i18n\.t)\(\s*["']([\w-]+(?:\.[\w-]+)+)["']/g)) {
          const cle = m[1];
          const estFeuille = cle in dictionnaires.fr;
          const estBranche = Object.keys(dictionnaires.fr).some((k) => k.startsWith(`${cle}.`));
          if (!estFeuille && !estBranche) absentes.push(`${chemin} : ${cle}`);
        }
      }
    }
  };
  parcourir("src");
  assert.deepEqual(absentes, []);
});

test("aucun fichier n'ajoute de texte français en dur (traduire avec t() / tr())", () => {
  const reference = JSON.parse(readFileSync(REFERENCE, "utf8"));
  const analyse = analyserDepot();
  const hausses = Object.entries(compter(analyse))
    .filter(([fichier, n]) => n > (reference[fichier] ?? 0))
    .map(([fichier, n]) => {
      const textes = analyse[fichier].slice(0, 15).map(({ ligne, texte }) => `      l.${ligne}  ${texte}`);
      return `  ${fichier} : ${n} textes en dur (référence ${reference[fichier] ?? 0})\n${textes.join("\n")}`;
    });
  assert.equal(
    hausses.length,
    0,
    "Du texte français a été écrit en dur. Passez par t(\"clé\") (interface) ou tr(\"clé\") (documents imprimés)\n" +
      "et ajoutez la clé dans src/i18n/locales/fr.json, en.json et ar.json.\n" +
      "Une donnée qui doit rester en français se marque d'un commentaire « i18n-ignore ».\n" +
      "Après une baisse, `npm run textes:maj` réécrit la référence.\n\n" +
      hausses.join("\n"),
  );
});

test("analyserSource : textes affichés comptés, textes techniques ignorés", () => {
  const code = `
    import x from "./élèves.js";
    export function A({ ok }) {
      console.log("Démarrage du module");
      const style = { fontFamily: "Segoe UI, sans-serif" };
      if (ok === "Payé") return null;
      return (
        <div className="carte élève" title="Fiche de l'élève">
          Bonjour
          {ok ? "Valider" : "Annuler"}
          {t("commun.enregistrer", "Enregistrer")}
          <input placeholder={t("commun.recherche")} />
          {\`Total : \${ok}\`}
        </div>
      );
    }
    const message = "Aucun élève trouvé";
    const cle = "eleves";
    // i18n-ignore — mois stockés en français dans la base
    const mois = ["Février", "Août"];
  `;
  const textes = analyserSource(code).map((t) => t.texte);
  assert.deepEqual(textes, ["Fiche de l'élève", "Bonjour", "Valider", "Annuler", "Total :", "Aucun élève trouvé"]);
});
