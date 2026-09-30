// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes de la messagerie v2 (messagerie-v2.sql)
// ═══════════════════════════════════════════════════════════════════════════
// Crée trois comptes de test JETABLES sur l'École Démo (direction, comptable,
// enseignant), vérifie PAR LA BASE la confidentialité des discussions, des
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
  for (const role of ["direction", "comptable", "enseignant"]) {
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
      user_id: u.user.id, ecole_id: demo.id, login, role, nom: `Test msg ${role}`, label: role,
      poste_id: role === "enseignant" ? null : posteId[role] || null, premiere_co: false,
      ...(role === "enseignant" ? { enseignant_nom: "Test msg enseignant", matiere: "Maths" } : {}),
    }).select("id").single();
    if (ce) { console.error(`création ${role} impossible: ${ce.message}`); process.exit(1); }
    comptes[role] = { id: c.id, userId: u.user.id };
    const cli = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: se } = await cli.auth.signInWithPassword({ email, password: pass });
    if (se) { console.error(`connexion ${role} impossible: ${se.message}`); process.exit(1); }
    sessions[role] = cli;
  }
  const { direction: di, comptable: co, enseignant: en } = sessions;
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
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: anonErr } = await anon.rpc("msg_boite");
      attendu("anon : EXECUTE refusé sur msg_boite", /permission denied/i.test(anonErr?.message || ""), anonErr?.message || "aucune erreur");
    }

    console.log("\n— Discussion directe + temps réel —");
    const { data: directe, error: dErr } = await en.rpc("msg_ouvrir_directe", { p_compte: comptes.comptable.id });
    attendu("l'enseignant ouvre une discussion avec la comptable", !dErr && !!directe, dErr?.message);
    conversations.push(directe);

    // Temps réel : la comptable doit recevoir le message, la direction non.
    const recus = { comptable: [], direction: [] };
    const canaux = [];
    for (const [qui, cli] of [["comptable", co], ["direction", di]]) {
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
    attendu("temps réel : la comptable reçoit le message", recus.comptable.some((m) => m.corps === "SONDE-MSG"),
      "rien reçu — vérifier la publication supabase_realtime (section 9 du SQL)");
    attendu("temps réel : la direction ne reçoit RIEN", recus.direction.length === 0);
    for (const [cli, ch] of canaux) await cli.removeChannel(ch);

    const { data: vuCo } = await co.from("msg_messages").select("corps").eq("conversation_id", directe);
    attendu("la comptable lit le message", (vuCo || []).some((m) => m.corps === "SONDE-MSG"));
    const { data: vuDi } = await di.from("msg_messages").select("corps").eq("conversation_id", directe);
    attendu("la direction NE lit PAS une discussion privée", (vuDi || []).length === 0);
    const { data: boite } = await co.rpc("msg_boite");
    attendu("boîte de la comptable : 1 non lu", (boite || []).find((c) => c.id === directe)?.non_lus === 1);

    console.log("\n— Message vocal (bucket privé) —");
    {
      const chemin = `${demo.id}/${directe}/sonde.webm`;
      const { error: upErr } = await en.storage.from("messagerie")
        .upload(chemin, new Blob([new Uint8Array([26, 69, 223, 163])], { type: "audio/webm" }), { contentType: "audio/webm" });
      attendu("l'enseignant dépose un vocal dans sa discussion", !upErr, upErr?.message);
      if (!upErr) fichiers.push(chemin);
      const { error: dlCo } = await co.storage.from("messagerie").download(chemin);
      attendu("la comptable le télécharge", !dlCo, dlCo?.message);
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
      const { data: appel, error: aErr } = await co.rpc("msg_appel_lancer", { p_conv: directe, p_offre: { type: "offer", sdp: "sonde" } });
      attendu("la comptable appelle l'enseignant", !aErr && !!appel, aErr?.message);
      const { data: vuAppel } = await di.from("msg_appels").select("id").eq("id", appel);
      attendu("la direction ne voit pas l'appel", (vuAppel || []).length === 0);
      const { error: rErr } = await en.rpc("msg_appel_repondre", { p_id: appel, p_reponse: { type: "answer", sdp: "sonde" } });
      attendu("l'enseignant répond", !rErr, rErr?.message);
      await en.rpc("msg_appel_terminer", { p_id: appel, p_statut: "termine" });
      const { data: trace } = await co.from("msg_messages").select("corps").eq("conversation_id", directe).eq("type", "appel");
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
      const { error: dlErr } = await co.storage.from("messagerie").download(chemin);
      attendu("la comptable télécharge le PDF", !dlErr, dlErr?.message);
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
      const { data: reunion, error: rErr } = await co.rpc("msg_reunion_demarrer", { p_conv: groupeId });
      attendu("la comptable lance un appel de groupe", !rErr && !!reunion, rErr?.message);
      const { data: vueEn } = await en.from("msg_reunions").select("id").eq("id", reunion);
      attendu("l'enseignant (membre) voit l'appel", (vueEn || []).length === 1);
      const { error: forgeErr } = await en.from("msg_reunion_participants").insert({
        reunion_id: reunion, compte_id: comptes.enseignant.id, ecole_id: demo.id, session_id: "forgee",
      });
      attendu("REFUS : s'inscrire avec une session forgée (RLS)", forgeErr?.code === "42501", forgeErr?.message || "accepté");
      // Serveur d'appels : activé (session Cloudflare) ou explicitement non configuré.
      const { data: rej, error: rejErr } = await co.functions.invoke("reunion", { body: { action: "rejoindre", reunionId: reunion } });
      const statut = rejErr?.context?.status;
      let corpsErr = null;
      try { corpsErr = await rejErr?.context?.json?.(); } catch { /* pas de JSON */ }
      const detail = corpsErr?.error || corpsErr?.message || rejErr?.message || "";
      if (rej?.sessionId) {
        attendu("Edge reunion : session Cloudflare créée (appels de groupe ACTIVÉS)", true);
        const { data: parts } = await en.from("msg_reunion_participants").select("compte_id, session_id").eq("reunion_id", reunion);
        attendu("… participante visible des membres", (parts || []).some((p) => p.compte_id === comptes.comptable.id && p.session_id));
        const { data: rejDi, error: rejDiErr } = await sessions.enseignant.functions.invoke("reunion", { body: { action: "recevoir", reunionId: reunion, pistes: [] } });
        attendu("… « recevoir » refusé tant qu'on n'a pas rejoint", !!rejDiErr && !rejDi?.ok);
      } else {
        const inactif = statut === 503 || /pas encore activés|non configuré/i.test(detail);
        const absente = statut === 404 || /not found/i.test(detail);
        console.log(`  ℹ️  Edge reunion : ${inactif ? "déployée mais NON configurée (secrets CF_REALTIME_*)" : absente ? "non déployée" : `réponse : ${detail}`}`);
        if (!inactif && !absente) attendu("Edge reunion : réponse attendue", false, detail);
      }
      const { error: qErr } = await co.rpc("msg_reunion_quitter", { p_reunion: reunion });
      attendu("la comptable quitte l'appel", !qErr, qErr?.message);
      const { data: fin } = await svc.from("msg_reunions").select("statut").eq("id", reunion).single();
      attendu("appel clos (plus personne)", fin?.statut === "termine");
    }
  } finally {
    // ── Nettoyage complet ──
    if (fichiers.length) await svc.storage.from("messagerie").remove(fichiers);
    if (conversations.length) await svc.from("msg_conversations").delete().in("id", conversations.filter(Boolean));
    if (annonces.length) await svc.from("msg_annonces").delete().in("id", annonces);
    await svc.from("msg_annonces").delete().eq("ecole_id", demo.id).like("corps", "SONDE%");
    for (const t of Object.values(comptes)) {
      await svc.from("comptes").delete().eq("id", t.id);
      await svc.auth.admin.deleteUser(t.userId);
    }
  }
  console.log(`\nNettoyage fait. ${echecs === 0 ? "🎉 TOUTES LES SONDES PASSENT" : `⚠️ ${echecs} sonde(s) en échec`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
