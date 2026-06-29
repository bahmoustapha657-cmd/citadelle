// ── Pont modèle Firestore → modèle Supabase ─────────────────────────────────
// Firestore éclate les entités par section (elevesPrimaire/College/Lycee, …).
// Supabase les unifie en UNE table + colonne `section`. Ce module :
//   1) résout un nom de collection Firestore → { table, section }
//   2) transforme une ligne Postgres (snake_case) en item camelCase IDENTIQUE
//      à ce que renvoyait Firestore (les composants n'ont rien à changer).
//
// Les collections sans table Supabase (annonces, documents, examens, livrets,
// honneurs, messages, membres, personnel, evenements, bons, recettes, depenses,
// versements) renvoient `null` → l'adaptateur retourne [] (écran vide, pas de
// crash). À modéliser dans une tranche ultérieure.

const SECTIONS = { Primaire: "primaire", College: "college", Lycee: "lycee" };

// Entités sectionnées : {base}{Section} éventuellement suffixé _{sous-entité}.
const BASE_TABLE = {
  eleves: "eleves", notes: "notes", classes: "classes",
  ens: "enseignants", absences: "absences", appreciations: "appreciations",
};
const SUFFIX_TABLE = {
  absences: "absences", emplois: "emplois",
  enseignements: "enseignements", matieres: "matieres",
};
const SECTIONAL = /^(eleves|notes|classes|ens|absences|appreciations)(Primaire|College|Lycee)(?:_(absences|emplois|enseignements|matieres))?$/;

// Entités au niveau école (sans section) qui ONT une table Supabase.
const FLAT_TABLE = { comptes: "comptes", tarifs: "tarifs", salaires: "salaires" };

export function resolveCollection(nomCollection) {
  const m = SECTIONAL.exec(nomCollection);
  if (m) {
    const [, base, sec, suffix] = m;
    const section = SECTIONS[sec];
    const table = suffix ? SUFFIX_TABLE[suffix] : BASE_TABLE[base];
    return table ? { table, section } : null;
  }
  if (FLAT_TABLE[nomCollection]) return { table: FLAT_TABLE[nomCollection], section: null };
  return null;
}

// ── Transformateurs ligne Postgres → item camelCase ────────────────────────
// `extra`/`details` (jsonb) re-déversent les champs d'origine non colonnes,
// APRÈS les champs explicites (qui priment).
const TRANSFORMERS = {
  eleves: (r) => ({
    _id: r.id, section: r.section, nom: r.nom, prenom: r.prenom, sexe: r.sexe,
    matricule: r.matricule, ien: r.ien, classe: r.classe,
    dateNaissance: r.date_naissance, lieuNaissance: r.lieu_naissance,
    filiation: r.filiation, tuteur: r.tuteur, contactTuteur: r.contact_tuteur,
    domicile: r.domicile, photo: r.photo, statut: r.statut, ...(r.extra || {}),
  }),
  notes: (r) => ({
    _id: r.id, section: r.section, eleveId: r.eleve_id, matiere: r.matiere,
    type: r.type, periode: r.periode, note: Number(r.note), annee: r.annee,
    enseignantId: r.enseignant_id, enseignantNom: r.enseignant_nom,
  }),
  absences: (r) => ({
    _id: r.id, section: r.section, eleveId: r.eleve_id, type: r.type,
    date: r.date, justifie: r.justifie, motif: r.motif, matiere: r.matiere,
    signaledByEnseignantId: r.signale_par_id, signaledByEnseignantNom: r.signale_par_nom,
  }),
  classes: (r) => ({
    _id: r.id, section: r.section, nom: r.nom, effectif: r.effectif,
    enseignantId: r.enseignant_id, salle: r.salle, ...(r.extra || {}),
  }),
  enseignants: (r) => ({
    _id: r.id, section: r.section, nom: r.nom, prenom: r.prenom,
    matiere: r.matiere, contact: r.contact, statut: r.statut, ...(r.extra || {}),
  }),
  matieres: (r) => ({
    _id: r.id, section: r.section, nom: r.nom,
    coefficient: Number(r.coefficient), ...(r.extra || {}),
  }),
  emplois: (r) => ({
    _id: r.id, section: r.section, classe: r.classe, jour: r.jour,
    heureDebut: r.heure_debut, heureFin: r.heure_fin, matiere: r.matiere,
    enseignant: r.enseignant, salle: r.salle, ...(r.extra || {}),
  }),
  enseignements: (r) => ({
    _id: r.id, section: r.section, classe: r.classe, matiere: r.matiere,
    enseignantNom: r.enseignant_nom, contenu: r.contenu, ...(r.extra || {}),
  }),
  appreciations: (r) => ({
    _id: r.id, section: r.section, eleveId: r.eleve_id,
    periode: r.periode, texte: r.texte,
  }),
  comptes: (r) => ({
    _id: r.id, login: r.login, role: r.role, nom: r.nom, label: r.label,
    section: r.section, sections: r.sections || [], enseignantId: r.enseignant_id,
    enseignantNom: r.enseignant_nom, matiere: r.matiere, statut: r.statut,
    premiereCo: !!r.premiere_co, ...(r.extra || {}),
  }),
  tarifs: (r) => ({
    _id: r.id, section: r.section, classe: r.classe,
    montant: Number(r.montant), ...(r.extra || {}),
  }),
  salaires: (r) => ({
    _id: r.id, nom: r.nom, section: r.section, mois: r.mois,
    montantNet: Number(r.montant_net), ...(r.details || {}),
  }),
};

export function transformRow(table, row) {
  const fn = TRANSFORMERS[table];
  return fn ? fn(row) : { _id: row.id, ...row };
}
