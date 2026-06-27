// ════════════════════════════════════════════════════════════════════════
//  EduGest — Migration Firebase (Firestore) → Supabase (Postgres)   [P3]
// ════════════════════════════════════════════════════════════════════════
// Lit la base Firebase (clé de service) et recopie dans Supabase via la clé
// service_role. Robuste : chaque champ inconnu est conservé dans la colonne
// `extra` (jsonb). Idempotence limitée — à lancer sur une base Supabase vide
// (ou une école à la fois).
//
// MOTS DE PASSE : option (a) retenue → on crée les comptes auth avec un mot de
// passe ALÉATOIRE et premiere_co=true. Chaque utilisateur redéfinit le sien à
// la première connexion (comme le flux actuel).
//
// Prérequis :
//   - supabase/config.local.mjs renseigné (url + serviceRole)
//   - clé de service Firebase : un *firebase-adminsdk*.json dans supabase/
// Lancer :
//   node supabase/migrate.mjs            (toutes les écoles)
//   node supabase/migrate.mjs lacitadelle  (une seule école, par son code)
// ════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const onlySchool = process.argv[2] || null;            // code d'école optionnel

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Renseigne url + serviceRole dans supabase/config.local.mjs."); process.exit(1);
}

// ── Init Firebase Admin (clé de service auto-détectée) ─────────────────────
const svcFile = readdirSync(HERE).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!svcFile) { console.error("❌ Clé de service Firebase (*firebase-adminsdk*.json) introuvable dans supabase/."); process.exit(1); }
const svc = JSON.parse(readFileSync(join(HERE, svcFile), "utf8"));
admin.initializeApp({ credential: admin.credential.cert(svc) });
const fdb = admin.firestore();

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Helpers ─────────────────────────────────────────────────────────────────
const SECTIONS = [["primaire", "Primaire"], ["college", "College"], ["lycee", "Lycee"]];
const stats = {};
const bump = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };
const rnd = () => "Tmp-" + Math.random().toString(36).slice(2, 10) + "A9!";
// Conserve les champs non mappés dans `extra`.
const rest = (d, known) => {
  const e = {}; for (const k of Object.keys(d)) if (!known.includes(k)) e[k] = d[k]; return e;
};
async function insertChunked(table, rows) {
  if (!rows.length) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await sb.from(table).insert(rows.slice(i, i + 500)).select("id");
    if (error) { console.warn(`  ⚠ ${table}:`, error.message); continue; }
    out.push(...data);
  }
  return out;
}

async function migrerEcole(code, d) {
  console.log(`\n━━ École « ${code} » ━━`);
  // 1) École
  const { data: ecole, error } = await sb.from("ecoles").upsert({
    code,
    nom: d.nom || code,
    logo: d.logo || null,
    couleur1: d.couleur1 || null,
    couleur2: d.couleur2 || null,
    pays: d.pays || null,
    devise: d.devise || null,
    plan: d.plan || "gratuit",
    plan_expiry: Number.isInteger(d.planExpiry) ? d.planExpiry : null,
    modele_bulletin: d.modeleBulletin || "classique",
    role_settings: d.roleSettings || {},
    legal: d.legal || {},
    actif: d.actif !== false,
    supprime: d.supprime === true,
    extra: rest(d, ["nom","logo","couleur1","couleur2","pays","devise","plan","planExpiry","modeleBulletin","roleSettings","legal","actif","supprime"]),
  }, { onConflict: "code" }).select().single();
  if (error) { console.error("  ❌ école:", error.message); return; }
  const ecoleId = ecole.id;
  bump("ecoles");

  const ref = fdb.collection("ecoles").doc(code);
  const eleveMap = {};   // firestoreId → uuid
  const ensMap = {};     // firestoreId → uuid (enseignants)
  const getColl = async (name) => (await ref.collection(name).get()).docs;

  for (const [section, Cap] of SECTIONS) {
    // Enseignants (registre)
    for (const s of await getColl(`ens${Cap}`)) {
      const x = s.data();
      const { data } = await sb.from("enseignants").insert({
        ecole_id: ecoleId, section, nom: x.nom || null, prenom: x.prenom || null,
        matiere: x.matiere || null, classe_title: x.classeTitle || null, contact: x.contact || null,
        statut: x.statut || "Actif",
        extra: { firestore_id: s.id, ...rest(x, ["nom","prenom","matiere","classeTitle","contact","statut"]) },
      }).select("id").single();
      if (data) { ensMap[s.id] = data.id; bump("enseignants"); }
    }
    // Classes
    const classes = (await getColl(`classes${Cap}`)).map((s) => {
      const x = s.data();
      return { ecole_id: ecoleId, section, nom: x.nom || "?", effectif: Number(x.effectif || 0),
        enseignant: x.enseignant || null, salle: x.salle || null,
        extra: rest(x, ["nom","effectif","enseignant","salle"]) };
    });
    bump("classes", (await insertChunked("classes", classes)).length);
    // Matières
    const matieres = (await getColl(`classes${Cap}_matieres`)).map((s) => {
      const x = s.data();
      return { ecole_id: ecoleId, section, nom: x.nom || "?", coefficient: Number(x.coefficient || 1),
        classes: Array.isArray(x.classes) ? x.classes : [], extra: rest(x, ["nom","coefficient","classes"]) };
    });
    bump("matieres", (await insertChunked("matieres", matieres)).length);
    // Emplois du temps
    const emplois = (await getColl(`classes${Cap}_emplois`)).map((s) => {
      const x = s.data();
      return { ecole_id: ecoleId, section, classe: x.classe || null, jour: x.jour || null,
        heure_debut: x.heureDebut || x.heure || null, heure_fin: x.heureFin || null,
        matiere: x.matiere || null, enseignant: x.enseignant || null, salle: x.salle || null,
        extra: rest(x, ["classe","jour","heureDebut","heure","heureFin","matiere","enseignant","salle"]) };
    });
    bump("emplois", (await insertChunked("emplois", emplois)).length);
    // Cahier de textes
    const enseignements = (await getColl(`ens${Cap}_enseignements`)).map((s) => {
      const x = s.data();
      return { ecole_id: ecoleId, section, classe: x.classe || null, matiere: x.matiere || null,
        enseignant_nom: x.enseignantNom || null, date: Number.isInteger(x.date) ? x.date : null,
        contenu: x.contenu || null, extra: rest(x, ["classe","matiere","enseignantNom","date","contenu"]) };
    });
    bump("enseignements", (await insertChunked("enseignements", enseignements)).length);

    // Élèves (+ paiements embarqués) — on insère un par un pour récupérer l'id.
    const paiements = [];
    for (const s of await getColl(`eleves${Cap}`)) {
      const x = s.data();
      const { data, error: e } = await sb.from("eleves").insert({
        ecole_id: ecoleId, section, nom: x.nom || null, prenom: x.prenom || null,
        sexe: (x.sexe === "F" || x.sexe === "M") ? x.sexe : null,
        matricule: x.matricule || null, ien: x.ien || null, classe: x.classe || null,
        date_naissance: x.dateNaissance || null, lieu_naissance: x.lieuNaissance || null,
        filiation: x.filiation || null, tuteur: x.tuteur || null, contact_tuteur: x.contactTuteur || null,
        domicile: x.domicile || null, photo: x.photo || null, statut: x.statut || "Actif",
        extra: rest(x, ["nom","prenom","sexe","matricule","ien","classe","dateNaissance","lieuNaissance","filiation","tuteur","contactTuteur","domicile","photo","statut"]),
      }).select("id").single();
      if (e || !data) { console.warn("  ⚠ eleve:", e?.message); continue; }
      eleveMap[s.id] = data.id; bump("eleves");
      // Paiements depuis le champ `mens` (et dates `mensDates`).
      const mens = x.mens || {}; const dates = x.mensDates || {};
      for (const mois of Object.keys(mens)) {
        paiements.push({ ecole_id: ecoleId, eleve_id: data.id, mois,
          statut: mens[mois] === "Payé" ? "Payé" : "Impayé", date_paiement: dates[mois] || null });
      }
    }
    bump("paiements", (await insertChunked("paiements", paiements)).length);

    // Notes (mappées sur eleve_id)
    const notes = [];
    for (const s of await getColl(`notes${Cap}`)) {
      const x = s.data(); const eid = eleveMap[x.eleveId];
      if (!eid) { bump("notes_orphelines"); continue; }
      notes.push({ ecole_id: ecoleId, section, eleve_id: eid, matiere: x.matiere || "?",
        type: x.type || "Devoir", periode: x.periode || "?", note: Number(x.note || 0),
        annee: x.annee || "2025-2026", enseignant_nom: x.enseignantNom || null,
        extra: rest(x, ["eleveId","matiere","type","periode","note","annee","enseignantNom","enseignantId","eleveNom","section","updatedAt","createdAt"]) });
    }
    bump("notes", (await insertChunked("notes", notes)).length);

    // Absences / incidents
    const absences = [];
    for (const s of await getColl(`eleves${Cap}_absences`)) {
      const x = s.data(); const eid = eleveMap[x.eleveId];
      if (!eid) { bump("absences_orphelines"); continue; }
      absences.push({ ecole_id: ecoleId, section, eleve_id: eid, type: x.type || "Absence",
        date: x.date || null, justifie: x.justifie || "Non", motif: x.motif || null,
        matiere: x.matiere || null, signale_par_nom: x.signaledByEnseignantNom || null,
        extra: rest(x, ["eleveId","type","date","justifie","motif","matiere","signaledByEnseignantNom","signaledByEnseignantId","eleveNom","classe"]) });
    }
    bump("absences", (await insertChunked("absences", absences)).length);

    // Appréciations
    const apprs = [];
    for (const s of await getColl(`appreciations${Cap}`)) {
      const x = s.data(); const eid = eleveMap[x.eleveId];
      if (!eid) continue;
      apprs.push({ ecole_id: ecoleId, section, eleve_id: eid, periode: x.periode || "?",
        texte: x.texte || x.appreciation || x.contenu || null, extra: rest(x, ["eleveId","periode","texte","appreciation","contenu"]) });
    }
    bump("appreciations", (await insertChunked("appreciations", apprs)).length);
  }

  // Salaires (école entière)
  const salaires = (await getColl("salaires")).map((s) => {
    const x = s.data();
    return { ecole_id: ecoleId, nom: x.nom || null, section: x.section || null, mois: x.mois || null,
      montant_net: Number(x.totalNet || x.montantNet || 0), details: rest(x, ["nom","section","mois","totalNet","montantNet"]) };
  });
  bump("salaires", (await insertChunked("salaires", salaires)).length);

  // Comptes → utilisateurs auth (mot de passe aléatoire, reset à la 1re connexion)
  for (const s of await getColl("comptes")) {
    const x = s.data();
    const login = x.login; if (!login) continue;
    const email = `${login}.${code}@edugest.app`;
    let userId;
    const { data: created, error: e } = await sb.auth.admin.createUser({ email, password: rnd(), email_confirm: true });
    if (e && !/already|exists|registered/i.test(e.message)) { console.warn("  ⚠ auth:", login, e.message); continue; }
    userId = created?.user?.id;
    if (!userId) { const { data: l } = await sb.auth.admin.listUsers(); userId = l.users.find((u) => u.email === email)?.id; }
    if (!userId) continue;
    await sb.from("comptes").upsert({
      user_id: userId, ecole_id: ecoleId, login, role: x.role || "parent",
      nom: x.nom || login, label: x.label || null, section: x.section || null,
      enseignant_id: ensMap[x.enseignantId] || null, enseignant_nom: x.enseignantNom || null,
      matiere: x.matiere || null, statut: x.statut || "Actif", premiere_co: true,
      extra: rest(x, ["login","role","nom","label","section","sections","enseignantId","enseignantNom","matiere","statut","mdp","uid","premiereCo"]),
    }, { onConflict: "user_id" });
    bump("comptes");
    // Liens parent → élèves
    const ids = [...(Array.isArray(x.eleveIds) ? x.eleveIds : []),
      ...(Array.isArray(x.elevesAssocies) ? x.elevesAssocies.map((a) => a?.eleveId).filter(Boolean) : []),
      ...(x.eleveId ? [x.eleveId] : [])];
    const { data: cpt } = await sb.from("comptes").select("id").eq("user_id", userId).single();
    const liens = [...new Set(ids)].map((fid) => eleveMap[fid]).filter(Boolean)
      .map((eid) => ({ compte_id: cpt.id, eleve_id: eid }));
    if (liens.length) await sb.from("parent_eleves").upsert(liens, { onConflict: "compte_id,eleve_id" });
  }
}

async function main() {
  const ecolesSnap = await fdb.collection("ecoles").get();
  const docs = ecolesSnap.docs.filter((d) => !onlySchool || d.id === onlySchool);
  if (!docs.length) { console.error("❌ Aucune école" + (onlySchool ? ` avec le code « ${onlySchool} »` : "") + "."); process.exit(1); }
  console.log(`Migration de ${docs.length} école(s)…`);
  for (const d of docs) await migrerEcole(d.id, d.data());
  console.log("\n════ RÉCAPITULATIF ════");
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
  console.log("\n✅ Migration terminée.");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
