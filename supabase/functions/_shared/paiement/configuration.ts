// ════════════════════════════════════════════════════════════════════════
//  Paiement en ligne — configuration d'une école (règles PURES)
// ════════════════════════════════════════════════════════════════════════
// La direction choisit l'opérateur, le mode (test / production), les frais
// à la charge des parents et colle les identifiants de SON compte marchand
// (Paramètres → Paiement en ligne). Les identifiants ne repartent JAMAIS
// vers le navigateur : seule une forme masquée est renvoyée.
import type { Config, Fournisseur } from "./fournisseurs.ts";
import { calculerFrais } from "./regles.ts";

export type Saisie = {
  fournisseur?: unknown;
  mode?: unknown;
  actif?: unknown;
  fraisPourcent?: unknown;
  identifiants?: unknown;
};

type Choix = Pick<Fournisseur, "nom" | "libelle" | "probleme">;

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Identifiants saisis : seulement des chaînes non vides (un champ laissé
// vide garde la valeur déjà enregistrée).
function identifiantsSaisis(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const t = texte(val);
    if (t && /^[a-z_]{1,40}$/.test(k)) out[k] = t.slice(0, 500);
  }
  return out;
}

// Nouvelle configuration à enregistrer, ou la raison du refus.
export function validerConfiguration(
  saisie: Saisie,
  existante: Config | null,
  fournisseurs: Record<string, Choix>,
): { ok: true; config: Omit<Config, "actif"> & { actif: boolean } } | { ok: false; erreur: string } {
  const nom = texte(saisie.fournisseur);
  const f = fournisseurs[nom];
  if (!f) return { ok: false, erreur: "Opérateur de paiement inconnu." };
  const mode = saisie.mode === "production" ? "production" : saisie.mode === "test" ? "test" : null;
  if (!mode) return { ok: false, erreur: "Mode invalide (test ou production)." };
  const frais = Number(saisie.fraisPourcent ?? 0);
  if (!Number.isFinite(frais) || frais < 0 || frais > 20) {
    return { ok: false, erreur: "Frais à la charge des parents : entre 0 et 20 %." };
  }
  // Changer d'opérateur repart de zéro : on ne garde pas des identifiants
  // d'un autre compte marchand.
  const anciens = existante && existante.fournisseur === nom ? existante.identifiants || {} : {};
  const identifiants = { ...anciens, ...identifiantsSaisis(saisie.identifiants) };
  const actif = saisie.actif === true;
  const config = { fournisseur: nom, mode, actif, frais_pourcent: Math.round(frais * 100) / 100, identifiants };
  if (actif && f.probleme) {
    const probleme = f.probleme(config);
    if (probleme) return { ok: false, erreur: probleme };
  }
  return { ok: true, config };
}

// « sk_live_…a1b2 » : de quoi reconnaître la clé, rien de plus.
export function masquer(valeur: unknown): string | null {
  const v = texte(valeur);
  if (!v) return null;
  if (v.length <= 12) return "…";
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

// Identifiants PUBLICS (des noms de compte, pas des secrets) : montrés
// masqués pour être reconnus. Tous les autres : seulement « enregistré ».
const IDENTIFIANTS_PUBLICS = new Set(["api_key", "client_id"]);

// Ce que voit la direction : jamais un secret, jamais un identifiant en clair.
export function vueConfiguration(config: Config | null, fournisseurs: Choix[]) {
  const ids = (config?.identifiants || {}) as Record<string, unknown>;
  const identifiants: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(ids)) {
    if (!texte(valeur)) continue;
    identifiants[cle] = IDENTIFIANTS_PUBLICS.has(cle) ? (masquer(valeur) as string) : "enregistré";
  }
  return {
    fournisseur: config?.fournisseur ?? null,
    mode: config?.mode ?? "test",
    actif: !!config?.actif,
    fraisPourcent: Number(config?.frais_pourcent ?? 0),
    identifiants,
    fournisseurs: fournisseurs.map((f) => ({ nom: f.nom, libelle: f.libelle })),
  };
}

// Payeur transmis à l'opérateur : le compte qui paie (prénom = premier mot
// du nom du compte), à défaut l'élève.
export function clientPayeur(compte: { nom?: string | null; email?: string | null }, eleve: { nom?: string; prenom?: string }) {
  const mots = texte(compte.nom).split(/\s+/).filter(Boolean);
  return {
    prenom: mots.length > 1 ? mots[0] : mots[0] || eleve.prenom || "",
    nom: mots.length > 1 ? mots.slice(1).join(" ") : eleve.nom || "",
    email: texte(compte.email),
  };
}

// Plus grosse scolarité payable en UNE fois quand l'opérateur plafonne le
// total (scolarité + frais arrondis au franc supérieur).
export function plafondScolarite(montantMax: number | undefined, pourcent: number): number {
  if (!montantMax) return Infinity;
  let m = Math.floor(montantMax / (1 + (Number(pourcent) || 0) / 100));
  while (m > 0 && m + calculerFrais(m, pourcent) > montantMax) m--;
  return m;
}

// Un paiement (frais compris) dans les bornes de l'opérateur ? Sinon, le
// message pour le parent.
export function horsBornes(total: number, f: Pick<Fournisseur, "montantMin" | "montantMax">, fmt = (n: number) => String(n)): string | null {
  if (f.montantMin && total < f.montantMin) return `Montant trop faible : au moins ${fmt(f.montantMin)} par paiement.`;
  if (f.montantMax && total > f.montantMax) {
    return `Au plus ${fmt(f.montantMax)} par paiement (frais compris) : payez en plusieurs fois.`;
  }
  return null;
}
