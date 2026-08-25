import assert from "node:assert/strict";
import test from "node:test";
import {
  contraste, lisibleSur, luminance, paletteLisible, texteSur, versRvb,
} from "../src/couleur-lisible.js";

const SEUIL = 4.5; // WCAG AA, texte courant

test("contraste : valeurs de reference", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(Math.round(contraste("#ffffff", "#ffffff")), 1);
  // Couleurs REELLES des ecoles, mesurees sur le blanc.
  assert.ok(contraste("#003870", "#ffffff") > 11, "bleu nuit adventiste : lisible");
  assert.ok(contraste("#a8fc54", "#ffffff") < 1.5, "vert citron citadelle : illisible");
  assert.ok(contraste("#ffff00", "#ffffff") < 1.2, "jaune pur ep-guemebo : illisible");
});

test("versRvb tolere les formes courtes et refuse le reste", () => {
  assert.deepEqual(versRvb("#fff"), { r: 255, v: 255, b: 255 });
  assert.deepEqual(versRvb("0A1628"), { r: 10, v: 22, b: 40 });
  assert.equal(versRvb("bleu"), null);
  assert.equal(versRvb(""), null);
  assert.equal(luminance("pas une couleur"), null);
});

// Le coeur du correctif : quelle que soit la couleur choisie par l'ecole, la
// variante texte doit etre lisible sur blanc.
test("lisibleSur : toutes les couleurs d ecole atteignent le seuil", () => {
  const couleursReelles = [
    "#a8fc54", "#8ca8c4", "#ffff00", "#ff00ff", "#00C48C",
    "#34c200", "#1c8c1c", "#003870", "#0A1628", "#001c54", "#70381c",
  ];
  for (const c of couleursReelles) {
    const t = lisibleSur(c, "#ffffff");
    assert.ok(contraste(t, "#ffffff") >= SEUIL,
      `${c} -> ${t} : contraste ${contraste(t, "#ffffff").toFixed(2)} insuffisant`);
  }
});

test("lisibleSur : une couleur deja lisible n'est PAS touchee", () => {
  assert.equal(lisibleSur("#003870", "#ffffff"), "#003870");
  assert.equal(lisibleSur("#0A1628", "#ffffff"), "#0A1628");
});

test("lisibleSur : la teinte est conservee, seule la luminosite bouge", () => {
  const rvb = versRvb(lisibleSur("#a8fc54", "#ffffff"));
  // Le vert citron reste un VERT : la composante verte domine toujours.
  assert.ok(rvb.v > rvb.r && rvb.v > rvb.b, "la couleur doit rester verte");
});

test("lisibleSur : sur fond sombre, on eclaircit au lieu d'assombrir", () => {
  const clair = lisibleSur("#0A1628", "#0f172a");
  assert.ok(luminance(clair) > luminance("#0A1628"), "doit s'eclaircir");
  assert.ok(contraste(clair, "#0f172a") >= SEUIL);
});

test("texteSur : choisit le noir ou le blanc selon le fond", () => {
  assert.equal(texteSur("#0A1628"), "#ffffff", "sur bleu nuit : texte blanc");
  assert.equal(texteSur("#ffff00"), "#0f172a", "sur jaune : texte NOIR, pas blanc");
  assert.equal(texteSur("#a8fc54"), "#0f172a", "sur vert citron : texte noir");
  // Toujours un choix lisible, quelle que soit la couleur.
  for (const c of ["#a8fc54", "#ffff00", "#003870", "#ff00ff"]) {
    assert.ok(contraste(texteSur(c), c) >= SEUIL, `texte illisible sur ${c}`);
  }
});

test("paletteLisible : l identite est preservee a cote de la variante", () => {
  const p = paletteLisible("#a8fc54");
  assert.equal(p.brut, "#a8fc54", "la couleur de l'ecole reste disponible telle quelle");
  assert.notEqual(p.texte, "#a8fc54");
  assert.ok(contraste(p.texte, "#ffffff") >= SEUIL);
  assert.ok(contraste(p.dessus, "#a8fc54") >= SEUIL);
});
