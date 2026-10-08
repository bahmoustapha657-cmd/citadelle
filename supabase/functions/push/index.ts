// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : envoi de notifications push (Web Push / VAPID)
// ════════════════════════════════════════════════════════════════════════
// Lit les abonnements (table push_subs) d'une école, ne garde que ceux dont le
// COMPTE est visé (destinataires.ts) et envoie la notification via le
// protocole Web Push. La clé VAPID privée reste ici.
//
// Déploiement + secrets :
//   supabase functions deploy push
//   supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:contact@edugest.app"
//
// Appelé par le client : supabase.functions.invoke("push", { body }).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  type Classe, nettoyerCibles, nettoyerEleveId, nettoyerUserIds, refusEnseignantEleve, refusEnvoi, refusParents,
} from "./droits.ts";
import { candidats, type CompteAbonne, destinataires, parLots } from "./destinataires.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@edugest.app";

// Plafond PostgREST (1000 lignes par réponse) et taille des filtres in.(…).
const PAGE = 1000;
const LOT = 100;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;
// deno-lint-ignore no-explicit-any
type Abonnement = { user_id: string; ecole_id: string; subscription: any };

// Abonnements de l'école : ceux des personnes visées (messagerie, parents
// d'un élève), ou tous — par pages, sinon PostgREST tronque en silence
// au-delà de 1000.
async function lireAbonnements(admin: Admin, ecoleId: string, userIds: string[] | null): Promise<Abonnement[]> {
  const champs = "user_id, ecole_id, subscription";
  const lus: Abonnement[] = [];
  if (userIds) {
    for (const lot of parLots(userIds, LOT)) {
      const { data, error } = await admin.from("push_subs").select(champs).eq("ecole_id", ecoleId).in("user_id", lot);
      if (error) throw error;
      lus.push(...(data || []));
    }
    return lus;
  }
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await admin.from("push_subs").select(champs).eq("ecole_id", ecoleId)
      .order("user_id").range(de, de + PAGE - 1);
    if (error) throw error;
    lus.push(...(data || []));
    if ((data || []).length < PAGE) return lus;
  }
}

// Comptes des abonnés : ce sont eux, et non push_subs, qui disent l'école,
// le rôle et le poste. Une erreur de lecture arrête l'envoi (jamais d'envoi
// sans vérification).
async function lireComptes(admin: Admin, userIds: string[]): Promise<CompteAbonne[]> {
  const lus: CompteAbonne[] = [];
  for (const lot of parLots(userIds, LOT)) {
    const { data, error } = await admin.from("comptes")
      .select("user_id, role, ecole_id, statut, fusion:extra->fusionneDans, poste:postes(cle, actif)")
      .in("user_id", lot);
    if (error) throw error;
    lus.push(...((data || []) as unknown as CompteAbonne[]));
  }
  return lus;
}

// Parents de l'élève : user_id des comptes qui lui sont rattachés
// (parent_eleves), avec la classe de l'élève (contrôle de l'enseignant).
// null si l'élève n'est pas de l'école visée.
async function lireParentsEleve(admin: Admin, ecoleId: string, eleveId: string): Promise<{ eleve: Classe; parents: string[] } | null> {
  const { data: eleve, error } = await admin.from("eleves").select("id, section, classe")
    .eq("id", eleveId).eq("ecole_id", ecoleId).maybeSingle();
  if (error) throw error;
  if (!eleve) return null;
  const { data: liens, error: errLiens } = await admin.from("parent_eleves")
    .select("compte:comptes(user_id)").eq("eleve_id", eleveId);
  if (errLiens) throw errLiens;
  const parents = ((liens || []) as unknown as { compte: { user_id: string | null } | null }[])
    .map((l) => l.compte?.user_id || "").filter(Boolean);
  return { eleve: eleve as unknown as Classe, parents };
}

// Classes de l'enseignant appelant dans l'école (enseignant_classes).
async function lireClassesEnseignant(admin: Admin, compteId: string, ecoleId: string): Promise<Classe[]> {
  const { data, error } = await admin.from("enseignant_classes").select("section, classe")
    .eq("compte_id", compteId).eq("ecole_id", ecoleId);
  if (error) throw error;
  return (data || []) as unknown as Classe[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    // Authentifie l'appelant : un membre de l'école visée, ou le superadmin ;
    // le ciblage par rôle est réservé au personnel (droits.ts).
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié." }, 401);

    const body = (await req.json().catch(() => null)) || {};
    const { schoolId, titre, corps, url } = body;
    const cibles = nettoyerCibles(body.cibles);
    const userIds = nettoyerUserIds(body.userIds);
    const tousStaff = body.tousStaff === true;
    if (!schoolId || (!cibles.length && !userIds.length && !tousStaff)) return json({ error: "Paramètres manquants." }, 400);
    // Les parents se visent par élève, jamais en bloc (droits.ts).
    const demande = { cibles, userIds, tousStaff, eleveId: nettoyerEleveId(body.eleveId) };
    const invalide = refusParents(demande);
    if (invalide) return json({ error: invalide.error }, invalide.statut);

    const { data: ec } = await admin.from("ecoles").select("id").eq("code", String(schoolId).toLowerCase()).maybeSingle();
    if (!ec) return json({ error: "École introuvable." }, 404);

    const { data: appelant } = await admin.from("comptes")
      .select("id, role, ecole_id, statut").eq("user_id", user.id).maybeSingle();
    const refus = refusEnvoi(appelant, ec.id, demande);
    if (refus) return json({ error: refus.error }, refus.statut);

    // Parents visés : ceux de l'élève concerné, qui doit être de l'école —
    // et, pour un enseignant, de l'une de ses classes.
    let parentsEleve: string[] = [];
    if (cibles.includes("parent")) {
      const lus = await lireParentsEleve(admin, ec.id, demande.eleveId);
      if (!lus) return json({ error: "Élève introuvable dans cette école." }, 404);
      const classes = appelant?.role === "enseignant" ? await lireClassesEnseignant(admin, appelant.id, ec.id) : [];
      const horsClasses = refusEnseignantEleve(appelant, lus.eleve, classes);
      if (horsClasses) return json({ error: horsClasses.error }, horsClasses.statut);
      parentsEleve = lus.parents;
    }

    // Candidats : les lignes push_subs de l'école (celles des seules personnes
    // visées si l'envoi est nominatif) ; le tri se fait ensuite sur `comptes`,
    // jamais sur les colonnes role/poste_cle écrites par le navigateur.
    const abonnements = await lireAbonnements(admin, ec.id, candidats(demande, parentsEleve));
    if (!abonnements.length) return json({ ok: true, envoyes: 0 });
    const comptes = await lireComptes(admin, [...new Set(abonnements.map((a) => a.user_id))]);
    const subs = destinataires(abonnements, comptes, ec.id, demande, parentsEleve);
    if (!subs.length) return json({ ok: true, envoyes: 0 });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const payload = JSON.stringify({ title: titre || "EduGest", body: corps || "", url: url || "/" });

    let envoyes = 0;
    const aSupprimer: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload);
        envoyes++;
      } catch (err) {
        // 404/410 = abonnement expiré → on le purge.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) aSupprimer.push(s.user_id);
      }
    }));
    for (const lot of parLots(aSupprimer, LOT)) {
      await admin.from("push_subs").delete().eq("ecole_id", ec.id).in("user_id", lot);
    }

    return json({ ok: true, envoyes });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
