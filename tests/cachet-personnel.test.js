import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { cachetOuEspace, signatairesDocument } from "../src/reports/signatures.js";
import { blocRecu } from "../src/reports/recus/recu-blocs.js";
import { signaturesBulletin } from "../src/reports/bulletins/bulletin-pro-commun.js";
import { definirSignataireSession, peutDeposerCachet, signataireSession } from "../src/reports/signataire-session.js";
import { documentsSignesPar, identiteApercu } from "../src/components/cachet/cachet-documents.js";
import { effacerFondPapier } from "../src/components/cachet/preparer-cachet.js";

const ecole = {
  nom: "La Citadelle",
  responsables: { direction: "Mamadou Lamarana Diallo", comptable: "Aïssatou Bah", primaire: "Kadiatou Barry" },
};
const CACHET = "https://x.supabase.co/storage/v1/object/public/photos/LC/cachets/a.png";
const cachets = (doc, signataire, section = "college", info = ecole) =>
  signatairesDocument(info, doc, { section, signataire }).map((s) => `${s.cle}:${s.cachet ? "cachet" : "-"}`);

// ── Qui appose son cachet ─────────────────────────────────────────────────
test("le cachet ne s'imprime que pour le poste du compte qui imprime", () => {
  const comptable = { cle: "comptable", nom: "", cachet: CACHET };
  assert.deepEqual(cachets("recu", comptable), ["comptable:cachet"]);
  // États de salaires : le comptable appose le sien, le visa de la Direction reste à signer.
  assert.deepEqual(cachets("etatSalaires", comptable), ["comptable:cachet", "direction:-"]);
  // La Direction imprime un reçu : le comptable reste signataire, SANS son cachet.
  assert.deepEqual(cachets("recu", { cle: "direction", nom: "", cachet: "https://autre" }), ["comptable:-"]);
  // Un second comptable sans cachet n'emprunte pas celui du premier.
  assert.deepEqual(cachets("recu", { cle: "comptable", nom: "Alpha Barry", cachet: "" }), ["comptable:-"]);
  assert.deepEqual(cachets("recu", null), ["comptable:-"]);
});

test("chef de section : son cachet sur les documents de SA section seulement", () => {
  const chefPrimaire = { cle: "primaire", nom: "", cachet: CACHET };
  assert.deepEqual(cachets("bulletin", chefPrimaire, "primaire"), ["primaire:cachet"]);
  assert.deepEqual(cachets("bulletin", chefPrimaire, "prescolaire"), ["primaire:cachet"]);
  assert.deepEqual(cachets("bulletin", chefPrimaire, "college"), ["college:-"]);
  assert.deepEqual(cachets("attestation", { cle: "college", nom: "", cachet: CACHET }, "lycee"), ["college:cachet"]);
});

test("la matrice décide : un reçu confié à la Direction ne porte plus le cachet du comptable", () => {
  const info = { ...ecole, signatures: { recu: { principal: "direction", visa: "comptable" } } };
  // Visa du comptable qui imprime : son cachet va sur SON bloc.
  assert.deepEqual(cachets("recu", { cle: "comptable", nom: "", cachet: CACHET }, "college", info),
    ["direction:-", "comptable:cachet"]);
});

test("session : un cachet sans nom propre suffit à désigner le compte qui imprime", () => {
  try {
    definirSignataireSession({ cle: "comptable", nom: "", cachet: CACHET });
    assert.deepEqual(signataireSession(), { cle: "comptable", nom: "", cachet: CACHET });
    const [s] = signatairesDocument(ecole, "recu");
    assert.equal(s.nom, "Aïssatou Bah", "sans nom propre, le responsable du poste");
    assert.equal(s.cachet, CACHET);
  } finally {
    definirSignataireSession(null);
  }
  assert.equal(signatairesDocument(ecole, "recu")[0].cachet, "");
});

test("seuls la comptabilité et les chefs de section déposent un cachet", () => {
  for (const cle of ["comptable", "primaire", "college"]) assert.equal(peutDeposerCachet(cle), true, cle);
  for (const cle of ["direction", "admin", "surveillant", "enseignant", "parent", "superadmin", "", undefined]) {
    assert.equal(peutDeposerCachet(cle), false, String(cle));
  }
});

// ── Rendu ─────────────────────────────────────────────────────────────────
test("cachetOuEspace : l'image à la place de l'espace à signer, URL échappée", () => {
  assert.equal(cachetOuEspace({ cachet: "" }), "<br/><br/><br/>");
  assert.equal(cachetOuEspace(null, "<br/>"), "<br/>");
  const html = cachetOuEspace({ cachet: 'https://x/a.png" onerror="alert(1)' }, "", "16mm");
  assert.match(html, /^<img crossOrigin="anonymous" src="https:\/\/x\/a.png&quot; onerror=&quot;alert\(1\)"/);
  assert.match(html, /height:16mm/);
});

test("reçu : le cachet du comptable qui imprime, et lui seul", () => {
  const recu = () => blocRecu("Exemplaire — Payant", {
    schoolInfo: ecole, lf: {}, eleve: { nom: "DIALLO", prenom: "Aïssatou", classe: "6ème A" },
    moisAnnee: ["Octobre"], mens: { Octobre: "Payé" }, mensDates: {},
    fraisIns: 0, fraisAutre: 0, fraisDiversPayes: [], totalMensualites: 150000,
    moisPayes: ["Octobre"], totalGeneral: 150000, qr: "",
  });
  try {
    definirSignataireSession({ cle: "comptable", nom: "Binta Camara", cachet: CACHET });
    assert.equal(recu().split(CACHET).length - 1, 1);
    definirSignataireSession({ cle: "direction", nom: "Fatou Sylla", cachet: CACHET });
    assert.ok(!recu().includes(CACHET));
  } finally {
    definirSignataireSession(null);
  }
});

test("bulletin : le cachet du chef de section passe avant la signature de l'école", () => {
  const info = { ...ecole, signatureUrl: "https://x/ecole.png" };
  const rendu = () => {
    const vues = [];
    signaturesBulletin(info, "primaire", ({ image }) => { vues.push(image || ""); return ""; });
    return vues.slice(1); // l'enseignant (maître titulaire) d'abord ; le parent ne signe pas
  };
  try {
    assert.deepEqual(rendu(), ["https://x/ecole.png"]);
    definirSignataireSession({ cle: "primaire", nom: "", cachet: CACHET });
    assert.deepEqual(rendu(), [CACHET]);
    // Le chef du collège qui imprime un bulletin du primaire : signature de l'école.
    definirSignataireSession({ cle: "college", nom: "", cachet: CACHET });
    assert.deepEqual(rendu(), ["https://x/ecole.png"]);
  } finally {
    definirSignataireSession(null);
  }
});

// ── Écran « Mon cachet » ──────────────────────────────────────────────────
test("documents concernés : ceux que le poste signe d'après la matrice", () => {
  const compta = documentsSignesPar(ecole, "comptable");
  assert.ok(compta.includes("Reçu de paiement") && compta.includes("États de salaires") && compta.includes("Préavis de renvoi"));
  assert.ok(!compta.includes("Bulletin"));
  const primaire = documentsSignesPar(ecole, "primaire");
  assert.deepEqual(primaire, ["Bulletin", "Fiche de compositions", "Attestation / Certificat de niveau"]);
  // Reçu confié à la Direction : il sort de la liste du comptable.
  const info = { ...ecole, signatures: { recu: { principal: "direction", visa: null } } };
  assert.ok(!documentsSignesPar(info, "comptable").includes("Reçu de paiement"));
  assert.deepEqual(documentsSignesPar(ecole, ""), []);
});

test("aperçu : titre et nom tels qu'ils s'imprimeront", () => {
  assert.deepEqual(identiteApercu(ecole, "comptable"), { titre: "Comptable", nom: "Aïssatou Bah" });
  assert.deepEqual(identiteApercu(ecole, "comptable", "Binta Camara"), { titre: "Comptable", nom: "Binta Camara" });
  assert.equal(identiteApercu(ecole, "surveillant"), null);
});

// ── Nettoyage de la photo ─────────────────────────────────────────────────
test("photo du cachet : le papier gris devient transparent, l'encre reste, recadrée", () => {
  const L = 40; const H = 30;
  const px = new Uint8ClampedArray(L * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) {
      const i = (y * L + x) * 4;
      const encre = x >= 15 && x < 25 && y >= 10 && y < 20;
      // Papier photographié : gris clair inégal ; encre bleue.
      const [r, g, b] = encre ? [30, 60, 160] : [190 + (x % 3), 188, 185];
      px.set([r, g, b, 255], i);
    }
  }
  const cadre = effacerFondPapier(px, L, H);
  assert.deepEqual(cadre, { x: 9, y: 4, l: 22, h: 22 });
  assert.equal(px[(5 * L + 5) * 4 + 3], 0, "papier transparent");
  assert.equal(px[(15 * L + 20) * 4 + 3], 255, "encre opaque");
  assert.equal(effacerFondPapier(new Uint8ClampedArray(16), 2, 2), null, "image vide");
});

test("photo mal éclairée : l'ombre et les grains du papier ne comptent pas comme de l'encre", () => {
  const L = 200; const H = 120;
  const px = new Uint8ClampedArray(L * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) {
      const i = (y * L + x) * 4;
      // Papier éclairé à gauche, dans l'ombre à droite (205 → 150), grains épars.
      const papier = Math.round(205 - (55 * x) / L) - ((x * 7 + y * 13) % 29 === 0 ? 12 : 0);
      // Un trait de signature au milieu, de 3 px d'épaisseur.
      const encre = x >= 60 && x < 140 && Math.abs(y - (60 + Math.round(15 * Math.sin(x / 9)))) <= 1;
      px.set(encre ? [20, 40, 140, 255] : [papier, papier, papier - 4, 255], i);
    }
  }
  const cadre = effacerFondPapier(px, L, H);
  assert.deepEqual([cadre.x, cadre.l], [54, 92], "recadré sur le trait, pas sur l'ombre");
  assert.equal(px[(10 * L + 195) * 4 + 3], 0, "papier dans l'ombre transparent");
  const yTrait = 60 + Math.round(15 * Math.sin(100 / 9));
  assert.equal(px[(yTrait * L + 100) * 4 + 3] > 200, true, "encre opaque");
});

// ── Base : seul le titulaire écrit son cachet ─────────────────────────────
test("migration : cachet_url réservé au titulaire du compte", () => {
  const dossier = new URL("../supabase/migrations/", import.meta.url);
  const fichier = readdirSync(dossier).find((f) => f.endsWith("_cachet_personnel.sql"));
  const sql = readFileSync(new URL(fichier, dossier), "utf8");
  assert.match(sql, /add column if not exists cachet_url text/);
  assert.match(sql, /old\.user_id is distinct from auth\.uid\(\)/);
  assert.match(sql, /errcode = '42501'/);
  assert.match(sql, /revoke all on function public\.comptes_cachet_guard\(\) from public, anon, authenticated/);
  assert.match(sql, /before insert or update on public\.comptes/);
  // comptes_guard n'est jamais réécrit (cf. faille d'amorçage du 2026-09-25).
  assert.doesNotMatch(sql, /function public\.comptes_guard\(/);
});
