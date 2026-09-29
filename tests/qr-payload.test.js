// Helper de charge utile QR des documents imprimés.
import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { qrPayload } from "../src/reports/qr.js";
import { encryptQrPayload, lireChampsQr } from "../src/reports/qr-crypto.js";

test("qrPayload : champs clé:valeur séparés par |, clés connues abrégées", () => {
  assert.equal(
    qrPayload({ EduGest: "Bulletin", Eleve: "Diallo A", Moy: "16/20" }),
    "T:B|E:Diallo A|M:16/20",
  );
  assert.equal(qrPayload({ EduGest: "Fiche de paie", NetTotal: "900000 GNF" }), "T:P|X:900000 GNF");
  assert.equal(qrPayload({ EduGest: "Inconnu" }), "T:Inconnu"); // type non abrégé : tel quel
});

test("qrPayload : certificat de niveau et dernière classe abrégés, relus en clair", () => {
  const texte = qrPayload({ EduGest: "Certificat de niveau", DerniereClasse: "6ème Année A" });
  assert.equal(texte, "T:C|L:6ème Année A");
  assert.deepEqual(lireChampsQr(texte), { type: "Certificat de niveau", champs: [["Dernière classe", "6ème Année A"]] });
});

test("qrPayload → lireChampsQr : aller-retour lisible", () => {
  const { type, champs } = lireChampsQr(qrPayload({ EduGest: "Recu", Eleve: "Bah M", Total: "500000 GNF", Mois: "Oct,Nov" }));
  assert.equal(type, "Reçu");
  assert.deepEqual(champs, [["Élève", "Bah M"], ["Total payé", "500000 GNF"], ["Mois", "Oct,Nov"]]);
});

// Garde-fou de LISIBILITÉ : c'est le nombre de modules qui décide si un
// téléphone lit le QR imprimé (≈ 22 mm). Au format EQR1, ces documents
// donnaient des QR de version 15 à 17 (77 à 85 modules) — illisibles.
test("les QR des documents réalistes restent peu denses (version ≤ 9, soit ≤ 53 modules)", async () => {
  const documents = {
    bulletin: { EduGest: "Bulletin", Eleve: "DIALLO Mamadou Aliou", IEN: "GN2024123456789", Classe: "10ème Année A", Periode: "1er Trimestre", Moy: "12.45/20", Annee: "2025-2026" },
    recu: { EduGest: "Recu", Eleve: "DIALLO Mamadou Aliou", Classe: "10ème Année A", IEN: "GN2024123456789", Total: "4500000 GNF", Mois: "Oct,Nov,Déc,Jan,Fév,Mar,Avr,Mai,Jun" },
    attestation: { EduGest: "Attestation", Num: "ATT-2026-0042", Eleve: "DIALLO Mamadou Aliou", IEN: "GN2024123456789", DerniereClasse: "10ème Année A", Annee: "2025-2026", Moy: "12.45/20", Du: "2023-10-02", Au: "2026-06-30" },
    certificat: { EduGest: "Certificat de niveau", Num: "CN-2026-0042", Eleve: "DIALLO Mamadou Aliou", IEN: "GN2024123456789", DerniereClasse: "6ème Année A", Annee: "2025-2026", Moy: "14.20/20", Du: "2020-10-01", Au: "2026-06-30" },
    paie: { EduGest: "Fiche de paie", Enseignant: "SOUMAH Ibrahima Sory", Annee: "2025-2026", NetTotal: "12500000 GNF", Mois: 9 },
  };
  for (const [nom, champs] of Object.entries(documents)) {
    const jeton = await encryptQrPayload(qrPayload(champs), "citadelle");
    const qr = QRCode.create(jeton, { errorCorrectionLevel: "M" });
    assert.deepEqual(qr.segments.map((s) => s.mode.id), ["Alphanumeric"], `${nom} : un seul segment alphanumérique`);
    assert.ok(qr.version <= 9, `${nom} : version ${qr.version} (${qr.modules.size} modules)`);
  }
});

test("qrPayload : ignore les champs vides / null / undefined", () => {
  assert.equal(
    qrPayload({ A: "1", B: "", C: null, D: undefined, E: "  ", F: "2" }),
    "A:1|F:2",
  );
});

test("qrPayload : neutralise les séparateurs internes (| et retour ligne)", () => {
  assert.equal(qrPayload({ X: "a|b\nc" }), "X:a b c");
});

test("qrPayload : objet vide → chaîne vide", () => {
  assert.equal(qrPayload({}), "");
});
