// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes RLS des postes flexibles (postes.sql)
// ═══════════════════════════════════════════════════════════════════════════
// Crée deux comptes de test JETABLES sur l'École Démo (comptable, surveillant),
// vérifie que les droits par module sont appliqués PAR LA BASE (pas l'UI),
// puis supprime tout. Lancer : node supabase/test-rls-postes.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const mdp = () => "T!" + randomBytes(12).toString("base64url");

let echecs = 0;
const attendu = (nom, ok) => { console.log(`  ${ok ? "✅" : "❌"} ${nom}`); if (!ok) { echecs++; } };

async function main() {
  const { data: demo } = await svc.from("ecoles").select("id, code").eq("code", "demo").single();
  const { data: postes } = await svc.from("postes").select("id, cle").eq("ecole_id", demo.id);
  const posteId = Object.fromEntries(postes.map((p) => [p.cle, p.id]));
  const { data: eleve } = await svc.from("eleves").select("id, section, classe").eq("ecole_id", demo.id).limit(1).maybeSingle();

  // Ligne compta témoin (pour tester la LECTURE : RLS select = silence, pas erreur).
  const { data: temoin } = await svc.from("recettes").insert({ ecole_id: demo.id, extra: { libelle: "TEST-RLS-TEMOIN" } }).select("id").single();

  const comptesTests = [];
  const sessions = {};
  for (const cle of ["comptable", "surveillant"]) {
    const login = `test-rls-${cle}`;
    const email = `${login}.demo@edugest.app`;
    const pass = mdp();
    let { data: u, error: e } = await svc.auth.admin.createUser({ email, password: pass, email_confirm: true });
    if (e) { // déjà présent d'un run précédent
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      u = { user: list.users.find((x) => x.email === email) };
      await svc.auth.admin.updateUserById(u.user.id, { password: pass });
    }
    await svc.from("comptes").delete().eq("user_id", u.user.id);
    const { data: c } = await svc.from("comptes").insert({
      user_id: u.user.id, ecole_id: demo.id, login, role: cle, nom: `Test RLS ${cle}`,
      label: cle, poste_id: posteId[cle], premiere_co: false,
    }).select("id").single();
    comptesTests.push({ compteId: c.id, userId: u.user.id });

    const cli = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: se } = await cli.auth.signInWithPassword({ email, password: pass });
    if (se) { console.error(`connexion ${cle} impossible: ${se.message}`); process.exit(1); }
    sessions[cle] = cli;
  }

  console.log("\n— Poste COMPTABLE (compta: écriture) —");
  const co = sessions.comptable;
  const { data: coRecettes } = await co.from("recettes").select("id");
  attendu("lit les recettes (≥1 ligne)", (coRecettes || []).length >= 1);
  const { data: coIns, error: coInsErr } = await co.from("recettes").insert({ ecole_id: demo.id, extra: { libelle: "TEST-RLS-CO" } }).select("id").single();
  attendu("crée une recette", !coInsErr && !!coIns);
  if (coIns) await svc.from("recettes").delete().eq("id", coIns.id);
  if (eleve) {
    const { error: coNote } = await co.from("notes").insert({
      ecole_id: demo.id, section: eleve.section, eleve_id: eleve.id, matiere: "Test", type: "Devoir", valeur: 10, periode: "T1",
    });
    attendu("REFUS d'écrire une note", !!coNote);
  }
  const { error: coEcole } = await co.from("ecoles").update({ nom: "HACK" }).eq("id", demo.id).select("id").maybeSingle();
  const { data: nomApres } = await svc.from("ecoles").select("nom").eq("id", demo.id).single();
  attendu("REFUS de modifier l'école", !!coEcole || nomApres.nom !== "HACK");

  console.log("\n— Poste SURVEILLANT (primaire/secondaire/calendrier: écriture) —");
  const su = sessions.surveillant;
  const { data: suRecettes } = await su.from("recettes").select("id");
  attendu("ne voit AUCUNE recette", (suRecettes || []).length === 0);
  const { error: suRec } = await su.from("recettes").insert({ ecole_id: demo.id, extra: { libelle: "TEST-RLS-SU" } });
  attendu("REFUS de créer une recette", !!suRec);
  const { data: suSalaires } = await su.from("salaires").select("id");
  attendu("ne voit AUCUN salaire", (suSalaires || []).length === 0);
  if (eleve) {
    const { data: suAbs, error: suAbsErr } = await su.from("absences").insert({
      ecole_id: demo.id, section: eleve.section, eleve_id: eleve.id, type: "Absence", date: "2026-07-16", motif: "TEST-RLS",
    }).select("id").single();
    attendu("crée une absence (discipline)", !suAbsErr && !!suAbs);
    if (suAbsErr) console.log(`     ↳ erreur: ${suAbsErr.message}`);
    if (suAbs) await svc.from("absences").delete().eq("id", suAbs.id);
  }
  const { data: suPoste, error: suPosteErr } = await su.from("comptes")
    .update({ poste_id: posteId.direction }).eq("user_id", comptesTests[1].userId).select("id");
  attendu("REFUS de changer son propre poste", !!suPosteErr || !(suPoste || []).length);

  console.log("\n— PARENT rattaché (à tort) au poste direction —");
  // Même si un poste_id traîne sur un compte parent, il ne doit RIEN ouvrir.
  {
    const login = "test-rls-parent";
    const email = `${login}.demo@edugest.app`;
    const pass = mdp();
    let { data: u, error: e } = await svc.auth.admin.createUser({ email, password: pass, email_confirm: true });
    if (e) {
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      u = { user: list.users.find((x) => x.email === email) };
      await svc.auth.admin.updateUserById(u.user.id, { password: pass });
    }
    await svc.from("comptes").delete().eq("user_id", u.user.id);
    const { data: c } = await svc.from("comptes").insert({
      user_id: u.user.id, ecole_id: demo.id, login, role: "parent", nom: "Test RLS parent",
      label: "parent", poste_id: posteId.direction, premiere_co: false,
    }).select("id").single();
    comptesTests.push({ compteId: c.id, userId: u.user.id });
    const pa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: pe } = await pa.auth.signInWithPassword({ email, password: pass });
    if (pe) { console.error(`connexion parent impossible: ${pe.message}`); process.exit(1); }
    const { data: paRecettes } = await pa.from("recettes").select("id");
    attendu("ne voit AUCUNE recette malgré le poste direction", (paRecettes || []).length === 0);
    const { error: paRec } = await pa.from("recettes").insert({ ecole_id: demo.id, extra: { libelle: "TEST-RLS-PA" } });
    attendu("REFUS de créer une recette", !!paRec);
  }

  // ── Nettoyage complet ──
  await svc.from("recettes").delete().eq("id", temoin.id);
  for (const t of comptesTests) {
    await svc.from("comptes").delete().eq("id", t.compteId);
    await svc.auth.admin.deleteUser(t.userId);
  }
  console.log(`\nNettoyage fait. ${echecs === 0 ? "🎉 TOUTES LES SONDES PASSENT" : `⚠️ ${echecs} sonde(s) en échec`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
