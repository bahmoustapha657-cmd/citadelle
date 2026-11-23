import assert from "node:assert/strict";
import test from "node:test";
import { indexFratries, memeFamille, nomsCompatibles, numerosTuteur, tuteurFamille } from "../src/fratrie.js";

const eleve = (id, prenom, classe, extra = {}) => ({
  _id: id, nom: "Diallo", prenom, classe, tuteur: "Mamadou Diallo", contactTuteur: "620 00 00 01", ...extra,
});

test("la fratrie réunit les enfants du même tuteur, toutes classes confondues, l'élève cliqué d'abord", () => {
  const aine = eleve("a", "Aïssatou", "8e A");
  const cadet = eleve("b", "Ibrahima", "CP1", { contactTuteur: "+224 620000001" }); // même numéro, autre écriture
  const benjamin = eleve("c", "Fatou", "6e B", { tuteur: "DIALLO Mamadou" });       // nom dans l'autre ordre
  const fratrieDe = indexFratries([aine, cadet, benjamin]);
  assert.deepEqual(fratrieDe(benjamin).map((e) => e._id), ["c", "a", "b"]);
  assert.equal(fratrieDe(aine)[0]._id, "a");
  assert.equal(fratrieDe(aine).length, 3);
});

test("un homonyme au numéro différent n'est pas rattaché", () => {
  const a = eleve("a", "Aïssatou", "8e A");
  const autre = eleve("z", "Oumar", "7e A", { contactTuteur: "621 99 99 99" });
  assert.deepEqual(indexFratries([a, autre])(a).map((e) => e._id), ["a"]);
});

test("sans numéro, la filiation commune rattache ; sans elle, rien", () => {
  const a = eleve("a", "Aïssatou", "8e A", { contactTuteur: "", filiation: "Mariama Bah" });
  const b = eleve("b", "Ibrahima", "CP1", { contactTuteur: "", filiation: "mariama BAH" });
  const c = eleve("c", "Fatou", "6e B", { contactTuteur: "" });
  assert.deepEqual(indexFratries([a, b, c])(a).map((e) => e._id), ["a", "b"]);
});

test("un élève sans tuteur reste seul, et n'est jamais compté deux fois", () => {
  const seul = { _id: "s", nom: "Bah", prenom: "Alpha", classe: "CE1", tuteur: "" };
  const a = eleve("a", "Aïssatou", "8e A");
  const fratrieDe = indexFratries([seul, a, a]);
  assert.deepEqual(fratrieDe(seul).map((e) => e._id), ["s"]);
  assert.deepEqual(fratrieDe(a).map((e) => e._id), ["a"]);
});

test("même numéro : un nom de tuteur abrégé ou écrit autrement rattache quand même", () => {
  const a = eleve("a", "Aïssatou", "8e A");
  const b = eleve("b", "Ibrahima", "CP1", { tuteur: "mamadou" });                          // prénom seul
  const c = eleve("c", "Fatou", "6e B", { tuteur: "MAMADOU DJALLO", contactTuteur: "+224620000001" }); // faute
  const d = eleve("d", "Oumar", "CE2", { tuteur: "El Hadj Mamadou Saliou Diallo" });    // titre + 2e prénom
  const e = eleve("e", "Kadiatou", "CM1", { tuteur: "M. Diallo" });                      // civilité + nom
  const fratrieDe = indexFratries([a, b, c, d, e]);
  assert.deepEqual(fratrieDe(b).map((x) => x._id).sort(), ["a", "b", "c", "d", "e"]);
  assert.equal(fratrieDe(b)[0]._id, "b");
  assert.equal(fratrieDe(a).length, 5);
  // « M. Diallo » ne partage aucun mot avec « mamadou » : relié par les autres fiches.
  assert.equal(fratrieDe(e).length, 5);
});

test("même numéro mais noms sans rapport (numéro de l'école pour des internes) : pas de rattachement", () => {
  const a = eleve("a", "Aïssatou", "8e A", { contactTuteur: "622 00 00 00" });
  const b = eleve("b", "Ibrahima", "CP1", { tuteur: "Ibrahima Sow", contactTuteur: "622 00 00 00" });
  const c = eleve("c", "Fatou", "6e B", { tuteur: "Ibrahima Diallo", contactTuteur: "622000000" }); // même nom de famille seulement
  const fratrieDe = indexFratries([a, b, c]);
  assert.deepEqual(fratrieDe(a).map((x) => x._id), ["a"]);
  assert.deepEqual(fratrieDe(c).map((x) => x._id), ["c"]);
});

test("nom abrégé sans numéro commun : pas de rattachement", () => {
  const a = eleve("a", "Aïssatou", "8e A");
  const autreNumero = eleve("b", "Ibrahima", "CP1", { tuteur: "Mamadou", contactTuteur: "621 99 99 99" });
  const sansNumero = eleve("c", "Fatou", "6e B", { tuteur: "Mamadou", contactTuteur: "" });
  assert.deepEqual(indexFratries([a, autreNumero, sansNumero])(a).map((x) => x._id), ["a"]);
  assert.equal(memeFamille(a, sansNumero), false);
});

test("une fiche à deux numéros (père / mère) retrouve l'enfant inscrit avec le second", () => {
  const a = eleve("a", "Aïssatou", "8e A", { contactTuteur: "620 00 00 01 / 621 11 11 11" });
  const b = eleve("b", "Ibrahima", "CP1", { tuteur: "Mamadou", contactTuteur: "621111111" });
  assert.deepEqual(numerosTuteur(a.contactTuteur), ["+224620000001", "+224621111111"]);
  assert.deepEqual(indexFratries([a, b])(b).map((x) => x._id), ["b", "a"]);
});

test("noms compatibles : formes courtes, initiales et fautes de frappe, pas les noms différents", () => {
  assert.ok(nomsCompatibles("Abdoul Diallo", "Abdoulaye Diallo"));
  assert.ok(nomsCompatibles("Alpha Ba", "Alpha Bah"));
  assert.ok(nomsCompatibles("A. Camara", "Alpha Kamara"));
  assert.ok(nomsCompatibles("Souleimane Konde", "Souleymane Kondé"));
  assert.ok(!nomsCompatibles("Mamadou Diallo", "Mariama Bah"));
  assert.ok(!nomsCompatibles("Alpha Sow", "Alpha Bah"));
  assert.ok(!nomsCompatibles("Madame", "Mamadou Diallo"));
  assert.ok(!nomsCompatibles("", "Mamadou Diallo"));
});

test("le reçu imprime le nom de tuteur le plus complet des fiches", () => {
  const fiches = [{ tuteur: "Mamadou" }, { tuteur: "" }, { tuteur: "Mamadou Saliou Diallo" }, { tuteur: "Mamadou Diallo" }];
  assert.equal(tuteurFamille(fiches), "Mamadou Saliou Diallo");
  assert.equal(tuteurFamille([{ tuteur: "Mamadou Diallo" }, { tuteur: "DIALLO Mamadou" }]), "Mamadou Diallo");
  assert.equal(tuteurFamille([{ tuteur: " " }]), "");
});
