import assert from "node:assert/strict";
import test from "node:test";

import {
  extensionPourType, formatTaille, iconeFichier, imageAffichable, typeFichier, verifierFichier,
} from "../src/components/messagerie/documents.js";

const f = (name, type, size = 1000) => ({ name, type, size });

test("type : déclaré par le navigateur, sinon déduit de l'extension", () => {
  assert.equal(typeFichier(f("bulletin.pdf", "application/pdf")), "application/pdf");
  // Android : .docx sans type déclaré.
  assert.equal(typeFichier(f("Note.DOCX", "")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(typeFichier(f("photo.jpg", "image/jpeg;foo")), "image/jpeg");
  assert.equal(typeFichier(f("virus.exe", "application/x-msdownload")), null);
  assert.equal(typeFichier(f("script.js", "")), null);
});

test("vérification : type, taille (10 Mo), fichier vide", () => {
  assert.equal(verifierFichier(f("a.pdf", "application/pdf")).ok, true);
  assert.match(verifierFichier(f("a.exe", "")).erreur, /non accepté/);
  assert.match(verifierFichier(f("gros.pdf", "application/pdf", 11 * 1024 * 1024)).erreur, /10 Mo/);
  assert.match(verifierFichier(f("vide.pdf", "application/pdf", 0)).erreur, /vide/);
});

test("extension de stockage cohérente avec le type", () => {
  assert.equal(extensionPourType("image/jpeg", "IMG_001.JPG"), "jpg");
  assert.equal(extensionPourType("image/jpeg", "photo.png"), "jpg"); // compressée en JPEG
  assert.equal(extensionPourType("application/pdf", ""), "pdf");
});

test("affichage : icônes, tailles, images affichables", () => {
  assert.equal(iconeFichier("application/pdf"), "📕");
  assert.equal(iconeFichier("application/vnd.ms-excel"), "📊");
  assert.equal(iconeFichier("text/csv"), "📊");
  assert.equal(formatTaille(512), "512 o");
  assert.equal(formatTaille(250 * 1024), "250 Ko");
  assert.equal(formatTaille(1.25 * 1024 * 1024), "1,3 Mo");
  assert.equal(imageAffichable("image/heic"), false);
  assert.equal(imageAffichable("image/png"), true);
});
