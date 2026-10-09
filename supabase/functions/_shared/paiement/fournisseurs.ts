// ════════════════════════════════════════════════════════════════════════
//  Fournisseurs de paiement (agrégateurs Mobile Money)
// ════════════════════════════════════════════════════════════════════════
// Chaque fournisseur sait : créer un paiement (lien vers sa page de paiement),
// VÉRIFIER un paiement auprès de son API (seule source de vérité), et, s'il
// envoie des notifications, en extraire la référence et en contrôler la
// signature. Ajouter un opérateur = ajouter une entrée ici, rien d'autre.
import type { PaiementLigne, Verification } from "./regles.ts";

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
  config: Config;
};

export interface Fournisseur {
  nom: string;
  // Libellé montré au parent.
  libelle: string;
  creer(c: Creation): Promise<{ lien: string; detail?: Record<string, unknown> }>;
  verifier(p: PaiementLigne, config: Config): Promise<Verification>;
  // Notification entrante : référence du paiement concerné (null si illisible).
  referenceNotification?(corps: Record<string, string>): string | null;
  // Signature de la notification, contrôlée avec les identifiants de l'école.
  signatureValide?(corps: Record<string, string>, entetes: Headers, config: Config): Promise<boolean>;
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

export const FOURNISSEURS: Record<string, Fournisseur> = { simulation };

export function fournisseur(nom: string): Fournisseur {
  const f = FOURNISSEURS[nom];
  if (!f) throw new Error(`Fournisseur de paiement inconnu : ${nom}`);
  return f;
}
