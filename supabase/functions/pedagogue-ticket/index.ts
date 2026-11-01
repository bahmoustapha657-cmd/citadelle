// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : autorisation d'ouvrir Pédagogue (« Mes fiches »)
// ════════════════════════════════════════════════════════════════════════
// Signe, pour l'enseignant ou l'encadrement connecté, une autorisation de 2
// minutes que Pédagogue échange contre une session (fonction pont-edugest de ce
// projet-là). Elle porte aussi l'école (nom, couleurs, en-tête officiel) et, pour
// un enseignant, ses classes et son emploi du temps : ils n'existent pas ailleurs
// chez Pédagogue.
// Les deux produits gardent chacun leur base : seul le secret est commun.
//
// Déploiement, avec le même secret que PONT_EDUGEST_SECRET côté Pédagogue :
//   supabase secrets set PONT_PEDAGOGUE_SECRET=<secret>
//   supabase functions deploy pedagogue-ticket
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classesDeLEnseignant, sectionDuCompte, type CompteEnseignant } from "./perimetre.ts";
import { creerTicket, enTeteDeLEcole, refusTicket, rolePedagogue } from "./ticket.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PONT_PEDAGOGUE_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PAGE = 1000;

// Tables de la section, par pages : PostgREST plafonne une réponse à 1000 lignes.
async function lignesDeLaSection(admin: SupabaseClient, table: string, colonnes: string, ecoleId: string, section: string) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await admin.from(table).select(colonnes)
      .eq("ecole_id", ecoleId).eq("section", section).order("id").range(debut, debut + PAGE - 1);
    if (error) throw error;
    lignes.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return lignes;
  }
}

// Une lecture ratée prive Pédagogue des classes, pas l'enseignant de ses fiches.
async function classesPourPedagogue(admin: SupabaseClient, compte: CompteEnseignant, ecoleId: string) {
  const section = sectionDuCompte(compte);
  try {
    const [emplois, enseignements, fiches, classes, matieres] = await Promise.all([
      lignesDeLaSection(admin, "emplois", "id, classe, jour, heure_debut, heure_fin, matiere, enseignant, extra", ecoleId, section),
      lignesDeLaSection(admin, "enseignements", "id, classe, enseignant_nom", ecoleId, section),
      lignesDeLaSection(admin, "enseignants", "id, nom, prenom, classe_title, extra", ecoleId, section),
      lignesDeLaSection(admin, "classes", "id, nom, enseignant_id", ecoleId, section),
      lignesDeLaSection(admin, "matieres", "id, nom, classes, extra", ecoleId, section),
    ]);
    return classesDeLEnseignant({ compte, emplois, enseignements, fiches, classes, matieres });
  } catch (e) {
    console.error("pedagogue-ticket : classes", e);
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!SECRET) return json({ error: "« Mes fiches » n'est pas encore disponible." }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Non authentifié." }, 401);
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user) return json({ error: "Session invalide." }, 401);

    const { data: compte } = await admin.from("comptes")
      .select("id, role, statut, nom, extra, ecole_id, enseignant_id, enseignant_nom, section, sections, matiere")
      .eq("user_id", user.id).maybeSingle();
    const { data: ecole } = compte?.ecole_id
      ? await admin.from("ecoles").select("actif, supprime, nom, couleur1, couleur2, pays, logo, legal, extra").eq("id", compte.ecole_id).maybeSingle()
      : { data: null };
    const refus = refusTicket(compte, ecole);
    if (refus) return json({ error: refus.error }, refus.status);

    const ticket = await creerTicket({
      compteId: compte!.id,
      nom: compte!.nom || "Enseignant",
      jti: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
      ecole: { id: compte!.ecole_id, nom: ecole!.nom, couleur1: ecole!.couleur1, couleur2: ecole!.couleur2, enTete: enTeteDeLEcole(ecole!) },
      role: rolePedagogue(compte!.role),
      annee: ecole!.extra?.anneeScolaire,
      classes: compte!.role === "enseignant" ? await classesPourPedagogue(admin, compte!, compte!.ecole_id) : undefined,
    }, SECRET);
    return json({ ok: true, ticket });
  } catch (e) {
    console.error("pedagogue-ticket", e);
    return json({ error: "Ouverture de vos fiches impossible. Réessayez dans un instant." }, 500);
  }
});
