// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes des abonnements push (push-subs-verrou.sql + Edge push)
// ═══════════════════════════════════════════════════════════════════════════
// Crée cinq comptes JETABLES sur l'École Démo (deux parents, comptable,
// staff à poste flexible, enseignant) et deux postes de test, puis vérifie :
//   • BASE : on ne s'abonne que pour soi, dans son école ; rôle et poste
//     sont recalculés depuis le compte (ce que le navigateur déclare est
//     ignoré), service_role compris ; un navigateur n'a qu'un abonné
//     (push-subs-navigateur.sql : appareil partagé) ;
//   • EDGE (après `supabase functions deploy push`) : refus de l'appelant
//     (droits.ts), tri des abonnés sur `comptes` (destinataires.ts) et
//     parents visés PAR ÉLÈVE — deux élèves jetables, un parent chacun :
//     la notification de l'un ne part pas à l'autre famille ; l'enseignant
//     ne prévient que les parents d'un élève de SES classes.
// Les abonnements de test pointent vers des adresses INEXISTANTES du projet
// Supabase (une par abonnement : la base n'en garde qu'un par adresse) :
// l'envoi y échoue en 404, et l'Edge purge alors la ligne — une ligne
// purgée prouve qu'elle a été choisie comme destinataire. Seuls des comptes
// de test sont visés (clés de poste et user_id de test) : aucune
// notification ne part vers un vrai utilisateur.
// Puis supprime tout. Lancer : node supabase/test-rls-push.mjs
import { createClient } from "@supabase/supabase-js";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const mdp = () => "T!" + randomBytes(12).toString("base64url");

let echecs = 0;
const attendu = (nom, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "❌"} ${nom}`);
  if (!ok) { echecs++; if (detail) console.log(`     ↳ ${detail}`); }
};
const info = (texte) => console.log(`  ⚪ ${texte}`);
// Refus opposé par la base (policy RLS ou déclencheur push_subs_identite).
const refusBase = (erreur) => erreur?.code === "42501";
const decrire = (erreur) => (erreur ? `${erreur.code || "?"} ${erreur.message}` : "aucune erreur : ligne écrite");

// Abonnement Web Push valide (clé P-256 réelle) vers une adresse qui répond
// 404 — propre à chaque abonnement, comme un vrai navigateur.
const ENDPOINT_404 = `${SUPABASE_URL}/sonde-push-inexistante`;
function abonnementTest() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `${ENDPOINT_404}/${randomUUID()}`, expirationTime: null,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
  };
}

const POSTE_CENSEUR = "test-push-censeur";
const POSTE_ECONOME = "test-push-econome";
// Classes des élèves jetables (aucune vraie classe ne porte ces noms).
const CLASSES = { a: "SONDE-PUSH-A", b: "SONDE-PUSH-B" };

async function main() {
  const { data: demo } = await svc.from("ecoles").select("id, code").eq("code", "demo").single();
  const { data: autre } = await svc.from("ecoles").select("id, code").neq("code", "demo")
    .not("actif", "is", false).limit(1).single();
  const { data: postesSys } = await svc.from("postes").select("id, cle").eq("ecole_id", demo.id).eq("cle", "comptable");
  const { data: postesTest, error: postesErr } = await svc.from("postes").upsert([
    { ecole_id: demo.id, cle: POSTE_CENSEUR, label: "Test push censeur", permissions: {} },
    { ecole_id: demo.id, cle: POSTE_ECONOME, label: "Test push économe", permissions: {} },
  ], { onConflict: "ecole_id,cle" }).select("id, cle");
  if (postesErr) { console.error(`postes de test impossibles: ${postesErr.message}`); process.exit(1); }
  const posteId = Object.fromEntries([...postesSys, ...postesTest].map((p) => [p.cle, p.id]));

  const comptes = {};
  const sessions = {};
  const eleves = {}; // élèves jetables (sondes « parents par élève »)
  const creer = async (cle, role, poste) => {
    const login = `test-push-${cle}`;
    const email = `${login}.demo@edugest.app`;
    const pass = mdp();
    let { data: u, error: e } = await svc.auth.admin.createUser({ email, password: pass, email_confirm: true });
    if (e) { // déjà présent d'un run précédent
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      u = { user: list.users.find((x) => x.email === email) };
      await svc.auth.admin.updateUserById(u.user.id, { password: pass });
    }
    await svc.from("push_subs").delete().eq("user_id", u.user.id);
    await svc.from("comptes").delete().eq("user_id", u.user.id);
    const { data: c, error: ce } = await svc.from("comptes").insert({
      user_id: u.user.id, ecole_id: demo.id, login, role, nom: `Test push ${cle}`,
      label: cle, poste_id: poste ? posteId[poste] : null, premiere_co: false,
    }).select("id").single();
    if (ce) throw new Error(`compte ${cle} impossible: ${ce.message}`);
    comptes[cle] = { compteId: c.id, userId: u.user.id };
    const cli = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: se } = await cli.auth.signInWithPassword({ email, password: pass });
    if (se) throw new Error(`connexion ${cle} impossible: ${se.message}`);
    sessions[cle] = cli;
  };

  // S'abonner « comme le navigateur » (upsert de push-supabase.js), avec des
  // valeurs déclarées éventuellement forgées.
  const sAbonner = (cle, ecoleId = demo.id, declare = {}, abonnement = abonnementTest()) => sessions[cle].from("push_subs").upsert({
    ecole_id: ecoleId, user_id: comptes[cle].userId, subscription: abonnement, nom: "Sonde push",
    ...declare, updated_at: new Date().toISOString(),
  });
  const ligne = async (cle, ecoleId = demo.id) => (await svc.from("push_subs").select("role, poste_cle")
    .eq("user_id", comptes[cle].userId).eq("ecole_id", ecoleId).maybeSingle()).data;
  const appelerPush = async (cle, corps) => {
    const { data: { session } } = await sessions[cle].auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ titre: "Sonde EduGest (test)", corps: "test", ...corps }),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };

  // Deux familles : « parent » suit l'élève A, « parent2 » l'élève B. Seuls
  // ces comptes de test sont rattachés aux élèves jetables : aucun vrai
  // parent ne peut être servi. L'enseignant de test n'a que la classe de A.
  const sonderParentsParEleve = async () => {
    for (const cle of ["a", "b"]) {
      const { data, error } = await svc.from("eleves").insert({
        ecole_id: demo.id, section: "college", classe: CLASSES[cle], nom: "SONDE PUSH", prenom: `Élève ${cle.toUpperCase()} (test)`,
      }).select("id").single();
      if (error) { info(`élève de test impossible (${error.message}) : sondes « parents par élève » sautées.`); return; }
      eleves[cle] = data.id;
    }
    const { error: lienErr } = await svc.from("parent_eleves").insert([
      { compte_id: comptes.parent.compteId, eleve_id: eleves.a },
      { compte_id: comptes.parent2.compteId, eleve_id: eleves.b },
    ]);
    if (lienErr) { info(`rattachements de test impossibles (${lienErr.message}) : sondes sautées.`); return; }

    await sAbonner("parent");
    await sAbonner("parent2");
    const r = await appelerPush("comptable", { schoolId: demo.code, cibles: ["parent"], eleveId: eleves.a });
    attendu("élève A : son parent est servi", r.status === 200 && !(await ligne("parent")),
      `HTTP ${r.status} ${JSON.stringify(r.data)}`);
    attendu("élève A : le parent de l'élève B ne reçoit RIEN", !!(await ligne("parent2")));

    await sAbonner("parent");
    const { data: ailleurs } = await svc.from("eleves").select("id").eq("ecole_id", autre.id).limit(1).maybeSingle();
    const horsEcole = await appelerPush("comptable", {
      schoolId: demo.code, cibles: ["parent"], eleveId: ailleurs?.id || randomUUID(),
    });
    attendu(`élève d'une autre école (${autre.code}) : refusé (404)`, horsEcole.status === 404,
      `HTTP ${horsEcole.status} ${JSON.stringify(horsEcole.data)}`);
    attendu("… et rien n'est parti", !!(await ligne("parent")) && !!(await ligne("parent2")));

    // Enseignant : les parents d'un élève de SES classes seulement.
    const { error: classeErr } = await svc.from("enseignant_classes").insert({
      compte_id: comptes.prof.compteId, ecole_id: demo.id, section: "college", classe: CLASSES.a, user_id: comptes.prof.userId,
    });
    if (classeErr) { info(`classe de l'enseignant de test impossible (${classeErr.message}) : sondes enseignant sautées.`); return; }
    const horsClasse = await appelerPush("prof", { schoolId: demo.code, cibles: ["parent"], eleveId: eleves.b });
    attendu("enseignant : élève hors de ses classes refusé (403)", horsClasse.status === 403,
      `HTTP ${horsClasse.status} ${JSON.stringify(horsClasse.data)} — normal si push n'est pas encore redéployée`);
    attendu("… et le parent de cet élève ne reçoit rien", !!(await ligne("parent2")));
    const saClasse = await appelerPush("prof", { schoolId: demo.code, cibles: ["parent"], eleveId: eleves.a });
    attendu("enseignant : élève de sa classe → son parent est servi", saClasse.status === 200 && !(await ligne("parent")),
      `HTTP ${saClasse.status} ${JSON.stringify(saClasse.data)}`);
  };

  try {
    await creer("parent", "parent", null);
    await creer("parent2", "parent", null);
    await creer("comptable", "comptable", "comptable");
    await creer("staff", "staff", POSTE_CENSEUR);
    await creer("prof", "enseignant", null);

    console.log("\n— BASE : s'abonner pour soi, dans son école —");
    {
      const { error } = await sAbonner("parent", demo.id, { role: "direction", poste_cle: "direction" });
      attendu("le parent s'abonne dans son école", !error, decrire(error));
      const l = await ligne("parent");
      attendu("rôle/poste déclarés « direction » réécrits en « parent »",
        l?.role === "parent" && l?.poste_cle === "parent", JSON.stringify(l));
    }
    {
      const { error } = await sAbonner("parent", autre.id, { role: "direction", poste_cle: "direction" });
      attendu(`REFUS de s'abonner dans une autre école (${autre.code})`, refusBase(error), decrire(error));
      attendu("aucune ligne du parent dans l'autre école", !(await ligne("parent", autre.id)));
    }
    {
      const { error } = await sessions.parent.from("push_subs").upsert({
        ecole_id: demo.id, user_id: comptes.comptable.userId, subscription: abonnementTest(), role: "parent",
      });
      attendu("REFUS d'abonner le compte de quelqu'un d'autre", refusBase(error), decrire(error));
    }
    {
      const { data, error } = await sessions.parent.from("push_subs").update({ ecole_id: autre.id })
        .eq("user_id", comptes.parent.userId).select("ecole_id");
      attendu("REFUS de déplacer son abonnement vers une autre école", refusBase(error) || !(data || []).length,
        decrire(error));
      attendu("l'abonnement est resté dans l'école Démo", !!(await ligne("parent")) && !(await ligne("parent", autre.id)));
    }
    {
      const { error } = await sAbonner("comptable", demo.id, { role: "direction", poste_cle: "direction" });
      const l = await ligne("comptable");
      attendu("comptable (poste système) : rôle et poste = comptable",
        !error && l?.role === "comptable" && l?.poste_cle === "comptable", error ? decrire(error) : JSON.stringify(l));
    }
    {
      const { error } = await sAbonner("staff", demo.id, { role: "direction", poste_cle: null });
      const l = await ligne("staff");
      attendu(`poste flexible : rôle staff, poste ${POSTE_CENSEUR}`,
        !error && l?.role === "staff" && l?.poste_cle === POSTE_CENSEUR, error ? decrire(error) : JSON.stringify(l));
    }

    console.log("\n— BASE : le déclencheur s'impose aussi à service_role —");
    {
      const { error } = await svc.from("push_subs").insert({
        ecole_id: autre.id, user_id: comptes.parent.userId, subscription: abonnementTest(), role: "direction",
      });
      attendu("REFUS d'une ligne hors de l'école du compte", refusBase(error), decrire(error));
    }
    {
      const { error } = await svc.from("push_subs").insert({
        ecole_id: demo.id, user_id: "00000000-0000-4000-8000-00000000c0de", subscription: abonnementTest(),
      });
      attendu("REFUS d'une ligne sans compte", refusBase(error), decrire(error));
    }

    console.log("\n— BASE : visiteur non connecté (anon) —");
    {
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await anon.from("push_subs").insert({
        ecole_id: demo.id, user_id: comptes.parent.userId, subscription: abonnementTest(), role: "parent",
      });
      attendu("REFUS d'écrire un abonnement", !!error, decrire(error));
      const { data: lus } = await anon.from("push_subs").select("user_id").limit(1);
      attendu("ne lit AUCUN abonnement", !(lus || []).length);
    }

    console.log("\n— BASE : un navigateur = un seul abonné (appareil partagé) —");
    {
      const partage = abonnementTest();
      await sAbonner("parent", demo.id, {}, partage);
      await sAbonner("parent", demo.id, {}, partage);
      attendu("le compte qui se réabonne sur son navigateur garde sa ligne", !!(await ligne("parent")));
      const { error } = await sAbonner("parent2", demo.id, {}, partage);
      attendu("un autre compte s'abonne sur le même navigateur", !error, decrire(error));
      attendu("… la ligne du compte précédent sur ce navigateur est retirée",
        !(await ligne("parent")) && !!(await ligne("parent2")),
        "normal si push-subs-navigateur.sql n'a pas encore été exécuté");
    }
    {
      // Déconnexion (push-navigateur.js) : le compte retire SA ligne portant
      // l'adresse de son navigateur ; celle d'un autre compte reste hors d'atteinte.
      const adresse = abonnementTest();
      await sAbonner("parent", demo.id, {}, adresse);
      const { data: autrui } = await sessions.parent2.from("push_subs").delete()
        .eq("user_id", comptes.parent.userId).eq("subscription->>endpoint", adresse.endpoint).select("user_id");
      attendu("REFUS de retirer la ligne d'un autre compte", !(autrui || []).length && !!(await ligne("parent")));
      const { error } = await sessions.parent.from("push_subs").delete()
        .eq("user_id", comptes.parent.userId).eq("subscription->>endpoint", adresse.endpoint);
      attendu("déconnexion : le compte retire la ligne de son navigateur", !error && !(await ligne("parent")), decrire(error));
    }

    console.log("\n— EDGE push : refus de l'appelant (droits.ts) —");
    const detection = await appelerPush("parent", { schoolId: autre.code, userIds: [comptes.parent.userId] });
    const edgeAJour = detection.status === 403;
    let parentsAJour = false;
    attendu("le parent ne peut pas notifier une autre école (403)", edgeAJour,
      `HTTP ${detection.status} ${JSON.stringify(detection.data)} — normal si « supabase functions deploy push » n'a pas encore été lancé`);
    if (!edgeAJour) {
      info("Edge push pas à jour : sondes d'envoi sautées (elles notifieraient le vrai personnel de Démo).");
    } else {
      const tous = await appelerPush("parent", { schoolId: demo.code, tousStaff: true });
      attendu("le parent ne peut pas notifier tout le personnel (403)", tous.status === 403, `HTTP ${tous.status}`);

      console.log("\n— EDGE push : parents visés par élève (fuite entre familles) —");
      // Détection par le PARENT : une version antérieure répond 403 (ciblage
      // par rôle interdit aux parents) sans rien envoyer ; la nouvelle refuse
      // d'abord la cible « parent » sans élève (400).
      const sansEleve = await appelerPush("parent", { schoolId: demo.code, cibles: ["parent"] });
      parentsAJour = sansEleve.status === 400;
      attendu("cible « parent » sans eleveId : refusée (400)", parentsAJour,
        `HTTP ${sansEleve.status} ${JSON.stringify(sansEleve.data)} — normal si la version « parents par élève » n'est pas encore déployée`);
      if (parentsAJour) {
        const r = await appelerPush("comptable", { schoolId: demo.code, cibles: ["parent"] });
        attendu("… même venant du personnel : aucune diffusion à toutes les familles (400)", r.status === 400,
          `HTTP ${r.status} ${JSON.stringify(r.data)}`);
      } else {
        info("Edge sans « parents par élève » : sondes d'envoi aux parents sautées.");
      }

      console.log("\n— EDGE push : destinataires choisis sur `comptes` —");
      // Témoin : le staff (poste censeur) visé par sa clé de poste doit être
      // choisi, donc purgé après le 404 de l'adresse de test.
      await sAbonner("staff");
      const temoin = await appelerPush("comptable", { schoolId: demo.code, cibles: [POSTE_CENSEUR] });
      const concluant = temoin.status === 200 && !(await ligne("staff"));
      if (!concluant) {
        info(`non concluant : la ligne témoin n'a pas été purgée (HTTP ${temoin.status} ${JSON.stringify(temoin.data)}) — ${ENDPOINT_404} ne répond peut-être pas 404.`);
      } else {
        attendu("témoin : le poste flexible visé par sa clé est servi", true);

        // Poste changé APRÈS l'abonnement : push_subs dit encore « censeur ».
        await sAbonner("staff");
        await svc.from("comptes").update({ poste_id: posteId[POSTE_ECONOME] }).eq("id", comptes.staff.compteId);
        const perimee = await ligne("staff");
        await appelerPush("comptable", { schoolId: demo.code, cibles: [POSTE_CENSEUR] });
        attendu("poste changé : l'ancienne clé (encore dans push_subs) ne sert plus",
          perimee?.poste_cle === POSTE_CENSEUR && !!(await ligne("staff")), JSON.stringify(perimee));
        await appelerPush("comptable", { schoolId: demo.code, cibles: [POSTE_ECONOME] });
        attendu("poste changé : la nouvelle clé (lue dans comptes) est servie", !(await ligne("staff")));

        // Compte désactivé : plus rien ne lui part, même nommément.
        await sAbonner("comptable");
        await svc.from("comptes").update({ statut: "Inactif" }).eq("id", comptes.comptable.compteId);
        await appelerPush("parent", { schoolId: demo.code, userIds: [comptes.comptable.userId] });
        attendu("compte inactif : non servi", !!(await ligne("comptable")));
        await svc.from("comptes").update({ statut: "Actif" }).eq("id", comptes.comptable.compteId);
        await appelerPush("parent", { schoolId: demo.code, userIds: [comptes.comptable.userId] });
        attendu("compte réactivé : servi à nouveau (messagerie, userIds)", !(await ligne("comptable")));

        if (parentsAJour) await sonderParentsParEleve();
      }
    }
  } finally {
    // ── Nettoyage complet (rattachements supprimés en cascade) ──
    if (Object.keys(eleves).length) await svc.from("eleves").delete().in("id", Object.values(eleves));
    for (const t of Object.values(comptes)) {
      await svc.from("push_subs").delete().eq("user_id", t.userId);
      await svc.from("comptes").delete().eq("id", t.compteId);
      await svc.auth.admin.deleteUser(t.userId);
    }
    await svc.from("postes").delete().eq("ecole_id", demo.id).in("cle", [POSTE_CENSEUR, POSTE_ECONOME]);
  }
  console.log(`\nNettoyage fait. ${echecs === 0 ? "🎉 TOUTES LES SONDES PASSENT" : `⚠️ ${echecs} sonde(s) en échec`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
