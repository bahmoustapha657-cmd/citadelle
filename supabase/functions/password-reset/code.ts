// ════════════════════════════════════════════════════════════════════════
//  Mot de passe oublié par code SMS / WhatsApp — règles pures
// ════════════════════════════════════════════════════════════════════════
// Un parent sans e-mail reçoit un code à 6 chiffres sur le numéro de son
// compte et choisit lui-même son nouveau mot de passe. Module SANS dépendance
// (ni Deno ni réseau) : l'Edge Function password-reset l'importe,
// tests/reinitialisation-code.test.js le charge tel quel.
import { normaliserTel } from "../_shared/telephone.ts";

export const CODE_VALIDITE_MS = 15 * 60_000; // durée de vie d'un code
export const CODE_ESSAIS_MAX = 5; // codes faux avant de devoir en redemander un
export const CODES_PAR_HEURE = 3; // envois par compte et par heure
export const CODES_ECOLE_PAR_HEURE = 30; // plafond de coût par école en cas d'abus
export const DELAI_RENVOI_MS = 60_000; // entre deux envois au même compte
export const HEURE_MS = 3_600_000;

// Code à 6 chiffres tiré par la source cryptographique. Les tirages au-delà du
// dernier multiple de 10^6 sont rejetés : chaque code est équiprobable.
export function genererCode(tirer: (t: Uint32Array<ArrayBuffer>) => unknown = (t) => crypto.getRandomValues(t)): string {
  const plafond = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const t = new Uint32Array(1);
  for (;;) {
    tirer(t);
    if (t[0] < plafond) return String(t[0] % 1_000_000).padStart(6, "0");
  }
}

// Code tel que saisi (« 123 456 », « 123-456 ») → ses 6 chiffres, sinon null.
export function codeSaisi(saisie: unknown): string | null {
  const s = String(saisie ?? "").replace(/[\s.-]/g, "");
  return /^\d{6}$/.test(s) ? s : null;
}

// Empreinte conservée à la place du code : HMAC-SHA256 par une clé secrète de
// la fonction, liée au compte. Qui lirait la table n'en tirerait pas les codes
// (sans la clé, le million de codes possibles ne se teste pas hors ligne).
export async function empreinteCode(code: string, compteId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cle, enc.encode(`${compteId}:${code}`));
  return [...new Uint8Array(signature)].map((o) => o.toString(16).padStart(2, "0")).join("");
}

// Numéro qui reçoit le code : celui du compte (comptes.telephone), sinon celui
// de son profil parent. Jamais celui des fiches des enfants : ce peut être le
// numéro de l'autre parent, ou celui de l'école pour des internes.
export function telephoneDuTitulaire(compte: { telephone?: unknown; extra?: Record<string, unknown> | null }): string | null {
  return normaliserTel(compte.telephone) ?? normaliserTel(compte.extra?.contactTuteur);
}

// « +224622123456 » → « 6•• •• •• 56 » : assez pour que le parent reconnaisse
// son numéro, trop peu pour le livrer à qui essaie des identifiants.
export function masquerTelephone(tel: string): string {
  const n = String(tel).replace(/^\+224/, "");
  return `${n[0]}•• •• •• ${n.slice(-2)}`;
}

export type Decision =
  | { envoyer: true }
  | { envoyer: false; raison: "renvoi" | "limite_compte" | "limite_ecole"; attente: number };

// Envoyer un nouveau code ? `recentsCompte` : dates des codes envoyés à ce
// compte ; `recentsEcole` : nombre de codes envoyés par l'école sur l'heure
// écoulée. `attente` : secondes avant de pouvoir en redemander un.
export function decisionEnvoi(
  { recentsCompte, recentsEcole, maintenant }: { recentsCompte: Array<string | number>; recentsEcole: number; maintenant: number },
): Decision {
  const dates = recentsCompte
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t) && maintenant - t < HEURE_MS)
    .sort((a, b) => a - b);
  const secondes = (ms: number) => Math.max(1, Math.ceil(ms / 1000));
  if (dates.length >= CODES_PAR_HEURE) {
    // Le plus ancien des 3 derniers envois doit sortir de l'heure glissante.
    return { envoyer: false, raison: "limite_compte", attente: secondes(dates[dates.length - CODES_PAR_HEURE] + HEURE_MS - maintenant) };
  }
  const dernier = dates[dates.length - 1];
  if (dernier !== undefined && maintenant - dernier < DELAI_RENVOI_MS) {
    return { envoyer: false, raison: "renvoi", attente: secondes(dernier + DELAI_RENVOI_MS - maintenant) };
  }
  if (recentsEcole >= CODES_ECOLE_PAR_HEURE) return { envoyer: false, raison: "limite_ecole", attente: 0 };
  return { envoyer: true };
}

// Texte en ASCII : accents retirés, ligatures, tirets et guillemets
// typographiques ramenés à leur forme simple, le reste écarté.
function ascii(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u00ab\u00bb\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim();
}

// Texte du SMS, tout en ASCII : un caractère hors de l'alphabet GSM le ferait
// passer en Unicode, 70 caractères au lieu de 160. Nom d'école limité à 40
// caractères, coupé entre deux mots. Le code vient en tête : il se lit dans
// l'aperçu de la notification.
export function messageCode(code: string, nomEcole: string): string {
  let ecole = ascii(String(nomEcole || ""));
  if (ecole.length > 40) {
    const coupe = ecole.slice(0, 40);
    ecole = (/\s/.test(ecole[40]) ? coupe : coupe.replace(/\s+\S*$/, "")).trim();
  }
  return `${code} est votre code EduGest${ecole ? ` (${ecole})` : ""} pour choisir un nouveau mot de passe.`
    + ` Valable ${CODE_VALIDITE_MS / 60_000} min. Ne le communiquez a personne.`;
}

// Nouveau mot de passe recevable ? 8 caractères au moins, comme l'écran du
// lien par e-mail ; 72 octets au plus, limite de Supabase Auth.
export function problemeMotDePasse(mdp: unknown): "mdp_court" | "mdp_long" | null {
  const s = typeof mdp === "string" ? mdp : "";
  if (s.length < 8) return "mdp_court";
  if (new TextEncoder().encode(s).length > 72) return "mdp_long";
  return null;
}

// Verdict de la fonction SQL verifier_code_reinitialisation → réponse au
// navigateur. null : code juste, le mot de passe peut être enregistré.
export type Verification = { statut?: string; codeId?: string | null; essaisRestants?: number } | null;
export function refusVerification(v: Verification): Record<string, unknown> | null {
  if (v?.statut === "ok" && v.codeId) return null;
  if (v?.statut === "faux") return { ok: false, erreur: "code_faux", essaisRestants: Math.max(0, Number(v.essaisRestants) || 0) };
  if (v?.statut === "epuise") return { ok: false, erreur: "code_epuise" };
  return { ok: false, erreur: "code_expire" };
}
