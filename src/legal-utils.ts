// ══════════════════════════════════════════════════════════════
//  Module Conformité / Légal — Profil officiel de l'établissement
// ══════════════════════════════════════════════════════════════
// Stocké à /ecoles/{schoolId}/config/legal.
// Règles Firestore : lecture = tout rôle de l'école ;
//                    écriture = direction/admin uniquement.
// Fallback quand le doc n'existe pas : `legalProfileVide` (profil neutre
// à compléter dans Paramètres → Officiel). `legalProfileMock` contient
// les données réelles de La Citadelle et n'est servi qu'à elle.

export type CycleLegal = "maternelle" | "primaire" | "secondaire";

export interface LegalProfile {
  promoteur: {
    nom: string;
    anneeNaissance: number;
    lieuNaissance: string;
  };
  autorisationCreation: {
    numero: string;
    dateSignature: string; // ISO YYYY-MM-DD
    ministre: string;
    ministere: string;
  };
  arreteOuverture: {
    numero: string;
    dateSignature: string; // ISO YYYY-MM-DD
    ministre: string;
    ministere: string;
    dureeValiditeAnnees: number;
  };
  codesStatistiques: {
    maternelle: string;
    primaire: string;
    secondaire: string;
  };
  etablissement: {
    denomination: string;
    quartier: string;
    commune: string;
    region: string;
    email: string;
    // Tutelle administrative (ex-champs legacy `schoolInfo.ministere`,
    // `schoolInfo.ire`, `schoolInfo.dpe` — migrés ici). Optionnels car
    // toutes les écoles ne les renseignent pas.
    ministereTutelle?: string; // libellé complet du ministère
    ire?: string;              // Inspection Régionale (abrégé)
    dpe?: string;              // Direction Préfectorale (abrégé)
    coordonnees?: { latitude: number; longitude: number };
  };
}

// Profil légal VIDE — fallback pour toute école n'ayant pas encore
// renseigné son dossier officiel (Paramètres → Officiel). On ne retombe
// JAMAIS sur les données d'une autre école : avant ce garde-fou, les
// nouvelles écoles voyaient (et imprimaient !) l'agrément de La Citadelle.
export const legalProfileVide: LegalProfile = {
  promoteur: { nom: "", anneeNaissance: 0, lieuNaissance: "" },
  autorisationCreation: { numero: "", dateSignature: "", ministre: "", ministere: "" },
  arreteOuverture: { numero: "", dateSignature: "", ministre: "", ministere: "", dureeValiditeAnnees: 0 },
  codesStatistiques: { maternelle: "", primaire: "", secondaire: "" },
  etablissement: { denomination: "", quartier: "", commune: "", region: "", email: "" },
};

// Vrai si l'école n'a encore rien renseigné (ni numéro ni date d'arrêté).
export function isLegalProfileEmpty(profile?: LegalProfile | null): boolean {
  return !profile?.arreteOuverture?.numero && !profile?.arreteOuverture?.dateSignature;
}

// Données réelles La Citadelle (seed historique) — servies UNIQUEMENT
// comme fallback de l'école « citadelle », jamais aux autres.
export const legalProfileMock: LegalProfile = {
  promoteur: {
    nom: "Souleymane DIALLO",
    anneeNaissance: 1975,
    lieuNaissance: "Kindia",
  },
  autorisationCreation: {
    numero: "0197/MEN-A/CAB/20",
    dateSignature: "2020-04-29",
    ministre: "Mory SANGARE",
    ministere: "MEN-A",
  },
  arreteOuverture: {
    numero: "A/2022/1065/MEPU-A/SGG",
    dateSignature: "2022-05-17",
    ministre: "Guillaume HAWING",
    ministere: "MEPU-A",
    dureeValiditeAnnees: 5,
  },
  codesStatistiques: {
    maternelle: "541 10 16",
    primaire: "541 10 13",
    secondaire: "954 17 12",
  },
  etablissement: {
    denomination: "Groupe Scolaire Privé La Citadelle",
    quartier: "Dar-Es-Salam",
    commune: "Commune urbaine de Kindia",
    region: "Région de Kindia",
    email: "lacitadelle16@gmail.com",
    ministereTutelle: "Ministère de l'Enseignement Pré-Universitaire et de l'Éducation Civique",
    ire: "IRE de Kindia",
    dpe: "DPE de Kindia",
    // coordonnees laissées vides — note manuscrite illisible
  },
};

// ── Helpers ──────────────────────────────────────────────────────

// Date d'expiration dérivée — JAMAIS saisie en dur.
export function computeDateExpiration(profile: LegalProfile): string {
  const { dateSignature, dureeValiditeAnnees } = profile.arreteOuverture;
  if (!dateSignature || !Number.isFinite(dureeValiditeAnnees)) return "";
  const d = new Date(dateSignature);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + dureeValiditeAnnees);
  return d.toISOString().slice(0, 10);
}

export function formatDateFR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Jours restants avant expiration. Négatif si déjà expiré.
export function daysUntilExpiration(profile: LegalProfile, ref: Date = new Date()): number {
  const exp = computeDateExpiration(profile);
  if (!exp) return Number.NaN;
  const expDate = new Date(exp);
  const ms = expDate.getTime() - ref.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type ComplianceStatus = "ok" | "warning" | "critical" | "expired";

export function getComplianceStatus(profile: LegalProfile, ref: Date = new Date()): ComplianceStatus {
  const days = daysUntilExpiration(profile, ref);
  if (!Number.isFinite(days)) return "critical";
  if (days <= 0) return "expired";
  if (days <= 30 * 6) return "critical"; // ≤ 6 mois
  if (days <= 365) return "warning"; // ≤ 12 mois
  return "ok";
}

// Compte à rebours lisible : "1 an 3 mois", "8 mois", "12 jours", "Expiré".
export function formatCountdown(profile: LegalProfile, ref: Date = new Date()): string {
  const days = daysUntilExpiration(profile, ref);
  if (!Number.isFinite(days)) return "—";
  if (days <= 0) return `Expiré depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  if (days < 60) return `${days} jour${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths === 0 ? `${years} an${years > 1 ? "s" : ""}` : `${years} an${years > 1 ? "s" : ""} ${remMonths} mois`;
}

export function getCodeStatistique(profile: LegalProfile, cycle: CycleLegal): string {
  return profile.codesStatistiques[cycle] || "";
}

// Mappe le niveau interne ("college" | "lycee" | "primaire" | "maternelle" | "secondaire")
// vers les 3 cycles officiels du code statistique.
export function mapNiveauToCycle(niveau: string | undefined | null): CycleLegal {
  const n = (niveau || "").toLowerCase();
  if (n === "maternelle") return "maternelle";
  if (n === "primaire") return "primaire";
  return "secondaire"; // college, lycee, secondaire → secondaire
}

// Résout les 4 champs (agrement, ministere, ire, dpe) en piochant
// d'abord dans le profil légal structuré (schoolInfo.legal), avec
// fallback sur les champs legacy de schoolInfo. Utilisé par reports.js
// pour les en-têtes de bulletins / attestations / livrets.
//
// Pourquoi un helper plutôt que d'inliner : reports.js a 12+ usages
// répartis dans 4 fonctions ; centraliser évite d'oublier un endroit
// et garde la sémantique "legal d'abord" en un seul point.
export function resolveLegalFields(schoolInfo: {
  legal?: LegalProfile;
  ministere?: string;
  agrement?: string;
  ire?: string;
  dpe?: string;
}): { ministere: string; agrement: string; ire: string; dpe: string } {
  const legal = schoolInfo.legal;
  return {
    ministere: legal?.etablissement?.ministereTutelle || schoolInfo.ministere || "",
    agrement: legal?.arreteOuverture?.numero || schoolInfo.agrement || "",
    ire: legal?.etablissement?.ire || schoolInfo.ire || "",
    dpe: legal?.etablissement?.dpe || schoolInfo.dpe || "",
  };
}

// ── HTML helper pour les documents imprimés (bulletins, attestations) ──
// Style discret, centré, petite police grise. Compatible avec @page A4.
// Renvoie une chaîne vide si l'école n'a pas renseigné son arrêté :
// on n'imprime jamais une mention « agréé » fabriquée.
export function getOfficialLegalFooterHTML(profile: LegalProfile, cycle: CycleLegal): string {
  if (!profile?.arreteOuverture?.numero) return "";
  const code = getCodeStatistique(profile, cycle);
  const num = profile.arreteOuverture.numero;
  const date = formatDateFR(profile.arreteOuverture.dateSignature);
  return `<div class="legal-footer" style="margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:8.5px;color:#6b7280;line-height:1.5;font-family:Arial,sans-serif">
    Établissement agréé — Arrêté ${num} du ${date}${code ? ` — Code statistique : ${code}` : ""}
  </div>`;
}

// ── Firestore ─────────────────────────────────────────────────
// Doc unique : /ecoles/{schoolId}/config/legal

import { doc, getDoc, setDoc } from "firebase/firestore";
import { safeOnSnapshot } from "./firestore-safe";
import { db } from "./firebaseDb";

const LEGAL_DOC_ID = "legal";

function legalDocRef(schoolId: string) {
  return doc(db, "ecoles", schoolId, "config", LEGAL_DOC_ID);
}

// Fallback quand le doc /config/legal n'existe pas encore : le mock ne
// contient QUE les données de La Citadelle (seed historique), donc on ne
// le sert qu'à elle — toute autre école part d'un profil vide qu'elle
// renseigne dans Paramètres → Officiel.
function fallbackLegalProfile(schoolId: string): LegalProfile {
  return schoolId === "citadelle" ? legalProfileMock : legalProfileVide;
}

// Lit le profil légal une fois (fallback par école si le doc n'existe pas).
export async function getLegalProfile(schoolId: string): Promise<LegalProfile> {
  const snap = await getDoc(legalDocRef(schoolId));
  if (!snap.exists()) return fallbackLegalProfile(schoolId);
  return snap.data() as LegalProfile;
}

// Écrit le profil complet (merge avec l'existant). Le formulaire de la
// modale fournit l'objet entier — on n'expose pas de patch partiel pour
// éviter les états incohérents (ex. dateSignature changée mais pas la
// durée, qui invaliderait l'expiration calculée).
export async function updateLegalProfile(
  schoolId: string,
  profile: LegalProfile,
): Promise<void> {
  await setDoc(legalDocRef(schoolId), profile, { merge: true });
}

// Listener temps réel (fallback par école tant que le doc n'existe pas).
// Retourne la fonction unsubscribe.
export function subscribeLegalProfile(
  schoolId: string,
  cb: (profile: LegalProfile) => void,
): () => void {
  return safeOnSnapshot(legalDocRef(schoolId), (snap) => {
    cb(snap.exists() ? (snap.data() as LegalProfile) : fallbackLegalProfile(schoolId));
  });
}
