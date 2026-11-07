// ════════════════════════════════════════════════════════════════════════
//  Fournisseurs de paiement (agrégateurs Mobile Money)
// ════════════════════════════════════════════════════════════════════════
// Chaque fournisseur sait : créer un paiement (lien vers sa page de paiement),
// VÉRIFIER un paiement auprès de son API (seule source de vérité), et, s'il
// envoie des notifications, en extraire la référence et en contrôler la
// signature. Ajouter un opérateur = ajouter une entrée ici, rien d'autre.
import type { PaiementLigne, Verification } from "./regles.ts";
import * as cinetpay from "./cinetpay.ts";
import * as orange from "./orange.ts";
import { jetonNotificationValide } from "./outils.ts";

export type Config = {
  fournisseur: string;
  mode: "test" | "production";
  actif: boolean;
  frais_pourcent: number;
  identifiants: Record<string, string>;
};

export type Creation = {
  reference: string;
  montantTotal: number;
  devise: string;
  description: string;
  origine: string; // adresse de l'app (retour du parent)
  urlNotification: string;
  // Adresse de retour du parent via le serveur (accepte GET et POST, puis
  // redirige vers l'app) ; à défaut, l'app directement.
  urlRetour?: string;
  // Payeur (le compte qui paie), quand l'opérateur l'exige.
  client?: { prenom?: string; nom?: string; email?: string };
  config: Config;
};

export interface Fournisseur {
  nom: string;
  // Libellé montré au parent.
  libelle: string;
  // Bornes d'UN paiement (frais compris), si l'opérateur en impose.
  montantMin?: number;
  montantMax?: number;
  // Identifiants de l'école incomplets ou incohérents avec le mode : la
  // raison en clair, sinon null. `tester` les essaie auprès de l'opérateur
  // avant qu'ils soient enregistrés.
  probleme?(config: Pick<Config, "mode" | "identifiants">): string | null;
  tester?(config: Pick<Config, "mode" | "identifiants">): Promise<void>;
  creer(c: Creation): Promise<{ lien: string; detail?: Record<string, unknown> }>;
  verifier(p: PaiementLigne, config: Config): Promise<Verification>;
  // Notification entrante : référence du paiement concerné (null si illisible).
  referenceNotification?(corps: Record<string, string>): string | null;
  // Signature de la notification, contrôlée avec les identifiants de l'école.
  // `p` : le paiement visé, pour comparer à ce que l'opérateur a remis à
  // la création.
  signatureValide?(corps: Record<string, string>, entetes: Headers, config: Config, p: PaiementLigne): Promise<boolean>;
}

// ── Simulation ─────────────────────────────────────────────────────────────
// Aucun argent : la « page de paiement » est un écran de l'app qui demande
// « réussi / refusé ». Sert aux tests de bout en bout et aux démonstrations.
// INTERDIT en production : refusé tant que la variable d'environnement
// PAIEMENT_SIMULATION ne vaut pas « autorisee » (posée seulement par la CI
// et en local, jamais dans les secrets du projet de production).
export const simulationAutorisee = () => Deno.env.get("PAIEMENT_SIMULATION") === "autorisee";

const simulation: Fournisseur = {
  nom: "simulation",
  libelle: "Simulation (aucun argent)",
  async creer({ reference, origine }) {
    if (!simulationAutorisee()) throw new Error("Fournisseur de simulation interdit sur ce serveur.");
    return { lien: `${origine}/?paiement-simule=${encodeURIComponent(reference)}` };
  },
  async verifier(p) {
    const choix = (p.detail || {}).simulation;
    if (choix === "reussi") {
      return { statut: "reussi", montant: Number(p.montant) + Number(p.frais), devise: p.devise, operateur: "Simulation" };
    }
    if (choix === "echoue") return { statut: "echoue", detail: { motif: "refusé (simulation)" } };
    return { statut: "en_attente" };
  },
};

// ── CinetPay ───────────────────────────────────────────────────────────────
// Orange Money et MTN MoMo (Guinée : OM_GN, MTN_GN, en GNF), sur le compte
// marchand de l'école. Détails de l'API dans cinetpay.ts.
const ids = (config: Pick<Config, "identifiants">) => (config.identifiants || {}) as cinetpay.IdentifiantsCinetpay;

const cinetpayFournisseur: Fournisseur = {
  nom: "cinetpay",
  libelle: "Orange Money / MTN MoMo (CinetPay)",
  montantMin: cinetpay.MONTANT_MIN,
  montantMax: cinetpay.MONTANT_MAX,
  probleme: (config) => cinetpay.problemeIdentifiants(ids(config), config.mode),
  async tester(config) {
    cinetpay.oublierJeton(ids(config));
    await cinetpay.jetonAcces(ids(config));
  },
  async creer(c) {
    const probleme = cinetpay.problemeIdentifiants(ids(c.config), c.config.mode);
    if (probleme) throw new Error(probleme);
    return cinetpay.creerPaiement(ids(c.config), cinetpay.corpsPaiement(c));
  },
  verifier: (p, config) => cinetpay.verifierPaiement(ids(config), p.reference),
  referenceNotification: (corps) => corps.merchant_transaction_id || null,
  async signatureValide(corps, _entetes, _config, p) {
    return jetonNotificationValide(corps.notify_token, (p.detail || {}).notify_token);
  },
};

// ── Orange Money Guinée, en direct ─────────────────────────────────────────
// Sur le compte marchand Orange Money de l'école, sans intermédiaire (MTN
// n'y passe pas). Détails de l'API dans orange.ts.
const idsOrange = (config: Pick<Config, "identifiants">) => (config.identifiants || {}) as orange.IdentifiantsOrange;

const orangeFournisseur: Fournisseur = {
  nom: "orange_money",
  libelle: "Orange Money (direct)",
  probleme: (config) => orange.problemeIdentifiants(idsOrange(config)),
  async tester(config) {
    orange.oublierJeton(idsOrange(config));
    await orange.jetonAcces(idsOrange(config));
  },
  async creer(c) {
    const i = idsOrange(c.config);
    const probleme = orange.problemeIdentifiants(i);
    if (probleme) throw new Error(probleme);
    return orange.creerPaiement(i, c.config.mode, orange.corpsPaiement({ ...c, merchantKey: i.merchant_key!, mode: c.config.mode }));
  },
  verifier: (p, config) => orange.verifierPaiement(idsOrange(config), config.mode, p),
  // La notification d'Orange ne porte pas la référence : elle est dans
  // l'adresse de notification (&ref=…).
  referenceNotification: (corps) => corps.ref || null,
  async signatureValide(corps, _entetes, _config, p) {
    return jetonNotificationValide(corps.notif_token, (p.detail || {}).notif_token);
  },
};

export const FOURNISSEURS: Record<string, Fournisseur> = {
  simulation, cinetpay: cinetpayFournisseur, orange_money: orangeFournisseur,
};

export function fournisseur(nom: string): Fournisseur {
  const f = FOURNISSEURS[nom];
  if (!f) throw new Error(`Fournisseur de paiement inconnu : ${nom}`);
  return f;
}
