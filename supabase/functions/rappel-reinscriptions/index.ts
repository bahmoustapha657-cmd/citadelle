// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : rappel quotidien des non réinscrits
// ════════════════════════════════════════════════════════════════════════
// Chaque matin (tâche planifiée .github/workflows/rappel-reinscriptions.yml,
// 8 h UTC = 8 h à Conakry), pour chaque école où le retrait automatique des
// non réinscrits est en vigueur (src/ecartes-non-reinscrits.js, copié dans
// _shared/app) : compte les élèves actifs qui n'ont fait AUCUN paiement de
// l'année et, s'il en reste, envoie une notification aux comptes qui
// tiennent la comptabilité — « 📝 N élèves non réinscrits… Faites-les
// réinscrire. » Même texte que le rappel de la cloche dans l'application.
//
// Appel sans session : authentifié par le secret partagé avec la tâche
// planifiée (en-tête x-rappel-secret). Corps facultatif :
//   { "ecole": "<code>" }  une seule école ;
//   { "essai": true }      compte et cible sans rien envoyer.
//
// Déploiement + secrets :
//   supabase functions deploy rappel-reinscriptions --no-verify-jwt
//   supabase secrets set RAPPEL_REINSCRIPTIONS_SECRET="..."
//   (VAPID_* et FCM_SERVICE_ACCOUNT : ceux de la fonction push.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  dateRetraitEcole, elevePaiementsDepuisLigne, estNonReinscritSansPaiement, libelleDateRetrait, retraitEnVigueur,
  SELECT_PAIEMENTS_ELEVE,
} from "../_shared/app/src/ecartes-non-reinscrits.js";
import { texteRappel } from "../_shared/app/src/rappel-reinscriptions.js";
import { parLots } from "../push/destinataires.ts";
import { donneesFcm, envoyerFcm, estAppareilAndroid, jetonAcces, lireCompteFcm, messageFcm } from "../push/fcm.ts";
import { abonnementsComptables, type CompteCompta, infoEcole, secretValide } from "./cibles.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("RAPPEL_REINSCRIPTIONS_SECRET");
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@edugest.app";
const COMPTE_FCM = lireCompteFcm(Deno.env.get("FCM_SERVICE_ACCOUNT"));

// Plafond PostgREST (1000 lignes par réponse) et taille des filtres in.(…).
const PAGE = 1000;
const LOT = 100;
const LOT_ADRESSES = 20;

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;
// deno-lint-ignore no-explicit-any
type Abonnement = { user_id: string; ecole_id: string; subscription: any };
type Ecole = { id: string; code: string; extra: Record<string, unknown> | null };

// Lecture paginée (sinon PostgREST tronque en silence au-delà de 1000).
// deno-lint-ignore no-explicit-any
async function toutLire<T>(requete: (de: number, a: number) => any): Promise<T[]> {
  const lus: T[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await requete(de, de + PAGE - 1);
    if (error) throw error;
    lus.push(...(data || []));
    if ((data || []).length < PAGE) return lus;
  }
}

async function nonReinscrits(admin: Admin, ecoleId: string): Promise<number> {
  const lignes = await toutLire<Record<string, unknown>>((de, a) => admin.from("eleves").select(SELECT_PAIEMENTS_ELEVE)
    .eq("ecole_id", ecoleId).eq("statut", "Actif").order("id").range(de, a));
  return lignes.map(elevePaiementsDepuisLigne).filter(estNonReinscritSansPaiement).length;
}

async function abonnementsCompta(admin: Admin, ecoleId: string): Promise<Abonnement[]> {
  const abonnements = await toutLire<Abonnement>((de, a) => admin.from("push_subs")
    .select("user_id, ecole_id, subscription").eq("ecole_id", ecoleId).order("user_id").range(de, a));
  if (!abonnements.length) return [];
  const comptes: CompteCompta[] = [];
  for (const lot of parLots([...new Set(abonnements.map((s) => s.user_id))], LOT)) {
    const { data, error } = await admin.from("comptes")
      .select("user_id, role, ecole_id, statut, fusion:extra->fusionneDans, poste:postes(cle, actif, permissions)")
      .in("user_id", lot);
    if (error) throw error;
    comptes.push(...((data || []) as unknown as CompteCompta[]));
  }
  return abonnementsComptables(abonnements, comptes, ecoleId);
}

// Envoie à chaque appareil ; purge ceux qui n'existent plus. Renvoie le
// nombre de notifications parties.
async function envoyer(admin: Admin, ecoleId: string, subs: Abonnement[], titre: string, corps: string): Promise<number> {
  const payload = JSON.stringify({ title: titre, body: corps, url: "/" });
  let envoyes = 0;
  const aSupprimer: string[] = [];
  await Promise.all(subs.filter((s) => !estAppareilAndroid(s.subscription)).map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, payload);
      envoyes++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) aSupprimer.push(s.subscription.endpoint);
    }
  }));
  const android = subs.filter((s) => estAppareilAndroid(s.subscription));
  if (android.length && COMPTE_FCM) {
    try {
      const acces = await jetonAcces(COMPTE_FCM);
      const donnees = donneesFcm({ titre, corps, url: "/" });
      await Promise.all(android.map(async (s) => {
        const resultat = await envoyerFcm(COMPTE_FCM, acces, messageFcm(s.subscription.fcm, donnees));
        if (resultat === "ok") envoyes++;
        if (resultat === "expire") aSupprimer.push(s.subscription.endpoint);
      }));
    } catch (e) {
      console.error("rappel fcm:", (e as Error)?.message || e);
    }
  }
  for (const lot of parLots(aSupprimer, LOT_ADRESSES)) {
    await admin.from("push_subs").delete().eq("ecole_id", ecoleId).in("endpoint", lot);
  }
  return envoyes;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!SECRET) return json({ error: "Secret RAPPEL_REINSCRIPTIONS_SECRET absent." }, 500);
  if (!secretValide(req.headers.get("x-rappel-secret"), SECRET)) return json({ error: "Non autorisé." }, 401);

  const body = (await req.json().catch(() => null)) || {};
  const essai = body.essai === true;
  const seule = typeof body.ecole === "string" ? body.ecole.trim().toLowerCase() : "";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const maintenant = new Date();
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    // Écoles en service seulement (une école « hors service » n'a plus de
    // comptable à réveiller) ; `supprime` nul compte comme non supprimée.
    let requete = admin.from("ecoles").select("id, code, extra").eq("actif", true).not("supprime", "is", true);
    if (seule) requete = requete.eq("code", seule);
    const { data: ecoles, error } = await requete.order("code");
    if (error) throw error;

    const bilan = [];
    for (const ecole of (ecoles || []) as Ecole[]) {
      const info = infoEcole(ecole.extra, maintenant);
      if (!retraitEnVigueur(info, info.anneeScolaire, maintenant)) continue;
      try {
        const nombre = await nonReinscrits(admin, ecole.id);
        if (!nombre) { bilan.push({ ecole: ecole.code, nonReinscrits: 0 }); continue; }
        const subs = await abonnementsCompta(admin, ecole.id);
        const { titre, corps } = texteRappel(nombre, libelleDateRetrait(dateRetraitEcole(info, info.anneeScolaire)));
        const envoyes = essai || !subs.length ? 0 : await envoyer(admin, ecole.id, subs, titre, corps);
        bilan.push({ ecole: ecole.code, nonReinscrits: nombre, appareils: subs.length, envoyes });
      } catch (e) {
        // Une école en échec n'empêche pas les autres d'être prévenues.
        bilan.push({ ecole: ecole.code, erreur: String((e as Error)?.message || e) });
      }
    }
    const echec = bilan.some((b) => "erreur" in b);
    return json({ ok: !echec, essai, bilan }, echec ? 500 : 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
