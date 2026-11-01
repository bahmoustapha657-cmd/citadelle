// ── « Mes fiches » : connexion à Pédagogue (Guinée Éducation) ──────────────
// Règles PURES (testées par tests/pedagogue-ticket.test.js) de la fonction
// pedagogue-ticket. L'autorisation est lue par la fonction pont-edugest de
// Pédagogue : tout changement de format se fait des deux côtés, et les deux
// suites de tests partagent le même exemple signé.
import type { ClassePedagogue } from "./perimetre.ts";

export const DUREE_TICKET_S = 120;
const NOM_MAX = 200;
// Pédagogue refuse au-delà de 32 768 caractères.
const TAILLE_MAX = 32_000;

// Place de chaque compte EduGest dans Pédagogue ; les autres n'y ont pas accès.
// La Direction y lit les fiches que ses enseignants choisissent de partager.
const ROLES_PEDAGOGUE = new Map<string, RolePedagogue>([
  ["enseignant", "enseignant"],
  ["direction", "directeur"],
  ["admin", "responsable_pedagogique"],
  ["primaire", "responsable_pedagogique"],
  ["college", "responsable_pedagogique"],
]);

export type RolePedagogue = "directeur" | "responsable_pedagogique" | "enseignant";
export const rolePedagogue = (role: string) => ROLES_PEDAGOGUE.get(role);

export type CompteTicket = {
  id: string;
  role: string;
  statut?: string | null;
  nom?: string | null;
  extra?: Record<string, unknown> | null;
};

export type EcoleTicket = { actif?: boolean | null; supprime?: boolean | null };

type Refus = { error: string; status: number };

// Réservé aux enseignants et à l'encadrement en poste ; une école hors service
// n'ouvre plus rien.
export function refusTicket(compte: CompteTicket | null, ecole: EcoleTicket | null): Refus | null {
  if (!compte) return { error: "Compte introuvable.", status: 403 };
  if (!rolePedagogue(compte.role)) return { error: "Les fiches de cours sont réservées aux enseignants et à la Direction.", status: 403 };
  if (compte.extra?.fusionneDans || (compte.statut && compte.statut !== "Actif")) {
    return { error: "Ce compte n'est plus actif.", status: 403 };
  }
  if (!ecole || ecole.actif === false || ecole.supprime === true) {
    return { error: "Cette école n'est plus en service.", status: 403 };
  }
  return null;
}

const octets = (texte: string) => new TextEncoder().encode(texte);
const base64url = (valeur: Uint8Array) =>
  btoa(String.fromCharCode(...valeur)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export type ContexteTicket = {
  ecole?: { id: string; nom: string; couleur1: string | null; couleur2: string | null };
  role?: RolePedagogue;
  annee?: string;
  classes?: ClassePedagogue[];
};

// `<données>.<signature>` en base64url. L'identité est l'identifiant du compte,
// jamais l'e-mail : celui d'une fiche est saisi par l'école sans vérification.
export async function creerTicket(
  { compteId, nom, jti, iat, ecole, role, annee, classes }:
    { compteId: string; nom: string; jti: string; iat: number } & ContexteTicket,
  secret: string,
): Promise<string> {
  const identite = {
    v: 1, iss: "edugest", aud: "pedagogue",
    sub: compteId, nom: nom.slice(0, NOM_MAX), jti, iat, exp: iat + DUREE_TICKET_S,
    ecole, role, annee,
  };
  const complet = octets(JSON.stringify({ ...identite, classes }));
  // Trop de classes pour tenir dans l'adresse : la connexion passe avant.
  const corps = base64url(Math.ceil(complet.length / 3) * 4 <= TAILLE_MAX ? complet : octets(JSON.stringify(identite)));
  const cle = await crypto.subtle.importKey("raw", octets(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cle, octets(corps));
  return `${corps}.${base64url(new Uint8Array(signature))}`;
}
