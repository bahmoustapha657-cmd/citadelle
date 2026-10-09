// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function PUBLIQUE : notifications des opérateurs
// ════════════════════════════════════════════════════════════════════════
// L'agrégateur appelle cette adresse quand un paiement change d'état
// (?fournisseur=<nom>). Elle sert aussi d'adresse de RETOUR du parent
// (?retour=<référence>), redirigé vers l'app. Aucune session : c'est la signature, contrôlée avec
// les identifiants de l'école, qui authentifie l'appel — et même signée, la
// notification n'est jamais crue sur parole : le paiement est VÉRIFIÉ auprès
// de l'API de l'opérateur avant d'être imputé.
//
// Déploiement (sans contrôle de JWT, cf. supabase/config.toml) :
//   supabase functions deploy paiement-notification --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FOURNISSEURS } from "../_shared/paiement/fournisseurs.ts";
import { lireConfig, lireParReference, verifierEtAppliquer } from "../_shared/paiement/traitement.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") ?? "https://edugest-gn.pages.dev").replace(/\/+$/, "");

// Corps de la notification, quel que soit son format (formulaire, JSON,
// paramètres d'adresse).
async function lireCorps(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const corps: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method !== "POST") return corps;
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    for (const [k, v] of Object.entries(j || {})) corps[k] = String(v ?? "");
  } else {
    const f = await req.formData().catch(() => null);
    f?.forEach((v, k) => { corps[k] = String(v); });
  }
  return corps;
}

Deno.serve(async (req) => {
  // Retour du PARENT depuis la page de l'opérateur (?retour=<référence>),
  // en GET ou en POST selon l'opérateur — un POST vers le site statique de
  // l'app serait refusé. Renvoyé vers l'app, qui vérifie elle-même le
  // paiement (rien n'est cru ici).
  const retour = new URL(req.url).searchParams.get("retour");
  if (retour !== null) {
    const reference = /^EDU[0-9A-Z]{4,27}$/.test(retour) ? retour : "";
    return new Response(null, {
      status: 303,
      headers: { Location: `${APP_URL}/${reference ? `?paiement=${reference}` : ""}` },
    });
  }

  // Réponse toujours brève et identique : rien n'est révélé à un appelant.
  const ok = () => new Response("OK", { status: 200 });
  try {
    const corps = await lireCorps(req);
    const nom = corps.fournisseur || "";
    const f = FOURNISSEURS[nom];
    if (!f?.referenceNotification) return ok();
    const reference = f.referenceNotification(corps);
    if (!reference) return ok();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const p = await lireParReference(admin, reference);
    if (!p || p.fournisseur !== nom) return ok();
    const config = await lireConfig(admin, p.ecole_id);
    if (!config) return ok();
    if (f.signatureValide && !(await f.signatureValide(corps, req.headers, config, p))) {
      console.warn("paiement-notification: signature invalide", nom);
      return ok();
    }
    await verifierEtAppliquer(admin, p);
    return ok();
  } catch (e) {
    console.error("paiement-notification:", e);
    // 500 : l'opérateur réessaiera plus tard.
    return new Response("ERREUR", { status: 500 });
  }
});
