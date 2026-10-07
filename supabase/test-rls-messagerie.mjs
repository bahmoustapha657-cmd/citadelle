// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes de la messagerie v2 (messagerie-v2.sql)
// ═══════════════════════════════════════════════════════════════════════════
// Crée six comptes de test JETABLES sur l'École Démo (direction, comptable,
// Principale — poste college —, enseignants du collège et du lycée, parent
// d'un élève jetable du collège), vérifie PAR LA BASE la confidentialité des discussions, des
// appels, des annonces et des vocaux, ainsi que la diffusion temps réel —
// puis supprime tout. Lancer : node supabase/test-rls-messagerie.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const mdp = () => "T!" + randomBytes(12).toString("base64url");
const attente = (ms) => new Promise((r) => setTimeout(r, ms));

let echecs = 0;
const attendu = (nom, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "❌"} ${nom}${!ok && detail ? `\n     ↳ ${detail}` : ""}`);
  if (!ok) echecs++;
};

async function main() {
  const { data: demo } = await svc.from("ecoles").select("id, code").eq("code", "demo").single();
  const { data: postes } = await svc.from("postes").select("id, cle").eq("ecole_id", demo.id);
  const posteId = Object.fromEntries((postes || []).map((p) => [p.cle, p.id]));

  const comptes = {};
  const sessions = {};
  // Rôle du compte d'après sa clé de test.
  const ROLE = { enseignant2: "enseignant" };
  const PROFIL = {
    enseignant: { enseignant_nom: "Test msg enseignant", matiere: "Maths", section: "college" },
    enseignant2: { enseignant_nom: "Test msg enseignant lycée", matiere: "Physique", section: "lycee" },
  };
  for (const role of ["direction", "comptable", "college", "enseignant", "enseignant2", "parent"]) {
    const login = `test-msg-${role}`;
    const email = `${login}.demo@edugest.app`;
    const pass = mdp();
    let { data: u, error: e } = await svc.auth.admin.createUser({ email, password: pass, email_confirm: true });
    if (e) { // reste d'un run précédent
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      u = { user: list.users.find((x) => x.email === email) };
      await svc.auth.admin.updateUserById(u.user.id, { password: pass });
    }
    await svc.from("comptes").delete().eq("user_id", u.user.id);
    const { data: c, error: ce } = await svc.from("comptes").insert({
      user_id: u.user.id, ecole_id: demo.id, login, role: ROLE[role] || role, nom: `Test msg ${role}`, label: role,
      poste_id: ["enseignant", "enseignant2", "parent"].includes(role) ? null : posteId[role] || null, premiere_co: false,
      ...(PROFIL[role] || {}),
    }).select("id").single();
    if (ce) { console.error(`création ${role} impossible: ${ce.message}`); process.exit(1); }
    comptes[role] = { id: c.id, userId: u.user.id };
    const cli = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: se } = await cli.auth.signInWithPassword({ email, password: pass });
    if (se) { console.error(`connexion ${role} impossible: ${se.message}`); process.exit(1); }
    sessions[role] = cli;
  }
  const { direction: di, comptable: co, college: pr, enseignant: en, enseignant2: en2, parent: pa } = sessions;
  // Élève JETABLE du collège, enfant du compte parent de test.
  const { data: eleve, error: elErr } = await svc.from("eleves").insert({
    ecole_id: demo.id, section: "college", nom: "SONDE", prenom: "Élève", classe: "SONDE-6A", statut: "Actif",
  }).select("id").single();
  if (elErr) { console.error(`élève de test impossible: ${elErr.message}`); process.exit(1); }
  await svc.from("parent_eleves").insert({ compte_id: comptes.parent.id, eleve_id: eleve.id });
  const conversations = [];
  const annonces = [];
  const fichiers = [];
  let groupeId = null;

  try {
    console.log("\n— Annuaire —");
    {
      const { data, error } = await en.rpc("msg_annuaire");
      const ids = new Set((data || []).map((x) => x.id));
      attendu("l'enseignant voit la direction et la comptable", !error && ids.has(comptes.direction.id) && ids.has(comptes.comptable.id), error?.message);
      attendu("aucun parent dans l'annuaire", !(data || []).some((x) => x.role === "parent"));
      const joignables = (data || []).filter((x) => x.contactable);
      attendu("hiérarchie : l'enseignant du collège contacte son chef de section (poste college) et les enseignants du secondaire",
        joignables.some((x) => x.id === comptes.college.id) && joignables.some((x) => x.id === comptes.enseignant2.id)
          && joignables.every((x) => x.poste_cle === "college" || x.role === "enseignant"),
        JSON.stringify(joignables.map((x) => x.poste_cle)));
      const { data: prim } = await svc.from("comptes").select("id").eq("ecole_id", demo.id).eq("role", "enseignant").in("section", ["primaire", "prescolaire"]);
      attendu("… mais aucun enseignant du primaire ou de la maternelle", !(prim || []).some((p) => joignables.some((x) => x.id === p.id)));
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: anonErr } = await anon.rpc("msg_boite");
      attendu("anon : EXECUTE refusé sur msg_boite", /permission denied/i.test(anonErr?.message || ""), anonErr?.message || "aucune erreur");
    }

    console.log("\n— Discussion directe + temps réel —");
    const { data: directe, error: dErr } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.college.id });
    attendu("l'enseignant ouvre une discussion avec sa Principale", !dErr && !!directe, dErr?.message);
    conversations.push(directe);

    // Temps réel : la Principale doit recevoir le message, la direction non.
    const recus = { college: [], direction: [] };
    const canaux = [];
    for (const [qui, cli] of [["college", pr], ["direction", di]]) {
      const ch = cli.channel(`sonde-${qui}-${Date.now()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "msg_messages", filter: `ecole_id=eq.${demo.id}` },
          (p) => recus[qui].push(p.new));
      await new Promise((resolve) => ch.subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(); }));
      canaux.push([cli, ch]);
    }
    await attente(1500);

    const { data: msg, error: mErr } = await en.from("msg_messages").insert({
      conversation_id: directe, ecole_id: demo.id, de_compte_id: comptes.enseignant.id, type: "texte", corps: "SONDE-MSG",
    }).select("id").single();
    attendu("l'enseignant envoie un message", !mErr && !!msg, mErr?.message);
    const { error: usurpErr } = await en.from("msg_messages").insert({
      conversation_id: directe, ecole_id: demo.id, de_compte_id: comptes.comptable.id, type: "texte", corps: "USURPATION",
    });
    attendu("REFUS d'écrire au nom d'un autre (RLS)", usurpErr?.code === "42501", usurpErr?.message || "accepté");
    const { error: sysErr } = await en.from("msg_messages").insert({
      conversation_id: directe, ecole_id: demo.id, de_compte_id: comptes.enseignant.id, type: "systeme", corps: "FAUX",
    });
    attendu("REFUS de forger un message système (RLS)", sysErr?.code === "42501", sysErr?.message || "accepté");

    await attente(4000);
    attendu("temps réel : la Principale reçoit le message", recus.college.some((m) => m.corps === "SONDE-MSG"),
      "rien reçu — vérifier la publication supabase_realtime (section 9 du SQL)");
    attendu("temps réel : la direction ne reçoit RIEN", recus.direction.length === 0);
    for (const [cli, ch] of canaux) await cli.removeChannel(ch);

    const { data: vuCo } = await pr.from("msg_messages").select("corps").eq("conversation_id", directe);
    attendu("la Principale lit le message", (vuCo || []).some((m) => m.corps === "SONDE-MSG"));
    const { data: vuDi } = await di.from("msg_messages").select("corps").eq("conversation_id", directe);
    attendu("la direction NE lit PAS une discussion privée", (vuDi || []).length === 0);
    const { data: boite } = await pr.rpc("msg_boite");
    attendu("boîte de la Principale : 1 non lu", (boite || []).find((c) => c.id === directe)?.non_lus === 1);

    console.log("\n— Message vocal (bucket privé) —");
    {
      const chemin = `${demo.id}/${directe}/sonde.webm`;
      const { error: upErr } = await en.storage.from("messagerie")
        .upload(chemin, new Blob([new Uint8Array([26, 69, 223, 163])], { type: "audio/webm" }), { contentType: "audio/webm" });
      attendu("l'enseignant dépose un vocal dans sa discussion", !upErr, upErr?.message);
      if (!upErr) fichiers.push(chemin);
      const { error: dlCo } = await pr.storage.from("messagerie").download(chemin);
      attendu("la Principale le télécharge", !dlCo, dlCo?.message);
      const { data: dlDi } = await di.storage.from("messagerie").download(chemin);
      attendu("la direction NE peut PAS le télécharger", !dlDi);
      const { error: horsErr } = await en.storage.from("messagerie")
        .upload(`${demo.id}/${crypto.randomUUID()}/x.webm`, new Blob([new Uint8Array([1])], { type: "audio/webm" }), { contentType: "audio/webm" });
      attendu("REFUS de déposer hors de ses discussions", !!horsErr);
    }

    console.log("\n— Groupe —");
    {
      const { data: groupe, error: gErr } = await di.rpc("msg_creer_groupe", { p_titre: "SONDE-GROUPE", p_membres: [comptes.comptable.id, comptes.enseignant.id] });
      attendu("la direction crée un groupe", !gErr && !!groupe, gErr?.message);
      if (groupe) conversations.push(groupe);
      groupeId = groupe;
      const { error: renErr } = await en.rpc("msg_renommer_groupe", { p_conv: groupe, p_titre: "PIRATE" });
      attendu("REFUS : un membre non admin ne renomme pas", !!renErr);
    }

    console.log("\n— Appel —");
    {
      const { data: appel, error: aErr } = await pr.rpc("msg_appel_lancer", { p_conv: directe, p_offre: { type: "offer", sdp: "sonde" } });
      attendu("la Principale appelle l'enseignant", !aErr && !!appel, aErr?.message);
      const { data: vuAppel } = await di.from("msg_appels").select("id").eq("id", appel);
      attendu("la direction ne voit pas l'appel", (vuAppel || []).length === 0);
      const { error: rErr } = await en.rpc("msg_appel_repondre", { p_id: appel, p_reponse: { type: "answer", sdp: "sonde" } });
      attendu("l'enseignant répond", !rErr, rErr?.message);
      await en.rpc("msg_appel_terminer", { p_id: appel, p_statut: "termine" });
      const { data: trace } = await pr.from("msg_messages").select("corps").eq("conversation_id", directe).eq("type", "appel");
      attendu("trace « appel » dans la discussion", (trace || []).some((t) => /^termine:\d+$/.test(t.corps)));
    }

    console.log("\n— Annonces —");
    {
      const { data: a, error: pErr } = await di.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.direction.id, titre: "SONDE", corps: "SONDE-ANNONCE",
        a_enseignants: true, accuse_requis: true, priorite: "urgente",
      }).select("id").single();
      attendu("la direction publie aux enseignants", !pErr && !!a, pErr?.message);
      if (a) annonces.push(a.id);
      const { data: vuEn } = await en.from("msg_annonces").select("id").eq("id", a?.id);
      attendu("l'enseignant la voit", (vuEn || []).length === 1);
      const { data: vuCoA } = await co.from("msg_annonces").select("id").eq("id", a?.id);
      attendu("la comptable (non visée) ne la voit pas", (vuCoA || []).length === 0);
      const { error: ensPub } = await en.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.enseignant.id, corps: "SONDE-INTERDITE", a_tous: true,
      });
      attendu("REFUS : un enseignant ne publie pas d'annonce (RLS)", ensPub?.code === "42501", ensPub?.message || "accepté");
      await en.rpc("msg_annonce_lire", { p_id: a?.id, p_confirmer: true });
      const { data: suivi, error: sErr } = await di.rpc("msg_annonce_suivi", { p_id: a?.id });
      const ligneEns = (suivi || []).find((s) => s.compte_id === comptes.enseignant.id);
      attendu("suivi : l'enseignant de test a lu et confirmé", !sErr && !!ligneEns?.confirme_at, sErr?.message);
      const { error: sCoErr } = await co.rpc("msg_annonce_suivi", { p_id: a?.id });
      attendu("REFUS : suivi par la comptable (ni auteur ni direction)", !!sCoErr);
    }

    // ── Messagerie v3 (messagerie-v3.sql) ──
    console.log("\n— v3 · Documents dans une discussion —");
    {
      const chemin = `${demo.id}/${directe}/sonde.pdf`;
      const { error: upErr } = await en.storage.from("messagerie")
        .upload(chemin, new Blob(["%PDF-1.4 sonde"], { type: "application/pdf" }), { contentType: "application/pdf" });
      attendu("l'enseignant dépose un PDF dans sa discussion", !upErr, upErr?.message);
      if (!upErr) fichiers.push(chemin);
      const { error: msgErr } = await en.from("msg_messages").insert({
        conversation_id: directe, ecole_id: demo.id, de_compte_id: comptes.enseignant.id, type: "fichier",
        fichier_path: chemin, fichier_nom: "sonde.pdf", fichier_type: "application/pdf", fichier_taille: 14,
      });
      attendu("… et le partage (message « fichier »)", !msgErr, msgErr?.message);
      const { error: dlErr } = await pr.storage.from("messagerie").download(chemin);
      attendu("la Principale télécharge le PDF", !dlErr, dlErr?.message);
      const { error: exeErr } = await en.storage.from("messagerie")
        .upload(`${demo.id}/${directe}/sonde.exe`, new Blob(["MZ"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" });
      attendu("REFUS d'un exécutable (types du bucket)", !!exeErr);
    }

    console.log("\n— v3 · Pièces jointes d'annonce —");
    {
      const { data: a, error: pErr } = await di.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.direction.id, titre: "SONDE-PJ", corps: "SONDE-PJ", a_enseignants: true,
      }).select("id").single();
      attendu("la direction publie une annonce", !pErr && !!a, pErr?.message);
      if (a) annonces.push(a.id);
      const chemin = `${demo.id}/annonces/${a?.id}/note.pdf`;
      const { error: upErr } = await di.storage.from("messagerie")
        .upload(chemin, new Blob(["%PDF-1.4 note"], { type: "application/pdf" }), { contentType: "application/pdf" });
      attendu("l'auteur dépose la pièce jointe", !upErr, upErr?.message);
      if (!upErr) fichiers.push(chemin);
      const { error: upCoErr } = await co.storage.from("messagerie")
        .upload(`${demo.id}/annonces/${a?.id}/pirate.pdf`, new Blob(["x"], { type: "application/pdf" }), { contentType: "application/pdf" });
      attendu("REFUS : dépôt par une autre que l'auteur", !!upCoErr);
      const { error: jErr } = await di.rpc("msg_annonce_joindre", { p_id: a?.id, p_pieces: [{ path: chemin, nom: "note.pdf", type: "application/pdf", taille: 13 }] });
      attendu("l'auteur enregistre la pièce jointe", !jErr, jErr?.message);
      const { error: dlEn } = await en.storage.from("messagerie").download(chemin);
      attendu("l'enseignant (destinataire) la télécharge", !dlEn, dlEn?.message);
      const { data: dlCo } = await co.storage.from("messagerie").download(chemin);
      attendu("la comptable (non visée) NE la télécharge PAS", !dlCo);
    }

    console.log("\n— v3 · Appel de groupe —");
    {
      const { error: coLance } = await co.rpc("msg_reunion_demarrer", { p_conv: groupeId });
      attendu("hiérarchie : REFUS, la comptable (hors périmètre de l'enseignant) ne lance pas l'appel", !!coLance);
      const { data: reunion, error: rErr } = await di.rpc("msg_reunion_demarrer", { p_conv: groupeId });
      attendu("la direction (admin du groupe) lance l'appel de groupe", !rErr && !!reunion, rErr?.message);
      const { data: vueEn } = await en.from("msg_reunions").select("id").eq("id", reunion);
      attendu("l'enseignant (membre) voit l'appel", (vueEn || []).length === 1);
      const { error: forgeErr } = await en.from("msg_reunion_participants").insert({
        reunion_id: reunion, compte_id: comptes.enseignant.id, ecole_id: demo.id, session_id: "forgee",
      });
      attendu("REFUS : s'inscrire avec une session forgée (RLS)", forgeErr?.code === "42501", forgeErr?.message || "accepté");
      // Serveur d'appels : activé (session Cloudflare) ou explicitement non configuré.
      const { data: rej, error: rejErr } = await di.functions.invoke("reunion", { body: { action: "rejoindre", reunionId: reunion } });
      const statut = rejErr?.context?.status;
      let corpsErr = null;
      try { corpsErr = await rejErr?.context?.json?.(); } catch { /* pas de JSON */ }
      const detail = corpsErr?.error || corpsErr?.message || rejErr?.message || "";
      if (rej?.sessionId) {
        attendu("Edge reunion : session Cloudflare créée (appels de groupe ACTIVÉS)", true);
        const { data: parts } = await en.from("msg_reunion_participants").select("compte_id, session_id").eq("reunion_id", reunion);
        attendu("… participante visible des membres", (parts || []).some((p) => p.compte_id === comptes.direction.id && p.session_id));
        const { data: rejDi, error: rejDiErr } = await sessions.enseignant.functions.invoke("reunion", { body: { action: "recevoir", reunionId: reunion, pistes: [] } });
        attendu("… « recevoir » refusé tant qu'on n'a pas rejoint", !!rejDiErr && !rejDi?.ok);
      } else {
        const inactif = statut === 503 || /pas encore activés|non configuré/i.test(detail);
        const absente = statut === 404 || /not found/i.test(detail);
        console.log(`  ℹ️  Edge reunion : ${inactif ? "déployée mais NON configurée (secrets CF_REALTIME_*)" : absente ? "non déployée" : `réponse : ${detail}`}`);
        if (!inactif && !absente) attendu("Edge reunion : réponse attendue", false, detail);
      }
      const { error: qErr } = await di.rpc("msg_reunion_quitter", { p_reunion: reunion });
      attendu("la direction quitte l'appel", !qErr, qErr?.message);
      const { data: fin } = await svc.from("msg_reunions").select("statut").eq("id", reunion).single();
      attendu("appel clos (plus personne)", fin?.statut === "termine");
    }

    // ── Hiérarchie (messagerie-hierarchie.sql) ──
    console.log("\n— Hiérarchie —");
    {
      const refusHierarchie = (e) => e?.code === "42501" || /hiérarchie|périmètre/i.test(e?.message || "");
      const { error: e1 } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.comptable.id });
      attendu("REFUS : l'enseignant n'ouvre pas de discussion avec la comptable", refusHierarchie(e1), e1?.message || "accepté");
      const { error: e2 } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.direction.id });
      attendu("REFUS : l'enseignant n'ouvre pas de discussion avec le Fondateur", refusHierarchie(e2), e2?.message || "accepté");
      const { error: e3 } = await co.rpc("msg_ouvrir_directe", { p_compte: comptes.enseignant.id });
      attendu("REFUS : la comptable n'ouvre pas de discussion avec l'enseignant", refusHierarchie(e3), e3?.message || "accepté");
      const { data: coPr, error: e4 } = await co.rpc("msg_ouvrir_directe", { p_compte: comptes.college.id });
      attendu("la comptable écrit à la Principale (responsables entre eux)", !e4 && !!coPr, e4?.message);
      if (coPr) conversations.push(coPr);
      const { data: diEn, error: e5 } = await di.rpc("msg_ouvrir_directe", { p_compte: comptes.enseignant.id });
      attendu("le Fondateur écrit à l'enseignant", !e5 && !!diEn, e5?.message);
      if (diEn) conversations.push(diEn);
      const { data: enDi, error: e6 } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.direction.id });
      attendu("… l'enseignant peut alors rouvrir la discussion pour répondre", !e6 && enDi === diEn, e6?.message);
      const { error: e7 } = await en.rpc("msg_appel_lancer", { p_conv: diEn, p_offre: {} });
      attendu("… mais pas rappeler le Fondateur", refusHierarchie(e7), e7?.message || "accepté");
      const { data: a, error: e8 } = await pr.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.college.id, titre: "SONDE-HIERARCHIE", corps: "SONDE-HIERARCHIE", a_tous: true,
      }).select("id").single();
      attendu("la Principale publie « à tous »", !e8 && !!a, e8?.message);
      if (a) annonces.push(a.id);
      const { data: vuEnA } = await en.from("msg_annonces").select("id").eq("id", a?.id);
      const { data: vuCoA } = await co.from("msg_annonces").select("id").eq("id", a?.id);
      attendu("… reçue par l'enseignant du collège et la comptable", (vuEnA || []).length === 1 && (vuCoA || []).length === 1);
      const { data: dest } = await svc.rpc("msg_annonce_destinataires", { p_annonce: a?.id }).then((r) => r, () => ({ data: null }));
      if (Array.isArray(dest)) {
        const { data: prim } = await svc.from("comptes").select("id").eq("ecole_id", demo.id).eq("role", "enseignant").in("section", ["primaire", "prescolaire"]);
        const ids = new Set(dest.map((d) => (typeof d === "string" ? d : d.msg_annonce_destinataires)));
        attendu("… et PAS par les enseignants du primaire", !(prim || []).some((p) => ids.has(p.id)));
      }
    }

    // ── Parents & enseignants d'une même branche (messagerie-parents.sql) ──
    console.log("\n— Parents & enseignants d'une même branche —");
    {
      const refus = (e) => e?.code === "42501" || /hiérarchie|périmètre|groupe/i.test(e?.message || "");
      const { data: enEn2, error: b1 } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.enseignant2.id });
      attendu("prof du collège → prof du lycée (même branche) : discussion directe", !b1 && !!enEn2, b1?.message);
      if (enEn2) conversations.push(enEn2);
      const { data: en2Lu } = await en2.rpc("msg_boite");
      attendu("… que le prof du lycée retrouve dans sa boîte", (en2Lu || []).some((x) => x.id === enEn2));

      const { data: annPa, error: p0 } = await pa.rpc("msg_annuaire");
      const autres = (annPa || []).filter((x) => x.id !== comptes.parent.id);
      attendu("le parent ne voit que des personnes qu'il peut contacter", !p0 && autres.length > 0 && autres.every((x) => x.contactable),
        p0?.message || JSON.stringify(autres.filter((x) => !x.contactable).map((x) => x.poste_cle)));
      attendu("… dont la direction, la Principale et la comptable",
        [comptes.direction.id, comptes.college.id, comptes.comptable.id].every((id) => autres.some((x) => x.id === id)));
      attendu("… et AUCUN enseignant ni autre parent", !autres.some((x) => x.role === "enseignant" || x.role === "parent"));
      const { data: annPr } = await pr.rpc("msg_annuaire");
      const ligneParent = (annPr || []).find((x) => x.id === comptes.parent.id);
      attendu("la Principale voit le parent, avec l'enfant et sa classe", ligneParent?.poste === "Parent · Élève SONDE (SONDE-6A)", ligneParent?.poste);
      const { data: annEn } = await en.rpc("msg_annuaire");
      attendu("l'enseignant ne voit aucun parent", !(annEn || []).some((x) => x.role === "parent"));

      const { data: paPr, error: p1 } = await pa.rpc("msg_ouvrir_directe", { p_compte: comptes.college.id });
      attendu("le parent écrit en premier à la Principale", !p1 && !!paPr, p1?.message);
      if (paPr) conversations.push(paPr);
      const { error: p2 } = await pa.from("msg_messages").insert({
        conversation_id: paPr, ecole_id: demo.id, de_compte_id: comptes.parent.id, type: "texte", corps: "SONDE-PARENT",
      });
      attendu("… et lui envoie un message", !p2, p2?.message);
      const { data: luPr } = await pr.from("msg_messages").select("corps").eq("conversation_id", paPr);
      attendu("… que la Principale lit", (luPr || []).some((x) => x.corps === "SONDE-PARENT"));
      const { error: p3 } = await pa.rpc("msg_ouvrir_directe", { p_compte: comptes.enseignant.id });
      attendu("REFUS : le parent n'écrit pas à un enseignant", refus(p3), p3?.message || "accepté");
      const { error: p4 } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.parent.id });
      attendu("REFUS : un enseignant n'écrit pas à un parent", refus(p4), p4?.message || "accepté");
      const { data: coPa, error: p5 } = await co.rpc("msg_ouvrir_directe", { p_compte: comptes.parent.id });
      attendu("la comptable écrit au parent", !p5 && !!coPa, p5?.message);
      if (coPa) conversations.push(coPa);
      const { error: p6 } = await pa.rpc("msg_creer_groupe", { p_titre: "SONDE", p_membres: [comptes.college.id] });
      attendu("REFUS : un parent ne crée pas de groupe", refus(p6), p6?.message || "accepté");

      const { data: aPa, error: p7 } = await pr.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.college.id, titre: "SONDE-PARENTS", corps: "SONDE-PARENTS",
        a_parents_classes: ["college|SONDE-6A"],
      }).select("id").single();
      attendu("la Principale publie une annonce aux parents de la classe", !p7 && !!aPa, p7?.message);
      if (aPa) annonces.push(aPa.id);
      const { data: vuPa } = await pa.from("msg_annonces").select("id").eq("id", aPa?.id);
      attendu("… que le parent lit", (vuPa || []).length === 1);
      const { data: vuEn } = await en.from("msg_annonces").select("id").eq("id", aPa?.id);
      attendu("… et pas l'enseignant", (vuEn || []).length === 0);
      const { data: aTous } = await di.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.direction.id, titre: "SONDE-EQUIPE", corps: "SONDE-EQUIPE", a_tous: true,
      }).select("id").single();
      if (aTous) annonces.push(aTous.id);
      const { data: vuTous } = await pa.from("msg_annonces").select("id").eq("id", aTous?.id);
      attendu("« Toute l'équipe » ne va pas aux parents", !!aTous && (vuTous || []).length === 0);
      const { error: p8 } = await pa.from("msg_annonces").insert({
        ecole_id: demo.id, de_compte_id: comptes.parent.id, corps: "SONDE-PIRATE", a_parents: true,
      });
      attendu("REFUS : un parent ne publie pas d'annonce", !!p8, "acceptée");

      await pa.rpc("msg_presence", { p_etat: "actif" });
      await en.rpc("msg_presence", { p_etat: "actif" });
      const { data: presPr } = await pr.rpc("msg_presences");
      attendu("la Principale voit le parent en ligne", (presPr || []).some((x) => x.compte_id === comptes.parent.id && x.etat === "actif"));
      const { data: presPa } = await pa.rpc("msg_presences");
      attendu("le parent ne voit pas la présence d'un enseignant", !(presPa || []).some((x) => x.compte_id === comptes.enseignant.id));
    }

    // ── Présence (presence.sql) ──
    console.log("\n— Présence —");
    {
      const { error: sErr } = await en.rpc("msg_presence", { p_etat: "actif" });
      attendu("l'enseignant signale sa présence", !sErr, sErr?.message);
      await co.rpc("msg_presence", { p_etat: "absent" });
      const { data: pres, error: lErr } = await di.rpc("msg_presences");
      const parId = new Map((pres || []).map((p) => [p.compte_id, p]));
      attendu("la direction voit l'enseignant « actif »", !lErr && parId.get(comptes.enseignant.id)?.etat === "actif", lErr?.message);
      attendu("… et la comptable « absent »", parId.get(comptes.comptable.id)?.etat === "absent");
      const { data: brut } = await en.from("msg_presences").select("compte_id");
      attendu("lecture directe de la table refusée (RLS)", (brut || []).length === 0);
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: anonErr } = await anon.rpc("msg_presences");
      attendu("anon : EXECUTE refusé sur msg_presences", /permission denied/i.test(anonErr?.message || ""), anonErr?.message || "aucune erreur");
    }
  } finally {
    // ── Nettoyage complet ──
    if (fichiers.length) await svc.storage.from("messagerie").remove(fichiers);
    if (conversations.length) await svc.from("msg_conversations").delete().in("id", conversations.filter(Boolean));
    if (annonces.length) await svc.from("msg_annonces").delete().in("id", annonces);
    await svc.from("msg_annonces").delete().eq("ecole_id", demo.id).like("corps", "SONDE%");
    await svc.from("eleves").delete().eq("ecole_id", demo.id).eq("classe", "SONDE-6A");
    for (const t of Object.values(comptes)) {
      await svc.from("comptes").delete().eq("id", t.id);
      await svc.auth.admin.deleteUser(t.userId);
    }
  }
  console.log(`\nNettoyage fait. ${echecs === 0 ? "🎉 TOUTES LES SONDES PASSENT" : `⚠️ ${echecs} sonde(s) en échec`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
