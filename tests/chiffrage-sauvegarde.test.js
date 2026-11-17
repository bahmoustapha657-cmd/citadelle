// Chiffrage des sauvegardes envoyées hors du PC (supabase/chiffrage-sauvegarde.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  MAGIQUE, chiffrer, dechiffrer, ecrirePrivee, ecrirePublique, genererCles, lireFichierCles,
  lirePrivee, lirePublique, priveeParGroupes, publiqueDe,
} from "../supabase/chiffrage-sauvegarde.mjs";

const copie = Buffer.from('COPY "auth"."users" ("id", "encrypted_password") FROM stdin;\nu1\t$2a$10$hash\n\\.\n'.repeat(200));

test("aller-retour : seule la clé privée ouvre la copie, à l'identique", () => {
  const titulaire = genererCles();
  const chiffre = chiffrer(gzipSync(copie), [titulaire.publique]);
  assert.ok(chiffre.subarray(0, MAGIQUE.length).equals(MAGIQUE));
  assert.ok(!chiffre.includes(Buffer.from("encrypted_password")), "rien de lisible dans la copie chiffrée");
  assert.ok(gunzipSync(dechiffrer(chiffre, titulaire.privee)).equals(copie));
  assert.throws(() => dechiffrer(chiffre, genererCles().privee), /ne peut pas ouvrir/);
});

test("plusieurs détenteurs (titulaire + suppléant) : chacun ouvre avec SA clé", () => {
  const titulaire = genererCles();
  const suppleant = genererCles();
  const chiffre = chiffrer(copie, [titulaire.publique, suppleant.publique]);
  assert.ok(dechiffrer(chiffre, titulaire.privee).equals(copie));
  assert.ok(dechiffrer(chiffre, suppleant.privee).equals(copie));
  // Deux chiffrements du même contenu ne se ressemblent pas.
  assert.ok(!chiffrer(copie, [titulaire.publique]).equals(chiffrer(copie, [titulaire.publique])));
});

test("toute altération est détectée (contenu, en-tête, troncature)", () => {
  const { privee, publique } = genererCles();
  const chiffre = chiffrer(copie, [publique]);
  const abime = (pos) => { const b = Buffer.from(chiffre); b[pos] ^= 1; return b; };
  assert.throws(() => dechiffrer(abime(chiffre.length - 40), privee), /altéré/);
  assert.throws(() => dechiffrer(abime(MAGIQUE.length + 1 + 50), privee), /ne peut pas ouvrir/);
  assert.throws(() => dechiffrer(abime(MAGIQUE.length + 1 + 92 + 3), privee), /altéré/);
  assert.throws(() => dechiffrer(chiffre.subarray(0, 60), privee), /tronqué/);
  assert.throws(() => dechiffrer(Buffer.from("pas une sauvegarde"), privee), /n'est pas une sauvegarde chiffrée/);
});

test("clé privée sur papier : recopiable par groupes, faute de frappe repérée", () => {
  const { privee, publique } = genererCles();
  const ecrite = ecrirePrivee(privee);
  assert.match(ecrite, /^EDUGEST-PRIVEE-[0-9a-f]{64}-[0-9a-f]{4}$/);
  assert.equal(ecrite.length, 84);
  assert.ok(lirePrivee(ecrite).equals(privee));
  const parGroupes = ecrite.toUpperCase().replace(/([0-9A-F]{8})/g, "$1 ").replace("PRIVEE-", "PRIVEE-\n");
  assert.ok(lirePrivee(parGroupes).equals(privee));
  const hex = ecrite.slice(15, 79);
  const faute = ecrite.replace(hex, (hex[0] === "a" ? "b" : "a") + hex.slice(1));
  assert.throws(() => lirePrivee(faute), /faute de recopie/);
  assert.throws(() => lirePrivee("n'importe quoi"), /illisible/);
  assert.ok(publiqueDe(privee).equals(publique));
  // Fichier de la clé : commentaires + disposition pour le papier.
  const papier = priveeParGroupes(privee);
  assert.equal(papier.split("\n").length, 4);
  assert.ok(lirePrivee(`# CLÉ PRIVÉE — ne jamais la donner\n# générée le …\n${papier}\n`).equals(privee));
});

test("fichier des clés publiques : une par ligne, commentaires ignorés", () => {
  const a = genererCles().publique;
  const b = genererCles().publique;
  const texte = `# Clés publiques\n\n${ecrirePublique(a)}   clé principale\r\n# suppléant :\n${ecrirePublique(b)}\n`;
  const cles = lireFichierCles(texte);
  assert.equal(cles.length, 2);
  assert.ok(cles[0].equals(a) && cles[1].equals(b));
  assert.throws(() => lireFichierCles("# rien\n"), /aucune clé publique/);
  assert.throws(() => lirePublique("edugest-publique-1234"), /illisible/);
});
