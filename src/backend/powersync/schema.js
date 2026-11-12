// ── Schéma local (SQLite via PowerSync) — hors ligne TOTAL (sauf parent) ────
// Colonnes = exactement celles lues/écrites par collection-map.js
// (transformRow/toRow) ; les colonnes de schema.sql non exposées par la
// couche de transformation (ex. eleves.created_at) sont volontairement
// omises ici aussi, pour ne pas dupliquer un contrat qui n'existe pas déjà
// côté lecture/écriture. Les jsonb Postgres arrivent en TEXT — la frontière
// (dé)sérialisation est JSON_COLS dans tables.js.
import { Schema, Table, column } from "@powersync/web";

// Les tables à colonne jsonb « document » (extra, details) gardent, dans la
// file d'envoi, la valeur de cette colonne AVANT chaque modification
// (trackPrevious) : la remontée envoie alors la seule DIFFÉRENCE, fusionnée
// en base chemin par chemin (envoi-operation.js, fusion-jsonb.js), au lieu
// d'écraser tout le jsonb avec la copie de l'appareil.
function table(colonnes, options = {}) {
  const jsonb = ["extra", "details"].filter((c) => c in colonnes);
  return new Table(colonnes, jsonb.length ? { ...options, trackPrevious: { columns: jsonb } } : options);
}

const eleves = table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, prenom: column.text,
    sexe: column.text, matricule: column.text, ien: column.text, classe: column.text,
    date_naissance: column.text, lieu_naissance: column.text, filiation: column.text,
    tuteur: column.text, contact_tuteur: column.text, domicile: column.text,
    photo: column.text, statut: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"], ecole_classe: ["ecole_id", "section", "classe"] } },
);

const notes = table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text, matiere: column.text,
    type: column.text, periode: column.text, note: column.real, annee: column.text,
    enseignant_id: column.text, enseignant_nom: column.text,
    created_at: column.text, updated_at: column.text,
  },
  { indexes: { eleve: ["eleve_id"], scope: ["ecole_id", "section", "annee", "periode"] } },
);

const absences = table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text, type: column.text,
    date: column.text, justifie: column.text, motif: column.text, matiere: column.text,
    signale_par_id: column.text, signale_par_nom: column.text,
    heure_debut: column.text, heure_fin: column.text,
  },
  { indexes: { eleve: ["eleve_id"] } },
);

const classes = table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, effectif: column.integer,
    enseignant_id: column.text, salle: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const enseignants = table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, prenom: column.text,
    matiere: column.text, contact: column.text, statut: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const matieres = table(
  {
    ecole_id: column.text, section: column.text, nom: column.text,
    coefficient: column.real, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const emplois = table(
  {
    ecole_id: column.text, section: column.text, classe: column.text, jour: column.text,
    heure_debut: column.text, heure_fin: column.text, matiere: column.text,
    enseignant: column.text, salle: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const enseignements = table(
  {
    ecole_id: column.text, section: column.text, classe: column.text, matiere: column.text,
    enseignant_nom: column.text, contenu: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

// `annee` (ajoutée côté Postgres le 2026-08-12) : sans elle, la vue locale
// refusait toute écriture d'appréciation (« has no column named annee ») et
// la lecture ne pouvait pas filtrer par année.
const appreciations = table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text,
    periode: column.text, texte: column.text, annee: column.text,
  },
  { indexes: { eleve: ["eleve_id"] } },
);

// ── Comptabilité ─────────────────────────────────────────────────────────────
// Grands livres (recettes/depenses/versements/bons) : même forme uniforme.
const livreCols = {
  ecole_id: column.text, annee: column.text, date: column.text,
  montant: column.real, extra: column.text,
};
const livreOpts = { indexes: { scope: ["ecole_id", "annee"] } };
const recettes = table({ ...livreCols }, livreOpts);
const depenses = table({ ...livreCols }, livreOpts);
const versements = table({ ...livreCols }, livreOpts);
const bons = table({ ...livreCols }, livreOpts);
// Registre des présences du personnel : même forme, sans montant.
const presences = table(
  { ecole_id: column.text, annee: column.text, date: column.text, extra: column.text },
  livreOpts,
);

const personnel = table(
  { ecole_id: column.text, nom: column.text, prenom: column.text, extra: column.text },
  { indexes: { ecole: ["ecole_id"] } },
);

// Paie des enseignants (id = celui de la fiche) : réservée à la compta.
const paie_enseignants = table(
  { ecole_id: column.text, extra: column.text },
  { indexes: { ecole: ["ecole_id"] } },
);

// `annee` : même défaut que les appréciations (écrite par toRow depuis le
// 2026-08-12, absente de la vue locale).
const salaires = table(
  {
    ecole_id: column.text, nom: column.text, section: column.text,
    mois: column.text, montant_net: column.real, details: column.text,
    annee: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

const tarifs = table(
  {
    ecole_id: column.text, section: column.text, classe: column.text,
    montant: column.real, extra: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

// Journal des encaissements : en AJOUT SEUL (cf. connector.js). Hors ligne,
// l'encaissement s'écrivait sur la fiche élève (miroir local) mais sa ligne
// de journal partait au réseau et se perdait — 345 mois encaissés sans trace
// en deux jours dans une école. `created_at` est posé à la saisie (local-data)
// : il ordonne encaissements et corrections (lignesNeutralisees), et doit
// dater le geste, pas le retour du réseau.
const paiements = table(
  {
    ecole_id: column.text, annee: column.text, type: column.text, statut: column.text,
    eleve_id: column.text, eleve_nom: column.text, classe: column.text, mois: column.text,
    libelle: column.text, montant: column.real, date_paiement: column.text,
    auteur: column.text, extra: column.text, created_at: column.text,
  },
  { indexes: { scope: ["ecole_id", "annee"], eleve: ["eleve_id"] } },
);

// ── Modules « document » (contenu dans extra, cf. modules.sql) ──────────────
const docCols = { ecole_id: column.text, extra: column.text };
const docOpts = { indexes: { ecole: ["ecole_id"] } };
const evenements = table({ ...docCols }, docOpts);
const examens = table({ ...docCols }, docOpts);
const livrets = table({ ...docCols }, docOpts);
const honneurs = table({ ...docCols }, docOpts);
const annonces = table({ ...docCols }, docOpts);
const membres = table({ ...docCols }, docOpts);
const documents = table({ ...docCols }, docOpts);
const historique = table({ ...docCols }, docOpts);

// messages : eleve_id en colonne réelle (filtre RLS parent), reste dans extra.
const messages = table(
  { ecole_id: column.text, eleve_id: column.text, extra: column.text },
  { indexes: { ecole: ["ecole_id"], eleve: ["eleve_id"] } },
);

// ── Référentiels (lecture hors ligne) ────────────────────────────────────────
const comptes = table(
  {
    ecole_id: column.text, user_id: column.text, login: column.text,
    email: column.text, role: column.text, nom: column.text, label: column.text,
    section: column.text, sections: column.text, enseignant_id: column.text,
    enseignant_nom: column.text, matiere: column.text, statut: column.text,
    premiere_co: column.integer, poste_id: column.text, extra: column.text,
  },
  { indexes: { ecole: ["ecole_id"], poste: ["poste_id"] } },
);

const postes = table(
  {
    ecole_id: column.text, cle: column.text, label: column.text,
    systeme: column.integer, actif: column.integer,
    responsable: column.text, permissions: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

// ecoles : une ligne par école (id = clé du bucket, pas d'ecole_id).
const ecoles = table({
  code: column.text, nom: column.text, logo: column.text,
  couleur1: column.text, couleur2: column.text, pays: column.text,
  devise: column.text, plan: column.text, plan_expiry: column.integer,
  modele_bulletin: column.text, role_settings: column.text,
  legal: column.text, extra: column.text,
});

export const AppSchema = new Schema({
  eleves, notes, absences, classes, enseignants, matieres, emplois, enseignements, appreciations,
  recettes, depenses, versements, bons, personnel, salaires, tarifs, paiements, presences, paie_enseignants,
  evenements, examens, livrets, honneurs, annonces, membres, documents, historique, messages,
  comptes, postes, ecoles,
});
