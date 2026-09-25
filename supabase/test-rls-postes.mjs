// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes RLS des postes flexibles (postes.sql)
// ═══════════════════════════════════════════════════════════════════════════
// Crée deux comptes de test JETABLES sur l'École Démo (comptable, surveillant),
// vérifie que les droits par module sont appliqués PAR LA BASE (pas l'UI),
// puis supprime tout — et remet les réglages de l'École Démo que les sondes
// basculent (blocage parents, monnaie). Lancer : node supabase/test-rls-postes.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const mdp = () => "T!" + randomBytes(12).toString("base64url");

let echecs = 0;
const attendu = (nom, ok) => { console.log(`  ${ok ? "✅" : "❌"} ${nom}`); if (!ok) { echecs++; } };
// Refus opposé PAR LA RLS (et non par le schéma : colonne inconnue, champ
// obligatoire manquant… — un tel échec ne prouve rien sur les droits).
const refusRls = (erreur) => erreur?.code === "42501";

async function main() {
  const { data: demo } = await svc.from("ecoles").select("id, code, extra").eq("code", "demo").single();
  // Réglages que les sondes de maj_reglages_compta modifient (restaurés au nettoyage).
  const reglagesInitiaux = {
    blocageParentImpaye: demo.extra?.blocageParentImpaye,
    monnaie: demo.extra?.monnaie,
  };
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
    // Une VRAIE note (colonnes exactes, `annee` comprise), refus exigé DE LA
    // RLS. L'ancienne sonde écrivait `valeur` et omettait `annee` : rejetée
    // par le schéma, elle passait même quand notes_write laissait tout le
    // personnel écrire (rejeu de teacher-security.sql, cf. restaurer-gardes.sql).
    const { data: coNote, error: coNoteErr } = await co.from("notes").insert({
      ecole_id: demo.id, section: eleve.section, eleve_id: eleve.id, matiere: "TEST-RLS", type: "Devoir",
      note: 10, periode: "T1", annee: "2025-2026",
    }).select("id");
    attendu("REFUS d'écrire une note (RLS)", refusRls(coNoteErr));
    if (!refusRls(coNoteErr)) console.log(`     ↳ ${coNoteErr ? `erreur: ${coNoteErr.message}` : "note CRÉÉE"}`);
    if (coNote?.length) await svc.from("notes").delete().in("id", coNote.map((n) => n.id));
    const { data: coAbs, error: coAbsErr } = await co.from("absences").insert({
      ecole_id: demo.id, section: eleve.section, eleve_id: eleve.id, type: "Absence", date: "2026-07-16", motif: "TEST-RLS",
    }).select("id");
    attendu("REFUS de saisir une absence (RLS)", refusRls(coAbsErr));
    if (!refusRls(coAbsErr)) console.log(`     ↳ ${coAbsErr ? `erreur: ${coAbsErr.message}` : "absence CRÉÉE"}`);
    if (coAbs?.length) await svc.from("absences").delete().in("id", coAbs.map((a) => a.id));
  }
  const { error: coEcole } = await co.from("ecoles").update({ nom: "HACK" }).eq("id", demo.id).select("id").maybeSingle();
  const { data: nomApres } = await svc.from("ecoles").select("nom").eq("id", demo.id).single();
  attendu("REFUS de modifier l'école", !!coEcole || nomApres.nom !== "HACK");
  // Réglages ouverts à la compta (reglages-compta.sql) : la RPC écrit les clés
  // de sa liste blanche, et elles seules ; l'update direct ci-dessus reste fermé.
  const { error: coBlocErr } = await co.rpc("maj_reglages_compta", {
    p_champs: { blocageParentImpaye: !reglagesInitiaux.blocageParentImpaye, monnaie: " xof " },
  });
  const { data: reglagesApres } = await svc.from("ecoles").select("extra").eq("id", demo.id).single();
  attendu("bascule le blocage parents et la monnaie (RPC)", !coBlocErr
    && reglagesApres.extra?.blocageParentImpaye === !reglagesInitiaux.blocageParentImpaye
    && reglagesApres.extra?.monnaie === "XOF");
  if (coBlocErr) console.log(`     ↳ erreur: ${coBlocErr.message}`);
  const { error: coNomErr } = await co.rpc("maj_reglages_compta", { p_champs: { nom: "HACK" } });
  attendu("REFUS d'une clé hors liste blanche (RPC)", !!coNomErr);
  const { error: coTypeErr } = await co.rpc("maj_reglages_compta", { p_champs: { blocageParentImpaye: "oui" } });
  attendu("REFUS d'une valeur mal typée (RPC)", !!coTypeErr);

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
  const { error: suRegErr } = await su.rpc("maj_reglages_compta", { p_champs: { blocageParentImpaye: true } });
  attendu("REFUS des réglages compta (RPC)", !!suRegErr);
  const { data: suPoste, error: suPosteErr } = await su.from("comptes")
    .update({ poste_id: posteId.direction }).eq("user_id", comptesTests[1].userId).select("id");
  attendu("REFUS de changer son propre poste", !!suPosteErr || !(suPoste || []).length);
  // Garde percée : on lui rend son poste tout de suite, sinon il resterait
  // « direction » pour les sondes suivantes (la messagerie échouerait aussi).
  if ((suPoste || []).length) {
    await svc.from("comptes").update({ poste_id: posteId.surveillant }).eq("id", comptesTests[1].compteId);
  }

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
    sessions.parent = pa;
    const { data: paRecettes } = await pa.from("recettes").select("id");
    attendu("ne voit AUCUNE recette malgré le poste direction", (paRecettes || []).length === 0);
    const { error: paRec } = await pa.from("recettes").insert({ ecole_id: demo.id, extra: { libelle: "TEST-RLS-PA" } });
    attendu("REFUS de créer une recette", !!paRec);
  }

  console.log("\n— Messagerie interne (confidentialité RLS) —");
  // comptable → poste direction : le surveillant ne doit RIEN voir ;
  // surveillant → compte comptable : visible par le comptable seul ;
  // a_tous : visible par tout le personnel.
  {
    const co2 = sessions.comptable, su2 = sessions.surveillant;
    const { data: coCompte } = await co2.from("comptes").select("id").eq("login", "test-rls-comptable").single();
    const { error: envErr } = await co2.from("messages_internes").insert({
      ecole_id: demo.id, de_compte_id: comptesTests[0].compteId, de_nom: "Test comptable",
      a_postes: ["direction"], corps: "PRIVE-DIRECTION",
    });
    attendu("le comptable envoie au poste direction", !envErr);
    const { error: env2Err } = await su2.from("messages_internes").insert({
      ecole_id: demo.id, de_compte_id: comptesTests[1].compteId, de_nom: "Test surveillant",
      a_compte_id: coCompte?.id || comptesTests[0].compteId, corps: "PRIVE-COMPTABLE",
    });
    attendu("le surveillant envoie au compte comptable", !env2Err);
    const { error: env3Err } = await su2.from("messages_internes").insert({
      ecole_id: demo.id, de_compte_id: comptesTests[1].compteId, de_nom: "Test surveillant",
      a_tous: true, corps: "POUR-TOUS",
    });
    attendu("le surveillant envoie à tout le personnel", !env3Err);
    const { error: usurpErr } = await su2.from("messages_internes").insert({
      ecole_id: demo.id, de_compte_id: comptesTests[0].compteId, de_nom: "Faux comptable",
      a_tous: true, corps: "USURPATION",
    });
    attendu("REFUS d'envoyer au nom d'un autre compte", !!usurpErr);

    const { data: vusSu } = await su2.from("messages_internes").select("corps");
    const corpsSu = (vusSu || []).map((x) => x.corps);
    attendu("le surveillant NE voit PAS le message privé direction", !corpsSu.includes("PRIVE-DIRECTION"));
    attendu("le surveillant voit son envoi et le message à tous", corpsSu.includes("PRIVE-COMPTABLE") && corpsSu.includes("POUR-TOUS"));
    const { data: vusCo } = await co2.from("messages_internes").select("corps");
    const corpsCo = (vusCo || []).map((x) => x.corps);
    attendu("le comptable voit le privé qui lui est adressé + le message à tous", corpsCo.includes("PRIVE-COMPTABLE") && corpsCo.includes("POUR-TOUS"));
    await svc.from("messages_internes").delete().eq("ecole_id", demo.id).like("corps", "P%");
    await svc.from("messages_internes").delete().eq("ecole_id", demo.id).eq("corps", "POUR-TOUS");
  }

  console.log("\n— Auto-promotion (comptes_guard) —");
  // En DERNIER pour ces comptes : si la garde est percée, ils restent
  // « direction » jusqu'au nettoyage, et aucune sonde ne doit ensuite agir avec
  // des droits volés (le comptable promu pourrait renommer l'École Démo).
  // Le parent départage deux pannes : garde d'amorçage (lui reste bloqué) ou
  // garde absente (lui aussi passe).
  {
    const { data: coRole, error: coRoleErr } = await co.from("comptes")
      .update({ role: "direction" }).eq("user_id", comptesTests[0].userId).select("id");
    attendu("le comptable NE PEUT PAS se donner le rôle direction", !!coRoleErr || !(coRole || []).length);
    const { data: paRole, error: paRoleErr } = await sessions.parent.from("comptes")
      .update({ role: "direction" }).eq("user_id", comptesTests[2].userId).select("id");
    attendu("le parent NE PEUT PAS se donner le rôle direction", !!paRoleErr || !(paRole || []).length);
  }

  console.log("\n— Connexion par e-mail (login_pour_email) —");
  // On pose un e-mail réel sur le compte comptable de test et on vérifie que
  // la résolution anonyme e-mail → login fonctionne (chemin de l'écran de
  // connexion). L'authentification elle-même reste l'e-mail synthétique.
  {
    const emailReel = "test-rls-comptable@exemple.gn";
    await svc.from("comptes").update({ email: emailReel }).eq("id", comptesTests[0].compteId);
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: loginResolu } = await anon.rpc("login_pour_email", { p_code: "demo", p_email: emailReel });
    attendu("résout l'e-mail vers l'identifiant", loginResolu === "test-rls-comptable");
    const { data: loginInconnu } = await anon.rpc("login_pour_email", { p_code: "demo", p_email: "inconnu@exemple.gn" });
    attendu("e-mail inconnu → null (message générique côté app)", !loginInconnu);
    const { data: mauvaiseEcole } = await anon.rpc("login_pour_email", { p_code: "citadelle", p_email: emailReel });
    attendu("même e-mail sur une AUTRE école → null (cloisonné)", !mauvaiseEcole);
  }

  console.log("\n— Visiteur NON connecté (anon) —");
  {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: anonRegErr } = await anon.rpc("maj_reglages_compta", { p_champs: { blocageParentImpaye: true } });
    // « permission denied » = refusé AVANT d'entrer dans la fonction : le
    // revoke a pris (sinon ce serait le « Droits insuffisants » de son corps).
    const revoque = /permission denied/i.test(anonRegErr?.message || "");
    attendu("REFUS d'exécuter maj_reglages_compta (EXECUTE révoqué)", revoque);
    if (!revoque) console.log(`     ↳ ${anonRegErr ? `erreur: ${anonRegErr.message}` : "aucune erreur"}`);
  }

  // ── Nettoyage complet ──
  // Réglages de l'École Démo remis en l'état (une clé absente le redevient).
  const { data: extraFin } = await svc.from("ecoles").select("extra").eq("id", demo.id).single();
  const extraRestaure = { ...(extraFin.extra || {}) };
  for (const [cle, valeur] of Object.entries(reglagesInitiaux)) {
    if (valeur === undefined) delete extraRestaure[cle];
    else extraRestaure[cle] = valeur;
  }
  await svc.from("ecoles").update({ extra: extraRestaure }).eq("id", demo.id);
  await svc.from("recettes").delete().eq("id", temoin.id);
  for (const t of comptesTests) {
    await svc.from("comptes").delete().eq("id", t.compteId);
    await svc.auth.admin.deleteUser(t.userId);
  }
  console.log(`\nNettoyage fait. ${echecs === 0 ? "🎉 TOUTES LES SONDES PASSENT" : `⚠️ ${echecs} sonde(s) en échec`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
