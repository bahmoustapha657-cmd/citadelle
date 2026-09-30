// ════════════════════════════════════════════════════════════════════════
//  EduGest — Sonde : l'enseignant lit SES fiches de paie (RLS)
// ════════════════════════════════════════════════════════════════════════
// Vérifie salaires-enseignant.sql sur la base réelle, avec l'école DEMO :
//   1. crée une fiche enseignant, deux comptes enseignants temporaires
//      (l'intéressé, rattaché à la fiche, et un collègue) et trois fiches de
//      paie marquées mois = TEST-PAIE ;
//   2. se connecte comme un VRAI client (clé anon) et vérifie :
//      ses fiches → lues (casse, accents, suffixe « (prof) », nom de la
//      fiche enseignant renommée) ; celle du collègue → invisible ;
//      écriture (insert / update / delete) → refusée ; changer son propre
//      nom pour celui du collègue → refusé (comptes_guard) ;
//      mes_noms_paie() → fermée à anon ; un surveillant et un parent qui
//      portent EXACTEMENT le nom d'une fiche → rien (la policy n'ouvre rien
//      à qui n'est pas enseignant ; DEMO n'ayant aucune fiche de paie, le
//      contrôle « surveillant » de test-rls-postes.mjs ne le prouve pas) ;
//   3. NETTOIE tout (fiches, comptes, auth, fiche enseignant) même en cas
//      d'échec.
//
// Lancer : node supabase/test-salaires-enseignant.mjs   (config.local.mjs requis,
// salaires-enseignant.sql exécuté au préalable)
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { emailFor } from "./_brand.mjs";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const CODE = "demo";
const PASSWORD = "TestPaie#2026!";
const PROF_LOGIN = "test.paie.prof";
const COLLEGUE_LOGIN = "test.paie.collegue";
const SURVEILLANT_LOGIN = "test.paie.surveillant";
const PARENT_LOGIN = "test.paie.parent";
const LOGINS = [PROF_LOGIN, COLLEGUE_LOGIN, SURVEILLANT_LOGIN, PARENT_LOGIN];
const MOIS = "TEST-PAIE";
const FICHE_NOM = "Test-Paie Renommée"; // nom ACTUEL de la fiche (renommée)

let echecs = 0;
function verifier(libelle, ok, detail = "") {
  echecs += ok ? 0 : 1;
  console.log(`${ok ? "✓" : "✗"} ${libelle}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── Nettoyage (idempotent : purge aussi les restes d'un run interrompu) ─────
async function nettoyer(ecoleId) {
  await admin.from("salaires").delete().eq("ecole_id", ecoleId).eq("mois", MOIS);
  const { data: comptes } = await admin.from("comptes").select("id, user_id")
    .eq("ecole_id", ecoleId).in("login", LOGINS);
  for (const c of comptes || []) {
    await admin.from("comptes").delete().eq("id", c.id);
    if (c.user_id) await admin.auth.admin.deleteUser(c.user_id).catch(() => {});
  }
  await admin.from("enseignants").delete().eq("ecole_id", ecoleId).eq("nom", FICHE_NOM);
}

// enseignant_nom est posé quel que soit le rôle : le pire cas pour la policy.
async function creerCompte(ecoleId, login, { nom, role = "enseignant", enseignantId = null }) {
  const email = emailFor(login, CODE);
  const { data: u, error: e1 } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (e1) throw new Error(`createUser ${login}: ${e1.message}`);
  const { data: compte, error: e2 } = await admin.from("comptes").insert({
    user_id: u.user.id, ecole_id: ecoleId, login, role,
    section: role === "enseignant" ? "college" : null,
    nom, enseignant_nom: nom, enseignant_id: enseignantId,
  }).select("id").single();
  if (e2) throw new Error(`compte ${login}: ${e2.message}`);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e3) throw new Error(`login ${login}: ${e3.message}`);
  return { client, compteId: compte.id };
}

const fiche = (ecoleId, nom) => ({
  ecole_id: ecoleId, nom, section: "Secondaire", mois: MOIS, montant_net: 1000, details: {},
});

async function main() {
  const { data: ecole } = await admin.from("ecoles").select("id").eq("code", CODE).single();
  if (!ecole) throw new Error(`École ${CODE} introuvable.`);
  await nettoyer(ecole.id);

  const { data: ens, error: eEns } = await admin.from("enseignants").insert({
    ecole_id: ecole.id, section: "college", prenom: "Aïssatou", nom: FICHE_NOM, statut: "Actif",
  }).select("id").single();
  if (eEns) throw new Error(`fiche enseignant: ${eEns.message}`);

  const prof = await creerCompte(ecole.id, PROF_LOGIN, { nom: "Aïssatou Test-Paie", enseignantId: ens.id });
  const collegue = await creerCompte(ecole.id, COLLEGUE_LOGIN, { nom: "Sékou Test-Paie" });
  // Surveillant (rôle legacy, sans compta) payé sur une fiche « Personnel » ;
  // parent homonyme de l'enseignant.
  const surveillant = await creerCompte(ecole.id, SURVEILLANT_LOGIN, { nom: "Mariama Test-Paie", role: "surveillant" });
  const parent = await creerCompte(ecole.id, PARENT_LOGIN, { nom: "Aïssatou Test-Paie", role: "parent" });

  const { data: fiches, error: eFi } = await admin.from("salaires").insert([
    fiche(ecole.id, "AÏSSATOU  test-paie (prof)"),   // compte : casse, accents, espaces, suffixe
    fiche(ecole.id, `Aïssatou ${FICHE_NOM}`),        // fiche enseignant renommée
    fiche(ecole.id, "Sékou Test-Paie"),              // le collègue
    { ...fiche(ecole.id, "Mariama Test-Paie"), section: "Personnel" }, // le surveillant
  ]).select("id, nom");
  if (eFi) throw new Error(`fiches de paie: ${eFi.message}`);
  const [s1, s2, s3] = fiches;

  try {
    const lues = async (client) => {
      const { data, error } = await client.from("salaires").select("id").eq("mois", MOIS);
      return { ids: (data || []).map((r) => r.id).sort(), error };
    };

    const p = await lues(prof.client);
    verifier("prof : lit SES deux fiches (nom du compte normalisé + nom de sa fiche)",
      !p.error && JSON.stringify(p.ids) === JSON.stringify([s1.id, s2.id].sort()), p.error?.message || `lues=${p.ids.length}`);
    verifier("prof : la fiche du collègue reste invisible", !p.ids.includes(s3.id));

    const c = await lues(collegue.client);
    verifier("collègue : ne lit que la sienne",
      !c.error && JSON.stringify(c.ids) === JSON.stringify([s3.id]), c.error?.message || `lues=${c.ids.length}`);

    const sv = await lues(surveillant.client);
    verifier("surveillant (hors compta) : AUCUNE fiche, pas même à son nom",
      !sv.error && sv.ids.length === 0, sv.error?.message || `lues=${sv.ids.length}`);
    const pa = await lues(parent.client);
    verifier("parent homonyme de l'enseignant : AUCUNE fiche",
      !pa.error && pa.ids.length === 0, pa.error?.message || `lues=${pa.ids.length}`);

    const { error: w1 } = await prof.client.from("salaires").insert(fiche(ecole.id, "Aïssatou Test-Paie"));
    verifier("prof : créer une fiche de paie → refusé", !!w1);
    const { data: w2 } = await prof.client.from("salaires")
      .update({ montant_net: 999999 }).eq("id", s1.id).select("id");
    verifier("prof : modifier SA fiche → refusé (0 ligne)", !w2?.length);
    const { data: w3 } = await prof.client.from("salaires").delete().eq("id", s1.id).select("id");
    verifier("prof : supprimer SA fiche → refusé (0 ligne)", !w3?.length);
    const { data: intacte } = await admin.from("salaires").select("montant_net").eq("id", s1.id).maybeSingle();
    verifier("fiche intacte après les tentatives", Number(intacte?.montant_net) === 1000, JSON.stringify(intacte));

    const { error: g1 } = await prof.client.from("comptes")
      .update({ enseignant_nom: "Sékou Test-Paie" }).eq("id", prof.compteId);
    const apres = await lues(prof.client);
    verifier("prof : prendre le nom du collègue → refusé (comptes_guard)",
      !!g1 && !apres.ids.includes(s3.id), g1 ? "" : "mise à jour acceptée");

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: r1 } = await anon.rpc("mes_noms_paie");
    verifier("anon : mes_noms_paie() → refusée", !!r1);
  } finally {
    await nettoyer(ecole.id);
    console.log("\n(nettoyage effectué)");
  }

  if (echecs) { console.error(`\n❌ ${echecs} contrôle(s) en échec.`); process.exit(1); }
  console.log("\n✅ Fiches de paie : chaque enseignant lit les siennes, et rien d'autre.");
}

main().catch(async (e) => {
  console.error("❌", e.message || e);
  try { const { data: ec } = await admin.from("ecoles").select("id").eq("code", CODE).single(); await nettoyer(ec.id); } catch {}
  process.exit(1);
});
