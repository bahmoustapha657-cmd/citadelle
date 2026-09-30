// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Sondes : école désactivée / abonnement expiré (ecole-hors-service.sql)
// ═══════════════════════════════════════════════════════════════════════════
// Crée une école JETABLE (code « sonde-hors-service ») avec trois comptes
// (direction, enseignant, parent) et un élève, fait passer l'école par les
// états normal → grâce → expiré → désactivée, vérifie PAR LA BASE ce que
// chacun peut lire et écrire — puis supprime tout. Aucune vraie école n'est
// touchée. Lancer : node supabase/test-ecole-hors-service.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const mdp = () => "T!" + randomBytes(12).toString("base64url");
const JOUR = 86400000;
const CODE = "sonde-hors-service";

let echecs = 0;
const attendu = (nom, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "❌"} ${nom}${!ok && detail ? `\n     ↳ ${detail}` : ""}`);
  if (!ok) echecs++;
};
const refusPar = (error, hint) => error?.hint === hint;
const detail = (error) => error ? `${error.code} ${error.message} (hint: ${error.hint})` : "accepté";

async function nettoyer() {
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of list.users.filter((x) => x.email?.startsWith("sonde-hs-"))) {
    await svc.auth.admin.deleteUser(u.id);
  }
  await svc.from("ecoles").delete().eq("code", CODE); // cascade : comptes, élèves, notes…
}

async function etat(ecoleId, champs) {
  const { error } = await svc.from("ecoles").update(champs).eq("id", ecoleId);
  if (error) throw new Error(`service_role ne peut pas changer l'école : ${error.message}`);
}

async function main() {
  await nettoyer();
  const { data: ecole, error: ee } = await svc.from("ecoles")
    .insert({ code: CODE, nom: "Sonde hors service", plan: "gratuit", actif: true }).select("id").single();
  if (ee) throw new Error(`création école : ${ee.message}`);
  const { data: eleve } = await svc.from("eleves")
    .insert({ ecole_id: ecole.id, section: "primaire", nom: "Sonde", prenom: "Élève" }).select("id").single();

  const s = {};
  const ids = {};
  for (const role of ["direction", "enseignant", "parent"]) {
    const email = `sonde-hs-${role}.${CODE}@edugest.app`;
    const pass = mdp();
    const { data: u, error } = await svc.auth.admin.createUser({ email, password: pass, email_confirm: true });
    if (error) throw new Error(`auth ${role} : ${error.message}`);
    const { data: c, error: ce } = await svc.from("comptes").insert({
      user_id: u.user.id, ecole_id: ecole.id, login: `sonde-hs-${role}`, role, nom: `Sonde ${role}`,
      label: role, premiere_co: false,
    }).select("id").single();
    if (ce) throw new Error(`compte ${role} : ${ce.message}`);
    ids[role] = c.id;
    const cli = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: se } = await cli.auth.signInWithPassword({ email, password: pass });
    if (se) throw new Error(`connexion ${role} : ${se.message}`);
    s[role] = cli;
  }
  await svc.from("parent_eleves").insert({ compte_id: ids.parent, eleve_id: eleve.id });
  const { direction: di, enseignant: en, parent: pa } = s;
  const classe = (nom) => ({ ecole_id: ecole.id, section: "primaire", nom });
  const note = { ecole_id: ecole.id, section: "primaire", eleve_id: eleve.id, matiere: "Maths", type: "Devoir", periode: "T1", note: 12 };
  const messageParent = { ecole_id: ecole.id, eleve_id: eleve.id, extra: { sujet: "Sonde", corps: "Sonde" } };

  try {
    console.log("\n— École normale (gratuit, active) —");
    {
      const { error } = await di.from("classes").insert(classe("SONDE-A"));
      attendu("la direction crée une classe", !error, detail(error));
      const { data: lusEn } = await en.from("eleves").select("id").eq("id", eleve.id);
      attendu("l'enseignant lit les élèves", (lusEn || []).length === 1);
      const { data: lusPa } = await pa.from("eleves").select("id").eq("id", eleve.id);
      attendu("le parent lit son enfant", (lusPa || []).length === 1);
    }

    console.log("\n— Premium échu depuis 1 jour (période de grâce) —");
    await etat(ecole.id, { plan: "premium", plan_expiry: Date.now() - JOUR });
    {
      const { error } = await di.from("classes").insert(classe("SONDE-B"));
      attendu("la direction écrit encore pendant la grâce", !error, detail(error));
    }

    console.log("\n— Premium échu depuis 5 jours (EXPIRÉ) —");
    await etat(ecole.id, { plan: "premium", plan_expiry: Date.now() - 5 * JOUR });
    {
      const { error: ins } = await di.from("classes").insert(classe("SONDE-C"));
      attendu("REFUS : la direction ne crée plus de classe", refusPar(ins, "abonnement_expire"), detail(ins));
      const { error: upd } = await di.from("classes").update({ nom: "SONDE-MODIF" }).eq("ecole_id", ecole.id).eq("nom", "SONDE-A");
      attendu("REFUS : ni ne modifie", refusPar(upd, "abonnement_expire"), detail(upd));
      const { error: del } = await di.from("classes").delete().eq("ecole_id", ecole.id).eq("nom", "SONDE-A");
      attendu("REFUS : ni ne supprime", refusPar(del, "abonnement_expire"), detail(del));
      const { error: nEn } = await en.from("notes").insert(note);
      attendu("REFUS : l'enseignant ne saisit plus de note", refusPar(nEn, "abonnement_expire"), detail(nEn));
      const { error: mPa } = await pa.from("messages").insert(messageParent);
      attendu("REFUS : le parent n'envoie plus de message", refusPar(mPa, "abonnement_expire"), detail(mPa));

      const { data: lusDi } = await di.from("classes").select("id").eq("ecole_id", ecole.id);
      attendu("la direction LIT toujours (2 classes)", (lusDi || []).length === 2, `${(lusDi || []).length} ligne(s)`);
      const { data: lusEn } = await en.from("eleves").select("id").eq("id", eleve.id);
      attendu("l'enseignant LIT toujours les élèves", (lusEn || []).length === 1);
      const { data: lusPa } = await pa.from("eleves").select("id").eq("id", eleve.id);
      attendu("le parent LIT toujours son enfant", (lusPa || []).length === 1);
      const { data: ec } = await di.from("ecoles").select("plan, plan_expiry").eq("id", ecole.id).maybeSingle();
      attendu("la direction voit son plan (pour renouveler)", ec?.plan === "premium");

      const { error: dp } = await di.from("demandes_plan").insert({ ecole_id: ecole.id, plan_demande: "premium" });
      attendu("la demande de renouvellement PASSE", !dp, detail(dp));
      const { error: pc } = await en.from("comptes").update({ premiere_co: false }).eq("id", ids.enseignant);
      attendu("la mise à jour de son propre compte PASSE", !pc, detail(pc));
      const { error: sr } = await svc.from("classes").insert(classe("SONDE-SERVICE"));
      attendu("service_role (Edge Functions, webhook) n'est pas bloqué", !sr, detail(sr));
    }

    console.log("\n— Renouvellement (échéance repoussée) —");
    await etat(ecole.id, { plan: "premium", plan_expiry: Date.now() + 30 * JOUR });
    {
      const { error } = await di.from("classes").insert(classe("SONDE-D"));
      attendu("l'écriture revient aussitôt", !error, detail(error));
    }

    console.log("\n— École DÉSACTIVÉE —");
    await etat(ecole.id, { actif: false });
    {
      const { data: comptes } = await di.from("comptes").select("id").eq("id", ids.direction);
      attendu("la direction ne lit même plus son compte (l'app déconnecte)", (comptes || []).length === 0);
      const { data: cl } = await di.from("classes").select("id").eq("ecole_id", ecole.id);
      attendu("la direction ne lit plus rien", (cl || []).length === 0, `${(cl || []).length} ligne(s)`);
      const { data: elEn } = await en.from("eleves").select("id").eq("ecole_id", ecole.id);
      attendu("l'enseignant ne lit plus rien", (elEn || []).length === 0);
      const { data: elPa } = await pa.from("eleves").select("id").eq("id", eleve.id);
      attendu("le parent ne lit plus rien", (elPa || []).length === 0);
      const { error: ins } = await di.from("classes").insert(classe("SONDE-E"));
      attendu("REFUS d'écrire", refusPar(ins, "ecole_hors_service"), detail(ins));
      const { error: re } = await di.from("ecoles").update({ actif: true }).eq("id", ecole.id);
      const { data: toujours } = await svc.from("ecoles").select("actif").eq("id", ecole.id).single();
      attendu("REFUS de se réactiver soi-même", toujours.actif === false, detail(re));
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data: pub } = await anon.rpc("etat_ecole", { p_code: CODE });
      attendu("l'écran de connexion voit « inactive »", pub?.[0]?.actif === false);
    }

    console.log("\n— Réactivation par EduGest —");
    await etat(ecole.id, { actif: true });
    {
      const { data: cl } = await di.from("classes").select("id").eq("ecole_id", ecole.id);
      attendu("tout redevient lisible", (cl || []).length === 4, `${(cl || []).length} ligne(s)`);
    }
  } finally {
    await nettoyer();
  }

  console.log(echecs ? `\n❌ ${echecs} sonde(s) en échec` : "\n✅ Toutes les sondes passent");
  process.exit(echecs ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\n💥", e.message);
  await nettoyer().catch(() => {});
  process.exit(1);
});
