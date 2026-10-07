// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes des abonnements push (push-subs-verrou.sql + Edge push)
// ═══════════════════════════════════════════════════════════════════════════
// Crée trois comptes JETABLES sur l'École Démo (parent, comptable, staff à
// poste flexible) et deux postes de test, puis vérifie :
//   • BASE : on ne s'abonne que pour soi, dans son école ; rôle et poste
//     sont recalculés depuis le compte (ce que le navigateur déclare est
//     ignoré), service_role compris ;
//   • EDGE (après `supabase functions deploy push`) : refus de l'appelant
//     (droits.ts) et tri des abonnés sur `comptes` (destinataires.ts).
// Les abonnements de test pointent vers une adresse INEXISTANTE du projet
// Supabase : l'envoi y échoue en 404, et l'Edge purge alors la ligne — une
// ligne purgée prouve qu'elle a été choisie comme destinataire. Seuls des
// comptes de test sont visés (clés de poste et user_id de test) : aucune
// notification ne part vers un vrai utilisateur.
// Puis supprime tout. Lancer : node supabase/test-rls-push.mjs
import { createClient } from "@supabase/supabase-js";
import { createECDH, randomBytes } from "node:crypto";
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

// Abonnement Web Push valide (clé P-256 réelle) vers une adresse qui répond 404.
const ENDPOINT_404 = `${SUPABASE_URL}/sonde-push-inexistante`;
function abonnementTest() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: ENDPOINT_404, expirationTime: null,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
  };
}

const POSTE_CENSEUR = "test-push-censeur";
const POSTE_ECONOME = "test-push-econome";

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
  const sAbonner = (cle, ecoleId = demo.id, declare = {}) => sessions[cle].from("push_subs").upsert({
    ecole_id: ecoleId, user_id: comptes[cle].userId, subscription: abonnementTest(), nom: "Sonde push",
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

  try {
    await creer("parent", "parent", null);
    await creer("comptable", "comptable", "comptable");
    await creer("staff", "staff", POSTE_CENSEUR);

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

    console.log("\n— EDGE push : refus de l'appelant (droits.ts) —");
    const detection = await appelerPush("parent", { schoolId: autre.code, userIds: [comptes.parent.userId] });
    const edgeAJour = detection.status === 403;
    attendu("le parent ne peut pas notifier une autre école (403)", edgeAJour,
      `HTTP ${detection.status} ${JSON.stringify(detection.data)} — normal si « supabase functions deploy push » n'a pas encore été lancé`);
    if (!edgeAJour) {
      info("Edge push pas à jour : sondes d'envoi sautées (elles notifieraient le vrai personnel de Démo).");
    } else {
      const tous = await appelerPush("parent", { schoolId: demo.code, tousStaff: true });
      attendu("le parent ne peut pas notifier tout le personnel (403)", tous.status === 403, `HTTP ${tous.status}`);

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
      }
    }
  } finally {
    // ── Nettoyage complet ──
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
