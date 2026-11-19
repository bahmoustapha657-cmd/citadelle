// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function PUBLIQUE : inscription d'une nouvelle école
// ════════════════════════════════════════════════════════════════════════
// Auto-enregistrement d'une école (aucun appelant authentifié) : crée l'école
// + le compte DIRECTION (auth user + ligne comptes). Les autres comptes sont
// créés ensuite par l'admin. service_role reste côté serveur.
//
// Deux profils : une ÉCOLE (corps habituel) ou un ENSEIGNANT INDÉPENDANT
// (`typeEspace: "enseignant"`, voir enseignant.ts) qui ouvre son espace
// gratuit sans que son école utilise EduGest.
//
// Déploiement : supabase functions deploy inscription
// (publique : pas de JWT requis ; la clé anon suffit côté client.)
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { codeReserveEnseignant, ligneCompteEnseignant, ligneEcoleEnseignant, validerInscriptionEnseignant } from "./enseignant.ts";
import { statutEtablissement } from "./ecole.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOMAIN = "edugest.app";
const RESERVES = new Set(["superadmin", "admin", "api", "www", "demo"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function genSlug(nom: string): string {
  return String(nom || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// Espace d'un enseignant indépendant : son numéro est le code de l'espace et
// son identifiant. Un numéro déjà pris renvoie 409 (il a déjà son espace).
async function inscrireEnseignant(admin: SupabaseClient, corps: Record<string, unknown>) {
  const f = validerInscriptionEnseignant(corps);
  if ("error" in f) return json({ error: f.error }, f.status);

  const { data: exist } = await admin.from("ecoles").select("id").eq("code", f.code).maybeSingle();
  if (exist) {
    return json({ error: "Un espace existe déjà pour ce numéro. Connectez-vous, ou utilisez « Mot de passe oublié »." }, 409);
  }

  const { data: ecole, error: eErr } = await admin.from("ecoles")
    .insert(ligneEcoleEnseignant(f)).select("id").single();
  if (eErr) return json({ error: eErr.message }, 500);

  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email: `${f.login}.${f.code}@${DOMAIN}`, password: f.mdp, email_confirm: true,
    user_metadata: { login: f.login, schoolId: f.code },
  });
  if (uErr || !created?.user) {
    await admin.from("ecoles").delete().eq("id", ecole.id);
    return json({ error: uErr?.message || "Création du compte impossible." }, 500);
  }
  const { error: cErr } = await admin.from("comptes").insert(ligneCompteEnseignant(f, created.user.id, ecole.id));
  if (cErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("ecoles").delete().eq("id", ecole.id);
    return json({ error: cErr.message }, 500);
  }
  return json({ ok: true, schoolId: f.code, login: f.login, typeEspace: "enseignant" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const corps = await req.json().catch(() => ({}));
    const { nomEcole, ville, pays, responsable, telephone, email: contactEmail, website, adminLogin, adminMdp } = corps;
    // Honeypot anti-bot : champ masqué côté client, un humain ne le remplit jamais.
    // On répond succès factice pour ne pas révéler la détection au bot.
    if (website?.trim()) return json({ ok: true, schoolId: genSlug(nomEcole || corps.etablissement) });
    if (corps.typeEspace === "enseignant") return await inscrireEnseignant(admin, corps);
    if (!nomEcole?.trim()) return json({ error: "Le nom de l'école est requis." }, 400);
    if (!ville?.trim()) return json({ error: "La ville est requise." }, 400);
    if (!responsable?.trim()) return json({ error: "Le nom du responsable est requis." }, 400);
    const telDigits = String(telephone || "").replace(/[^0-9]/g, "");
    if (telDigits.length < 8) return json({ error: "Numéro de téléphone invalide." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(contactEmail || "").trim())) return json({ error: "Adresse email invalide." }, 400);
    const login = String(adminLogin || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(login)) return json({ error: "Identifiant admin invalide (3 à 30 caractères : lettres, chiffres, . _ -)." }, 400);
    if (!adminMdp || adminMdp.length < 8) return json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, 400);

    const code = genSlug(nomEcole);
    if (code.length < 2 || RESERVES.has(code)) return json({ error: "Le nom produit un code réservé ou invalide. Choisissez un autre nom." }, 400);
    // Un code fait de chiffres seuls (ou « numéro-rang ») est celui d'un
    // espace enseignant : réservé (codeReserveEnseignant, enseignant.ts).
    if (codeReserveEnseignant(code)) return json({ error: "Le nom de l'école ne peut pas être un simple numéro." }, 400);

    const { data: exist } = await admin.from("ecoles").select("id").eq("code", code).maybeSingle();
    if (exist) return json({ error: "Une école avec ce nom existe déjà. Choisissez un autre nom." }, 409);

    // École ACTIVE dès l'inscription : la direction se connecte immédiatement.
    // Il y avait auparavant une validation par le superadmin (école créée
    // `actif: false`, activée depuis Panel Super-Admin > Écoles > Réactiver) —
    // retirée sur décision produit le 2026-08-14 pour ne plus faire attendre
    // les établissements. Contrepartie assumée : n'importe qui peut créer une
    // école fonctionnelle. Le superadmin garde la main a posteriori
    // (Désactiver / Supprimer) et voit les nouvelles écoles dans son panneau.
    const { data: ecole, error: eErr } = await admin.from("ecoles").insert({
      code, nom: nomEcole.trim(), pays: (pays || "Guinée").trim(),
      plan: "gratuit", actif: true,
      extra: {
        ville: ville.trim(), createdAt: Date.now(), securityVersion: 2,
        responsable: responsable.trim(), telephone: telDigits, email: contactEmail.trim(),
        // École publique ou privée (ecole.ts) : l'offre proposée d'abord.
        statutEtablissement: statutEtablissement(corps.statutEtablissement),
      },
    }).select("id").single();
    if (eErr) return json({ error: eErr.message }, 500);

    // Compte direction (auth user + ligne comptes)
    const email = `${login}.${code}@${DOMAIN}`;
    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email, password: adminMdp, email_confirm: true, user_metadata: { login, schoolId: code },
    });
    if (uErr || !created?.user) {
      await admin.from("ecoles").delete().eq("id", ecole.id); // rollback école
      return json({ error: uErr?.message || "Création du compte admin impossible." }, 500);
    }
    const { error: cErr } = await admin.from("comptes").insert({
      user_id: created.user.id, ecole_id: ecole.id, login, role: "direction",
      nom: "Direction", label: "Direction", statut: "Actif", premiere_co: true,
    });
    if (cErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("ecoles").delete().eq("id", ecole.id);
      return json({ error: cErr.message }, 500);
    }

    return json({ ok: true, schoolId: code });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
