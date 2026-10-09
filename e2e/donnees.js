// Jeu de données des tests de bout en bout : UNE école de test, créée par
// les mêmes chemins que la production (Edge Function `inscription`, puis
// `account-manage` pour le comptable), sur la base Supabase LOCALE de la CI.
// Jamais d'adresse de production ici : les URL et clés viennent de
// `supabase status` (cf. job e2e de .github/workflows/ci.yml).
import { createClient } from "@supabase/supabase-js";
import { toRow } from "../src/backend/collection-map.js";
import { payloadCompteParent } from "../src/comptes-parents.js";
import { emailFor } from "../supabase/_brand.mjs";

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = process.env.E2E_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;

export const ECOLE = { nom: "Ecole E2E", code: "ecole-e2e" };
// Année officielle de l'école : déjà terminée (fin prévue 1er juillet 2026),
// donc clôturable quel que soit le jour du test.
export const ANNEE = "2025-2026";
export const ANNEE_SUIVANTE = "2026-2027";
export const DIRECTION = { login: "direction", mdp: "E2e-Direction-2026", nom: "Direction" };
export const COMPTABLE = { login: "compta", mdp: "E2e-Comptable-2026", nom: "Caissier Test" };

// Collège, une classe, une mensualité : de quoi encaisser sans ambiguïté.
export const SECTION = "college";
export const CLASSE = "7ème A";
export const MENSUALITE = 75000;
export const ELEVES = [
  { nom: "DIALLO", prenom: "Aminata", sexe: "F", matricule: "E2E-001" },
  { nom: "BAH", prenom: "Ibrahima", sexe: "M", matricule: "E2E-002" },
];
// Élève d'une autre classe, réservée au scénario hors ligne : ses notes ne
// se mêlent pas à celles que vérifie notes.spec.js.
export const CLASSE_HORS_LIGNE = "7ème B";
export const ELEVE_HORS_LIGNE = { nom: "CAMARA", prenom: "Fatou", sexe: "F", matricule: "E2E-003" };
// Élève supprimé depuis « un autre poste » pendant qu'on l'encaisse
// (fiche-supprimee.spec.js) : même classe que DIALLO, donc même tarif.
export const ELEVE_SUPPRIME = { nom: "SOW", prenom: "Mamadou", sexe: "M", matricule: "E2E-004" };
export const MATIERES = [
  { nom: "Mathématiques", coefficient: 4 },
  { nom: "Français", coefficient: 3 },
];
// Paiement en ligne (paiement-en-ligne.spec.js) : le parent de BAH paie par
// le fournisseur « simulation », frais de 3 % à sa charge.
export const PARENT = { login: "parent.bah", mdp: "E2e-Parent-2026" };
export const FRAIS_POURCENT = 3;

function verifierEnv() {
  if (!ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error("E2E_ANON_KEY / E2E_SERVICE_ROLE_KEY absentes : lancer contre une base Supabase locale (supabase status).");
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
    throw new Error(`Refus : les tests e2e ne tournent que sur une base LOCALE (reçu ${SUPABASE_URL}).`);
  }
}

const sansSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function clientAdmin() {
  verifierEnv();
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, sansSession);
}

// Client connecté comme un utilisateur de l'école : la RLS s'applique,
// exactement comme dans le navigateur.
export async function clientConnecte({ login, mdp }) {
  verifierEnv();
  const sb = createClient(SUPABASE_URL, ANON_KEY, sansSession);
  const { error } = await sb.auth.signInWithPassword({ email: emailFor(login, ECOLE.code), password: mdp });
  if (error) throw new Error(`Connexion ${login} impossible : ${error.message}`);
  return sb;
}

async function appelerFonction(nom, corps, jeton = ANON_KEY) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nom}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${jeton}` },
    body: JSON.stringify(corps),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(`${nom} : HTTP ${r.status} ${data.error || ""}`);
  return data;
}

export async function ecoleId(admin = clientAdmin()) {
  const { data, error } = await admin.from("ecoles").select("id").eq("code", ECOLE.code).single();
  if (error) throw error;
  return data.id;
}

// Crée l'école et ses données si elles n'existent pas encore (idempotent :
// relancer les tests sur la même base ne duplique rien).
export async function preparerEcole() {
  const admin = clientAdmin();
  const { data: existe } = await admin.from("ecoles").select("id").eq("code", ECOLE.code).maybeSingle();
  if (existe) return existe.id;

  // 1. Inscription publique, comme le formulaire « Créer mon école ».
  await appelerFonction("inscription", {
    nomEcole: ECOLE.nom, ville: "Conakry", pays: "Guinée", responsable: "Responsable Test",
    telephone: "620000000", email: "e2e@example.com",
    adminLogin: DIRECTION.login, adminMdp: DIRECTION.mdp,
  });
  const id = await ecoleId(admin);
  const { data: ec } = await admin.from("ecoles").select("extra").eq("id", id).single();
  await admin.from("ecoles").update({ extra: { ...(ec?.extra || {}), anneeScolaire: ANNEE } }).eq("id", id);

  // 2. La direction a déjà fait sa première connexion (mot de passe choisi) :
  //    les parcours métier ne repassent pas par l'écran de changement.
  await admin.from("comptes").update({ premiere_co: false }).eq("ecole_id", id).eq("login", DIRECTION.login);

  // 3. Comptable créé par la direction, via la même Edge Function que
  //    l'écran Comptes & Postes.
  const direction = await clientConnecte(DIRECTION);
  const { data: { session } } = await direction.auth.getSession();
  await appelerFonction("account-manage", {
    action: "create", login: COMPTABLE.login, mdp: COMPTABLE.mdp, role: "comptable",
    nom: COMPTABLE.nom, label: "Comptable", statut: "Actif",
  }, session.access_token);
  await admin.from("comptes").update({ premiere_co: false }).eq("ecole_id", id).eq("login", COMPTABLE.login);

  // 4. Classe, tarif et élèves, écrits par la direction (RLS) sous la forme
  //    exacte que l'app produit (toRow de collection-map).
  const ligne = (table, item) => ({ ...toRow(table, item).row, ecole_id: id, section: SECTION });
  const ecrire = async (table, lignes) => {
    const { error } = await direction.from(table).insert(lignes);
    if (error) throw new Error(`${table} : ${error.message}`);
  };
  await ecrire("classes", [ligne("classes", { nom: CLASSE }), ligne("classes", { nom: CLASSE_HORS_LIGNE })]);
  await ecrire("matieres", MATIERES.map((m) => ligne("matieres", m)));
  await ecrire("tarifs", [ligne("tarifs", { classe: CLASSE, montant: MENSUALITE })]);
  await ecrire("eleves", [
    ...[...ELEVES, ELEVE_SUPPRIME].map((e) => ligne("eleves", { ...e, classe: CLASSE, statut: "Actif", inscriptionPayee: true })),
    ligne("eleves", { ...ELEVE_HORS_LIGNE, classe: CLASSE_HORS_LIGNE, statut: "Actif", inscriptionPayee: true }),
  ]);
  return id;
}

// Lecture de contrôle (service_role : voit tout, indépendamment de la RLS).
export async function lireEleve(matricule) {
  const admin = clientAdmin();
  const { data, error } = await admin.from("eleves")
    .select("id, nom, prenom, extra").eq("ecole_id", await ecoleId(admin)).eq("matricule", matricule).single();
  if (error) throw error;
  return data;
}

export async function lireEcole() {
  const admin = clientAdmin();
  const { data, error } = await admin.from("ecoles").select("id, extra").eq("code", ECOLE.code).single();
  if (error) throw error;
  return data;
}

// Supprime une fiche élève « depuis un autre poste » (service_role).
export async function supprimerEleve(matricule) {
  const admin = clientAdmin();
  const { error } = await admin.from("eleves").delete().eq("ecole_id", await ecoleId(admin)).eq("matricule", matricule);
  if (error) throw error;
}

export async function lireNotes(eleveId) {
  const admin = clientAdmin();
  const { data, error } = await admin.from("notes").select("*").eq("eleve_id", eleveId);
  if (error) throw error;
  return data;
}

export async function lirePaiements(eleveId) {
  const admin = clientAdmin();
  const { data, error } = await admin.from("paiements").select("*").eq("eleve_id", eleveId);
  if (error) throw error;
  return data;
}

// Paiement en ligne ouvert à l'école de test (fournisseur « simulation »,
// autorisé par PAIEMENT_SIMULATION sur la pile locale seulement) et compte
// parent de BAH, créé par la direction comme depuis la fiche élève.
// Idempotent.
export async function preparerPaiementEnLigne() {
  const admin = clientAdmin();
  const id = await ecoleId(admin);
  const { error: errConfig } = await admin.from("paiement_config").upsert({
    ecole_id: id, fournisseur: "simulation", mode: "test", actif: true, frais_pourcent: FRAIS_POURCENT,
  });
  if (errConfig) throw new Error(`paiement_config : ${errConfig.message}`);

  const { data: existe } = await admin.from("comptes").select("id").eq("ecole_id", id).eq("login", PARENT.login).maybeSingle();
  if (!existe) {
    const eleve = await lireEleve(ELEVES[1].matricule);
    const direction = await clientConnecte(DIRECTION);
    const { data: { session } } = await direction.auth.getSession();
    const compte = payloadCompteParent({
      schoolId: ECOLE.code, login: PARENT.login, mdp: PARENT.mdp,
      eleves: [{ _id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, classe: CLASSE, section: SECTION }],
      parent: { nom: "Parent Bah", telephone: "620000002" },
    });
    await appelerFonction("account-manage", { action: "create", ...compte }, session.access_token);
  }
  await admin.from("comptes").update({ premiere_co: false }).eq("ecole_id", id).eq("login", PARENT.login);
}

export async function lirePaiementsEnLigne(eleveId) {
  const admin = clientAdmin();
  const { data, error } = await admin.from("paiements_en_ligne").select("*").eq("eleve_id", eleveId).order("created_at");
  if (error) throw error;
  return data;
}
