// ════════════════════════════════════════════════════════════════════════
//  EduGest — Test bout-en-bout du périmètre d'écriture enseignant (RLS)
// ════════════════════════════════════════════════════════════════════════
// Vérifie teacher-security.sql sur la base réelle, avec l'école DEMO :
//   1. crée 2 comptes enseignants temporaires (primaire + college) et un
//      élève college temporaire, mappe leurs classes (enseignant_classes) ;
//   2. se connecte comme un VRAI client (clé anon) et vérifie :
//      élève de ses classes → écriture OK ; élève hors classes → REFUS ;
//      secondaire : matière du profil OK, autre matière → REFUS ;
//      anti-élévation : champs de périmètre de `comptes` non modifiables ;
//   3. NETTOIE tout (notes/absences/élève/comptes/auth) même en cas d'échec.
//
// Lancer : node supabase/teacher-security-test.mjs   (config.local.mjs requis)
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { emailFor } from "./_brand.mjs";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const CODE = "demo";
const PASSWORD = "TestRls#2026!";
const T1_LOGIN = "test.rls.prof.primaire";
const T2_LOGIN = "test.rls.prof.college";
const CLASSE_TMP = "7ème Test RLS";

let echecs = 0;
function verifier(libelle, ok, detail = "") {
  echecs += ok ? 0 : 1;
  console.log(`${ok ? "✓" : "✗"} ${libelle}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── Nettoyage (idempotent : purge aussi les restes d'un run interrompu) ─────
async function nettoyer(ecoleId) {
  const { data: comptes } = await admin.from("comptes").select("id, user_id")
    .eq("ecole_id", ecoleId).in("login", [T1_LOGIN, T2_LOGIN]);
  for (const c of comptes || []) {
    await admin.from("enseignant_classes").delete().eq("compte_id", c.id);
    await admin.from("comptes").delete().eq("id", c.id);
    if (c.user_id) await admin.auth.admin.deleteUser(c.user_id).catch(() => {});
  }
  const { data: elevesTmp } = await admin.from("eleves").select("id")
    .eq("ecole_id", ecoleId).eq("classe", CLASSE_TMP);
  for (const e of elevesTmp || []) {
    await admin.from("notes").delete().eq("eleve_id", e.id);
    await admin.from("absences").delete().eq("eleve_id", e.id);
    await admin.from("eleves").delete().eq("id", e.id);
  }
  // Notes/absences de test restées sur les élèves demo (marquées par l'année).
  await admin.from("notes").delete().eq("ecole_id", ecoleId).eq("annee", "TEST-RLS");
  await admin.from("absences").delete().eq("ecole_id", ecoleId).eq("motif", "TEST-RLS");
}

async function creerEnseignant(ecoleId, login, { section, matiere, classes }) {
  const email = emailFor(login, CODE);
  const { data: u, error: e1 } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (e1) throw new Error(`createUser ${login}: ${e1.message}`);
  const { data: compte, error: e2 } = await admin.from("comptes").insert({
    user_id: u.user.id, ecole_id: ecoleId, login, role: "enseignant",
    nom: `Prof ${login}`, section, matiere,
  }).select("id").single();
  if (e2) throw new Error(`compte ${login}: ${e2.message}`);
  if (classes.length) {
    const { error: e3 } = await admin.from("enseignant_classes").insert(
      classes.map((classe) => ({ compte_id: compte.id, ecole_id: ecoleId, section, classe })));
    if (e3) throw new Error(`enseignant_classes ${login}: ${e3.message}`);
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e4 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e4) throw new Error(`login ${login}: ${e4.message}`);
  return { client, compteId: compte.id };
}

const noteDe = (ecoleId, eleve, section, matiere) => ({
  ecole_id: ecoleId, section, eleve_id: eleve.id, matiere,
  type: "Devoir", periode: "T1", note: 15, annee: "TEST-RLS",
});

async function main() {
  const { data: ecole } = await admin.from("ecoles").select("id").eq("code", CODE).single();
  if (!ecole) throw new Error(`École ${CODE} introuvable.`);
  await nettoyer(ecole.id);

  // Élèves du périmètre : CM2 (dans) vs CM2 B (hors), + un élève college temp.
  const { data: eleves } = await admin.from("eleves").select("id, classe, section")
    .eq("ecole_id", ecole.id).eq("section", "primaire");
  const dans = (eleves || []).find((e) => e.classe === "CM2");
  const hors = (eleves || []).find((e) => e.classe === "CM2 B");
  if (!dans || !hors) throw new Error("Élèves demo CM2 / CM2 B introuvables.");
  const { data: eleveClg, error: eClg } = await admin.from("eleves").insert({
    ecole_id: ecole.id, section: "college", classe: CLASSE_TMP,
    nom: "TEST", prenom: "Rls", statut: "Actif",
  }).select("id, classe").single();
  if (eClg) throw new Error(`élève college temp: ${eClg.message}`);

  const t1 = await creerEnseignant(ecole.id, T1_LOGIN,
    { section: "primaire", matiere: null, classes: ["CM2"] });
  const t2 = await creerEnseignant(ecole.id, T2_LOGIN,
    { section: "college", matiere: "Français", classes: [CLASSE_TMP] });

  try {
    // ── T1 (primaire, titulaire CM2) : périmètre de CLASSE ──────────────────
    const { data: n1, error: a1 } = await t1.client.from("notes")
      .insert(noteDe(ecole.id, dans, "primaire", "Calcul")).select("id").single();
    verifier("T1 note élève de SA classe (CM2) → acceptée", !a1, a1?.message);

    const { error: a2 } = await t1.client.from("notes")
      .insert(noteDe(ecole.id, hors, "primaire", "Calcul"));
    verifier("T1 note élève HORS classes (CM2 B) → refusée", !!a2);

    if (n1) { // saisie en lot : upsert onConflict:"id" (chemin upsertDocs)
      const { data: up, error: a3 } = await t1.client.from("notes")
        .upsert([{ id: n1.id, ...noteDe(ecole.id, dans, "primaire", "Calcul"), note: 17 }],
          { onConflict: "id" }).select("id, note");
      verifier("T1 upsert en lot (onConflict id) de SA note → accepté",
        !a3 && Number(up?.[0]?.note) === 17, a3?.message);
    }
    // upsert-création détournée vers un élève hors périmètre → refus
    const { error: a4 } = await t1.client.from("notes")
      .upsert([noteDe(ecole.id, hors, "primaire", "Calcul")], { onConflict: "id" });
    verifier("T1 upsert vers élève HORS classes → refusé", !!a4);

    const { error: a5 } = await t1.client.from("absences").insert({
      ecole_id: ecole.id, section: "primaire", eleve_id: dans.id,
      type: "Absence", date: "2026-07-01", motif: "TEST-RLS",
    });
    verifier("T1 absence élève de SA classe → acceptée", !a5, a5?.message);
    const { error: a6 } = await t1.client.from("absences").insert({
      ecole_id: ecole.id, section: "primaire", eleve_id: hors.id,
      type: "Absence", date: "2026-07-01", motif: "TEST-RLS",
    });
    verifier("T1 absence élève HORS classes → refusée", !!a6);

    // ── T2 (college, Français) : périmètre de MATIÈRE + anti-spoof section ──
    const { error: b1 } = await t2.client.from("notes")
      .insert(noteDe(ecole.id, eleveClg, "college", "Français"));
    verifier("T2 note dans SA matière (Français) → acceptée", !b1, b1?.message);
    const { error: b2 } = await t2.client.from("notes")
      .insert(noteDe(ecole.id, eleveClg, "college", "Maths"));
    verifier("T2 note dans une AUTRE matière (Maths) → refusée", !!b2);
    const { error: b3 } = await t2.client.from("notes")
      .insert(noteDe(ecole.id, eleveClg, "primaire", "Maths"));
    verifier("T2 note section falsifiée 'primaire' (esquive matière) → refusée", !!b3);

    // ── Anti-élévation : champs de périmètre de `comptes` verrouillés ───────
    const { data: g1 } = await t2.client.from("comptes")
      .update({ matiere: "Maths" }).eq("id", t2.compteId).select("matiere");
    verifier("T2 modifie SA matière de profil → refusé",
      !g1?.length || g1[0].matiere === "Français", `matiere=${g1?.[0]?.matiere}`);
    const { data: g2 } = await t1.client.from("comptes")
      .update({ premiere_co: false }).eq("id", t1.compteId).select("premiere_co");
    verifier("T1 met à jour premiere_co (flux légitime) → accepté",
      g2?.length === 1 && g2[0].premiere_co === false);
    const { error: g3 } = await t1.client.from("enseignant_classes").insert({
      compte_id: t1.compteId, ecole_id: ecole.id, section: "primaire", classe: "CM2 B",
    });
    verifier("T1 s'ajoute une classe (enseignant_classes) → refusé", !!g3);
  } finally {
    await nettoyer(ecole.id);
    console.log("\n(nettoyage effectué)");
  }

  if (echecs) { console.error(`\n❌ ${echecs} contrôle(s) en échec.`); process.exit(1); }
  console.log("\n✅ Périmètre enseignant correctement imposé par la RLS.");
}

main().catch(async (e) => {
  console.error("❌", e.message || e);
  try { const { data: ec } = await admin.from("ecoles").select("id").eq("code", CODE).single(); await nettoyer(ec.id); } catch {}
  process.exit(1);
});
