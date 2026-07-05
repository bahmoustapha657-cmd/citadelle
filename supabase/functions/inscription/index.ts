// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function PUBLIQUE : inscription d'une nouvelle école
// ════════════════════════════════════════════════════════════════════════
// Auto-enregistrement d'une école (aucun appelant authentifié) : crée l'école
// + le compte DIRECTION (auth user + ligne comptes). Les autres comptes sont
// créés ensuite par l'admin. service_role reste côté serveur.
//
// Déploiement : supabase functions deploy inscription
// (publique : pas de JWT requis ; la clé anon suffit côté client.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const { nomEcole, ville, pays, responsable, telephone, email: contactEmail, website, adminLogin, adminMdp } = await req.json().catch(() => ({}));
    // Honeypot anti-bot : champ masqué côté client, un humain ne le remplit jamais.
    // On répond succès factice pour ne pas révéler la détection au bot.
    if (website?.trim()) return json({ ok: true, schoolId: genSlug(nomEcole) });
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

    const { data: exist } = await admin.from("ecoles").select("id").eq("code", code).maybeSingle();
    if (exist) return json({ error: "Une école avec ce nom existe déjà. Choisissez un autre nom." }, 409);

    // École créée inactive : en attente de validation par le superadmin
    // (voir Panel Super-Admin > Écoles > Réactiver).
    const { data: ecole, error: eErr } = await admin.from("ecoles").insert({
      code, nom: nomEcole.trim(), pays: (pays || "Guinée").trim(),
      plan: "gratuit", actif: false,
      extra: {
        ville: ville.trim(), createdAt: Date.now(), securityVersion: 2,
        responsable: responsable.trim(), telephone: telDigits, email: contactEmail.trim(),
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
