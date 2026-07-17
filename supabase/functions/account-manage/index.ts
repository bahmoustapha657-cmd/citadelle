// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : gestion de comptes (création + reset mot de passe)
// ════════════════════════════════════════════════════════════════════════
// Opérations qui exigent les privilèges admin (auth.admin.*) → impossibles côté
// client. Le service_role reste ICI, jamais exposé au navigateur.
//
// Déploiement (aucun secret à poser : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
// sont injectés d'office dans les Edge Functions) :
//   supabase functions deploy account-manage
//
// Le client appelle via supabase.functions.invoke("account-manage", { body }).
// Auth : le JWT de l'appelant (header Authorization) identifie son compte ; on
// vérifie qu'il a le droit de gérer le rôle cible (mêmes règles que le serveur).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOMAIN = "edugest.app";

const ROLES_VALIDES = new Set(["direction", "admin", "comptable", "surveillant", "primaire", "college", "staff", "enseignant", "parent"]);
const ROLES_SYSTEME = new Set(["direction", "admin", "comptable", "surveillant", "primaire", "college"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Mêmes règles d'autorisation que api/_lib/handlers/account-manage.js.
// `callerAdminPanel` : le poste de l'appelant écrit-il le module admin_panel ?
// (postes flexibles — permet de gérer les comptes de personnel `staff`).
function peutGererRole(callerRole: string, targetRole: string, targetSection?: string, callerAdminPanel = false): boolean {
  if (callerRole === "superadmin" || callerRole === "direction") return true;
  // Personne d'autre ne touche à la direction (anti-escalade).
  if (targetRole === "direction") return false;
  if (targetRole === "staff" || ROLES_SYSTEME.has(targetRole)) return callerAdminPanel;
  if (callerRole === "admin") return ["enseignant", "parent"].includes(targetRole);
  if (callerRole === "comptable") return targetRole === "parent";
  if (callerRole === "primaire") return targetRole === "enseignant" && targetSection === "primaire";
  if (callerRole === "college") return targetRole === "enseignant" && (targetSection === "college" || targetSection === "lycee");
  // Poste flexible : parents/enseignants gérables avec l'écriture admin_panel.
  if (callerRole === "staff") return callerAdminPanel && ["enseignant", "parent"].includes(targetRole);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Non authentifié." }, 401);
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user) return json({ error: "Session invalide." }, 401);

    const { data: caller } = await admin.from("comptes").select("*").eq("user_id", user.id).maybeSingle();
    if (!caller) return json({ error: "Compte appelant introuvable." }, 403);

    // Postes flexibles : l'écriture admin_panel du poste de l'appelant ouvre
    // la gestion des comptes de personnel (jamais la direction).
    let callerAdminPanel = false;
    if (caller.poste_id) {
      const { data: postePerm } = await admin.from("postes")
        .select("permissions, actif").eq("id", caller.poste_id).maybeSingle();
      callerAdminPanel = !!postePerm?.actif && postePerm?.permissions?.admin_panel === "ecriture";
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // École cible : celle de l'appelant (superadmin : peut viser via schoolId).
    let ecoleId = caller.ecole_id as string | null;
    let schoolCode = "";
    if (caller.role === "superadmin" && body.schoolId) {
      const { data: ec } = await admin.from("ecoles").select("id, code").eq("code", String(body.schoolId).toLowerCase()).maybeSingle();
      if (!ec) return json({ error: "École introuvable." }, 404);
      ecoleId = ec.id; schoolCode = ec.code;
    } else {
      if (!ecoleId) return json({ error: "Appelant sans école." }, 403);
      const { data: ec } = await admin.from("ecoles").select("code").eq("id", ecoleId).maybeSingle();
      schoolCode = ec?.code || "";
    }

    if (action === "create") {
      const login = String(body.login || "").trim().toLowerCase();
      const role = String(body.role || "");
      const mdp = String(body.mdp || "");
      if (!login || !role || !mdp) return json({ error: "Champs requis : login, role, mdp." }, 400);
      if (!ROLES_VALIDES.has(role)) return json({ error: "Rôle invalide." }, 400);
      if (mdp.length < 8) return json({ error: "Mot de passe : 8 caractères minimum." }, 400);
      if (!peutGererRole(caller.role, role, body.section, callerAdminPanel)) return json({ error: "Droits insuffisants pour créer ce compte." }, 403);

      // Poste : requis pour un compte `staff`, et toujours de la même école.
      const posteId = body.posteId ? String(body.posteId) : null;
      if (role === "staff" && !posteId) return json({ error: "Un compte de personnel doit être rattaché à un poste." }, 400);
      if (posteId) {
        const { data: poste } = await admin.from("postes").select("id, ecole_id").eq("id", posteId).maybeSingle();
        if (!poste || poste.ecole_id !== ecoleId) return json({ error: "Poste introuvable pour cette école." }, 404);
      }

      // Doublon de login dans l'école ?
      const { data: exist } = await admin.from("comptes").select("id").eq("ecole_id", ecoleId).eq("login", login).maybeSingle();
      if (exist) return json({ error: "Un compte existe déjà avec cet identifiant." }, 409);

      const email = `${login}.${schoolCode}@${DOMAIN}`;
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: mdp, email_confirm: true,
        user_metadata: { login, schoolId: schoolCode },
      });
      if (cErr || !created?.user) {
        // E-mail déjà pris côté auth → on récupère l'utilisateur existant.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
        const u = list.users.find((x) => x.email === email);
        if (!u) return json({ error: cErr?.message || "Création auth impossible." }, 500);
        await admin.auth.admin.updateUserById(u.id, { password: mdp, email_confirm: true });
        created.user = u;
      }
      const uid = created.user.id;

      const extra: Record<string, unknown> = {};
      for (const k of ["eleveNom", "eleveClasse", "tuteur", "contactTuteur", "filiation"]) if (body[k]) extra[k] = body[k];
      const eleveIds: string[] = Array.isArray(body.eleveIds) ? body.eleveIds : (body.eleveId ? [body.eleveId] : []);
      if (eleveIds.length) extra.eleveIds = eleveIds;
      if (body.eleveId) extra.eleveId = body.eleveId;

      // E-mail réel optionnel (connexion par e-mail) — unicité par école.
      const emailReel = body.email ? String(body.email).trim().toLowerCase() : null;
      if (emailReel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailReel)) {
        return json({ error: "Adresse e-mail invalide." }, 400);
      }

      const { data: compte, error: insErr } = await admin.from("comptes").insert({
        user_id: uid, ecole_id: ecoleId, login, role,
        poste_id: posteId, email: emailReel,
        nom: body.nom || login, label: body.label || role,
        section: body.section || null,
        sections: Array.isArray(body.sections) ? body.sections : null,
        enseignant_id: body.enseignantId || null,
        enseignant_nom: body.enseignantNom || null,
        matiere: body.matiere || null,
        statut: body.statut || "Actif",
        premiere_co: true,
        extra,
      }).select("id").single();
      if (insErr) {
        const dup = /idx_comptes_ecole_email|duplicate/i.test(insErr.message);
        return json({ error: dup ? "Cet e-mail est déjà utilisé par un autre compte de l'école." : insErr.message }, dup ? 409 : 500);
      }

      // Parent : liens parent_eleves (RLS my_eleve_ids).
      if (role === "parent" && eleveIds.length) {
        await admin.from("parent_eleves").upsert(
          eleveIds.map((eid) => ({ compte_id: compte.id, eleve_id: eid })),
          { onConflict: "compte_id,eleve_id" },
        );
      }
      return json({ ok: true, id: compte.id, login });
    }

    if (action === "reset_password") {
      const accountId = String(body.accountId || "");
      const mdp = String(body.mdp || "");
      if (!accountId || mdp.length < 8) return json({ error: "Compte ou mot de passe invalide (8 car. min)." }, 400);
      const { data: cible } = await admin.from("comptes").select("*").eq("id", accountId).maybeSingle();
      if (!cible || cible.ecole_id !== ecoleId) return json({ error: "Compte cible introuvable." }, 404);
      if (!peutGererRole(caller.role, cible.role, cible.section, callerAdminPanel)) return json({ error: "Droits insuffisants." }, 403);
      if (!cible.user_id) return json({ error: "Compte sans utilisateur auth." }, 409);
      const { error: pErr } = await admin.auth.admin.updateUserById(cible.user_id, { password: mdp });
      if (pErr) return json({ error: pErr.message }, 500);
      // Forcer le changement à la première connexion suivante.
      await admin.from("comptes").update({ premiere_co: true }).eq("id", accountId);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
