// ── Schéma local (SQLite via PowerSync) — hors ligne TOTAL (sauf parent) ────
// Colonnes = exactement celles lues/écrites par collection-map.js
// (transformRow/toRow) ; les colonnes de schema.sql non exposées par la
// couche de transformation (ex. eleves.created_at) sont volontairement
// omises ici aussi, pour ne pas dupliquer un contrat qui n'existe pas déjà
// côté lecture/écriture. Les jsonb Postgres arrivent en TEXT — la frontière
// (dé)sérialisation est JSON_COLS dans tables.js.
import { Schema, Table, column } from "@powersync/web";

const eleves = new Table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, prenom: column.text,
    sexe: column.text, matricule: column.text, ien: column.text, classe: column.text,
    date_naissance: column.text, lieu_naissance: column.text, filiation: column.text,
    tuteur: column.text, contact_tuteur: column.text, domicile: column.text,
    photo: column.text, statut: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"], ecole_classe: ["ecole_id", "section", "classe"] } },
);

const notes = new Table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text, matiere: column.text,
    type: column.text, periode: column.text, note: column.real, annee: column.text,
    enseignant_id: column.text, enseignant_nom: column.text,
    created_at: column.text, updated_at: column.text,
  },
  { indexes: { eleve: ["eleve_id"], scope: ["ecole_id", "section", "annee", "periode"] } },
);

const absences = new Table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text, type: column.text,
    date: column.text, justifie: column.text, motif: column.text, matiere: column.text,
    signale_par_id: column.text, signale_par_nom: column.text,
  },
  { indexes: { eleve: ["eleve_id"] } },
);

const classes = new Table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, effectif: column.integer,
    enseignant_id: column.text, salle: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const enseignants = new Table(
  {
    ecole_id: column.text, section: column.text, nom: column.text, prenom: column.text,
    matiere: column.text, contact: column.text, statut: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const matieres = new Table(
  {
    ecole_id: column.text, section: column.text, nom: column.text,
    coefficient: column.real, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const emplois = new Table(
  {
    ecole_id: column.text, section: column.text, classe: column.text, jour: column.text,
    heure_debut: column.text, heure_fin: column.text, matiere: column.text,
    enseignant: column.text, salle: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const enseignements = new Table(
  {
    ecole_id: column.text, section: column.text, classe: column.text, matiere: column.text,
    enseignant_nom: column.text, contenu: column.text, extra: column.text,
  },
  { indexes: { ecole_section: ["ecole_id", "section"] } },
);

const appreciations = new Table(
  {
    ecole_id: column.text, section: column.text, eleve_id: column.text,
    periode: column.text, texte: column.text,
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
const recettes = new Table({ ...livreCols }, livreOpts);
const depenses = new Table({ ...livreCols }, livreOpts);
const versements = new Table({ ...livreCols }, livreOpts);
const bons = new Table({ ...livreCols }, livreOpts);

const personnel = new Table(
  { ecole_id: column.text, nom: column.text, prenom: column.text, extra: column.text },
  { indexes: { ecole: ["ecole_id"] } },
);

const salaires = new Table(
  {
    ecole_id: column.text, nom: column.text, section: column.text,
    mois: column.text, montant_net: column.real, details: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

const tarifs = new Table(
  {
    ecole_id: column.text, section: column.text, classe: column.text,
    montant: column.real, extra: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

// ── Modules « document » (contenu dans extra, cf. modules.sql) ──────────────
const docCols = { ecole_id: column.text, extra: column.text };
const docOpts = { indexes: { ecole: ["ecole_id"] } };
const evenements = new Table({ ...docCols }, docOpts);
const examens = new Table({ ...docCols }, docOpts);
const livrets = new Table({ ...docCols }, docOpts);
const honneurs = new Table({ ...docCols }, docOpts);
const annonces = new Table({ ...docCols }, docOpts);
const membres = new Table({ ...docCols }, docOpts);
const documents = new Table({ ...docCols }, docOpts);
const historique = new Table({ ...docCols }, docOpts);

// messages : eleve_id en colonne réelle (filtre RLS parent), reste dans extra.
const messages = new Table(
  { ecole_id: column.text, eleve_id: column.text, extra: column.text },
  { indexes: { ecole: ["ecole_id"], eleve: ["eleve_id"] } },
);

// ── Référentiels (lecture hors ligne) ────────────────────────────────────────
const comptes = new Table(
  {
    ecole_id: column.text, user_id: column.text, login: column.text,
    email: column.text, role: column.text, nom: column.text, label: column.text,
    section: column.text, sections: column.text, enseignant_id: column.text,
    enseignant_nom: column.text, matiere: column.text, statut: column.text,
    premiere_co: column.integer, poste_id: column.text, extra: column.text,
  },
  { indexes: { ecole: ["ecole_id"], poste: ["poste_id"] } },
);

const postes = new Table(
  {
    ecole_id: column.text, cle: column.text, label: column.text,
    systeme: column.integer, actif: column.integer,
    responsable: column.text, permissions: column.text,
  },
  { indexes: { ecole: ["ecole_id"] } },
);

// ecoles : une ligne par école (id = clé du bucket, pas d'ecole_id).
const ecoles = new Table({
  code: column.text, nom: column.text, logo: column.text,
  couleur1: column.text, couleur2: column.text, pays: column.text,
  devise: column.text, plan: column.text, plan_expiry: column.integer,
  modele_bulletin: column.text, role_settings: column.text,
  legal: column.text, extra: column.text,
});

export const AppSchema = new Schema({
  eleves, notes, absences, classes, enseignants, matieres, emplois, enseignements, appreciations,
  recettes, depenses, versements, bons, personnel, salaires, tarifs,
  evenements, examens, livrets, honneurs, annonces, membres, documents, historique, messages,
  comptes, postes, ecoles,
});
