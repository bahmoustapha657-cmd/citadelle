// ── Schéma local (SQLite via PowerSync) — vague 1, périmètre académique ─────
// Colonnes = exactement celles lues/écrites par collection-map.js
// (transformRow/toRow) pour ces 9 tables ; les colonnes de schema.sql non
// exposées par la couche de transformation (ex. eleves.created_at, notes
// n'ayant pas de colonne extra…) sont volontairement omises ici aussi, pour
// ne pas dupliquer un contrat qui n'existe pas déjà côté lecture/écriture.
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

export const AppSchema = new Schema({
  eleves, notes, absences, classes, enseignants, matieres, emplois, enseignements, appreciations,
});
