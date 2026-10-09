// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : paiement en ligne de la scolarité
// ════════════════════════════════════════════════════════════════════════
// Actions (POST { action, … }, appelant authentifié) :
//   etat     → le paiement en ligne est-il ouvert pour mon école ?
//   cibles   { eleveId }            → ce que je peux payer, reste dû compris
//   initier  { eleveId, cle, montant } → crée le paiement, renvoie le lien
//   statut   { reference }          → où en est ce paiement (vérifie auprès
//                                      de l'opérateur s'il est en attente)
//   simuler  { reference, resultat } → fournisseur « simulation » seulement
//   config                          → réglages de l'école, identifiants
//                                      MASQUÉS (direction)
//   configurer { fournisseur, mode, actif, fraisPourcent, identifiants }
//                                    → enregistre, après avoir essayé les
//                                      identifiants auprès de l'opérateur
//                                      (direction)
//
// Qui peut payer : le parent de l'élève, ou le personnel qui écrit la
// comptabilité. Le MONTANT est recalculé ici avec les règles de la caisse :
// on ne paie jamais plus que ce qui reste dû, ni autre chose qu'une cible
// réelle. L'argent va sur le compte marchand de l'école (paiement_config).
//
// Déploiement : supabase functions deploy paiement
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FOURNISSEURS, fournisseur, simulationAutorisee } from "../_shared/paiement/fournisseurs.ts";
import {
  clientPayeur, horsBornes, plafondScolarite, validerConfiguration, vueConfiguration,
} from "../_shared/paiement/configuration.ts";
import {
  appliquerVerification, chargerContexte, lireConfig, lireParReference, verifierEtAppliquer,
} from "../_shared/paiement/traitement.ts";
import {
  calculerFrais, ciblesPayables, nouvelleReference, origineAutorisee, type PaiementLigne,
} from "../_shared/paiement/regles.ts";
import { planVersement } from "../_shared/app/src/paiements-scolarite.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://edugest-gn.pages.dev";
// Adresse PUBLIQUE des fonctions, pour les notifications des opérateurs.
const FONCTIONS_URL = Deno.env.get("FONCTIONS_URL_PUBLIQUE") ?? `${SUPABASE_URL}/functions/v1`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const refus = (message: string, s = 403) => json({ ok: false, error: message }, s);

// Vue d'un paiement renvoyée au navigateur : jamais le détail brut de
// l'opérateur.
function vue(p: PaiementLigne & Record<string, unknown>) {
  const d = (p.detail || {}) as Record<string, unknown>;
  return {
    reference: p.reference, statut: p.statut, fournisseur: p.fournisseur,
    montant: Number(p.montant), frais: Number(p.frais), devise: p.devise,
    cible: p.cible, eleveId: p.eleve_id, lien: p.lien ?? null,
    lignes: d.lignes ?? [], operateur: d.operateur ?? null, motif: d.motif ?? null,
    creeLe: p.created_at, imputeLe: p.impute_le ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return refus("Session invalide.", 401);
    const { data: compte } = await admin.from("comptes")
      .select("id, role, ecole_id, statut, nom, email").eq("user_id", user.id).maybeSingle();
    if (!compte || (compte.statut && compte.statut !== "Actif")) return refus("Compte introuvable ou désactivé.");

    // Client À SON NOM : la RLS dit ce que l'appelant voit et peut faire.
    const client = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const voitEleve = async (eleveId: string) => {
      const { data } = await client.from("eleves").select("id").eq("id", eleveId).maybeSingle();
      return !!data;
    };
    const peutPayer = async (eleveId: string) => {
      if (!(await voitEleve(eleveId))) return false;
      if (compte.role === "parent") return true;
      const { data } = await client.rpc("has_module_write", { p_module: "compta" });
      return data === true;
    };

    const corps = await req.json().catch(() => ({}));
    const action = String(corps.action || "");
    const config = await lireConfig(admin, compte.ecole_id);
    const ouvert = !!config?.actif && !!FOURNISSEURS[config.fournisseur]
      && (config.fournisseur !== "simulation" || simulationAutorisee());
    // Plus grosse scolarité payable en une fois (plafond de l'opérateur).
    const plafond = ouvert
      ? plafondScolarite(fournisseur(config!.fournisseur).montantMax, Number(config!.frais_pourcent))
      : Infinity;

    // Opérateurs proposés à la direction (la simulation : hors production).
    const choix = Object.values(FOURNISSEURS).filter((f) => f.nom !== "simulation" || simulationAutorisee());

    if (action === "config" || action === "configurer") {
      if (compte.role !== "direction") return refus("Réservé à la direction.");
      if (action === "config") return json({ ok: true, config: vueConfiguration(config, choix) });
      const v = validerConfiguration(corps, config, Object.fromEntries(choix.map((f) => [f.nom, f])));
      if (!v.ok) return refus(v.erreur, 400);
      // Activer = identifiants essayés auprès de l'opérateur d'abord : une
      // erreur de saisie se voit ici, pas au premier paiement d'un parent.
      const f = fournisseur(v.config.fournisseur);
      if (v.config.actif && f.tester) {
        try { await f.tester(v.config); } catch (e) { return refus((e as Error).message, 400); }
      }
      const { data: enregistre, error } = await admin.from("paiement_config").upsert({
        ecole_id: compte.ecole_id, ...v.config, modifie_par: compte.id,
      }).select("fournisseur, mode, actif, frais_pourcent, identifiants").single();
      if (error) throw error;
      return json({ ok: true, config: vueConfiguration(enregistre, choix) });
    }

    if (action === "etat") {
      return json({
        ok: true, actif: ouvert,
        fournisseur: ouvert ? config!.fournisseur : null,
        libelle: ouvert ? fournisseur(config!.fournisseur).libelle : null,
        fraisPourcent: ouvert ? Number(config!.frais_pourcent) : 0,
        mode: ouvert ? config!.mode : null,
        plafond: Number.isFinite(plafond) ? plafond : null,
      });
    }

    if (action === "cibles") {
      const eleveId = String(corps.eleveId || "");
      if (!(await peutPayer(eleveId))) return refus("Paiement non autorisé pour cet élève.");
      const { ctx } = await chargerContexte(admin, compte.ecole_id, eleveId);
      const cibles = ciblesPayables(ctx).map((c) => ({ ...c, propose: Math.min(c.propose, plafond) }));
      return json({
        ok: true, annee: ctx.annee, cibles, fraisPourcent: Number(config?.frais_pourcent || 0),
        plafond: Number.isFinite(plafond) ? plafond : null,
      });
    }

    if (action === "initier") {
      if (!ouvert) return refus("Le paiement en ligne n'est pas ouvert pour cette école.");
      const eleveId = String(corps.eleveId || "");
      if (!(await peutPayer(eleveId))) return refus("Paiement non autorisé pour cet élève.");
      const { ecole, ctx } = await chargerContexte(admin, compte.ecole_id, eleveId);
      if (ecole.actif === false || ecole.supprime === true) return refus("Établissement désactivé.");
      const cible = ctx.cibles.find((c: Record<string, unknown>) => c.cle === corps.cle);
      if (!cible) return refus("Rien à payer sur ce choix.", 400);
      const montant = Math.round(Number(corps.montant));
      // Mêmes règles que la caisse : montant positif, jamais au-delà du reste.
      const essai = planVersement({ eleve: ctx.eleve, cible, montant, date: "", mensualite: ctx.mensualite, annee: ctx.annee });
      if (!essai.ok) {
        return refus(essai.raison === "depasse"
          ? `Montant trop élevé : il reste ${essai.reste} à payer sur ce choix.`
          : "Montant invalide.", 400);
      }
      const frais = calculerFrais(montant, Number(config!.frais_pourcent));
      const borne = horsBornes(montant + frais, fournisseur(config!.fournisseur));
      if (borne) return refus(borne, 400);
      const reference = nouvelleReference();
      const { data: cree, error } = await admin.from("paiements_en_ligne").insert({
        ecole_id: compte.ecole_id, eleve_id: eleveId,
        eleve_nom: `${ctx.eleve.nom || ""} ${ctx.eleve.prenom || ""}`.trim() || null,
        reference, fournisseur: config!.fournisseur,
        annee: ctx.annee, cible: { cle: cible.cle, label: cible.label }, montant, frais,
        devise: "GNF", initie_par: compte.id,
      }).select("*").single();
      if (error) throw error;
      const origine = origineAutorisee(req.headers.get("Origin"), APP_URL);
      const nom = `${ctx.eleve.prenom || ""} ${ctx.eleve.nom || ""}`.trim();
      try {
        const { lien, detail } = await fournisseur(config!.fournisseur).creer({
          reference, montantTotal: montant + frais, devise: "GNF",
          description: `${cible.label} — ${nom}`.slice(0, 120), origine,
          urlNotification: `${FONCTIONS_URL}/paiement-notification?fournisseur=${encodeURIComponent(config!.fournisseur)}`,
          urlRetour: `${FONCTIONS_URL}/paiement-notification?retour=${encodeURIComponent(reference)}`,
          client: clientPayeur(compte, ctx.eleve),
          config: config!,
        });
        await admin.from("paiements_en_ligne").update({ lien, detail: { ...(cree.detail || {}), ...(detail || {}) } }).eq("id", cree.id);
        return json({ ok: true, reference, lien, montant, frais, total: montant + frais });
      } catch (e) {
        await admin.from("paiements_en_ligne").update({ statut: "echoue", detail: { motif: "creation", erreur: String((e as Error).message || e) } })
          .eq("id", cree.id).eq("statut", "en_attente");
        return refus(`L'opérateur n'a pas pu créer le paiement : ${(e as Error).message}`, 502);
      }
    }

    if (action === "statut" || action === "simuler") {
      const p = await lireParReference(admin, String(corps.reference || ""));
      if (!p || p.ecole_id !== compte.ecole_id || !p.eleve_id || !(await voitEleve(p.eleve_id))) {
        return refus("Paiement introuvable.", 404);
      }
      if (action === "simuler") {
        if (p.fournisseur !== "simulation" || !simulationAutorisee()) return refus("Simulation impossible.");
        if (p.statut === "en_attente") {
          const resultat = corps.resultat === "reussi" ? "reussi" : "echoue";
          const detail = { ...(p.detail || {}), simulation: resultat };
          await admin.from("paiements_en_ligne").update({ detail }).eq("id", p.id).eq("statut", "en_attente");
          const verif = await fournisseur("simulation").verifier({ ...p, detail }, config!);
          await appliquerVerification(admin, { ...p, detail }, verif);
        }
      } else {
        // Opérateur injoignable : le paiement reste « en attente », l'écran
        // du parent continue d'interroger (la notification prendra le relais).
        try { await verifierEtAppliquer(admin, p); } catch (e) { console.warn("paiement: vérification reportée", (e as Error).message); }
      }
      const apres = await lireParReference(admin, p.reference);
      return json({ ok: true, paiement: vue(apres as PaiementLigne & Record<string, unknown>) });
    }

    return refus("Action inconnue.", 400);
  } catch (e) {
    console.error("paiement:", e);
    return json({ ok: false, error: "Erreur du serveur de paiement." }, 500);
  }
});
