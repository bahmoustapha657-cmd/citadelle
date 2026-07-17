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
const FLAT_TABLE = {
  comptes: "comptes", tarifs: "tarifs", salaires: "salaires",
  // Comptabilité (Tranche 4) :
  recettes: "recettes", depenses: "depenses", versements: "versements",
  bons: "bons", personnel: "personnel",
  // Modules « document » (Tranche 5) — tables uniformes id+ecole_id+extra :
  messages: "messages", annonces: "annonces", documents: "documents",
  examens: "examens", livrets: "livrets", honneurs: "honneurs",
  membres: "membres", evenements: "evenements", historique: "historique",
};

// Tables « document » : tout le contenu vit dans `extra` (jsonb).
// `messages` est traité à part : colonne réelle eleve_id (filtre RLS parent).
const JSONB_TABLES = ["annonces", "documents", "examens", "livrets",
  "honneurs", "membres", "evenements", "historique"];
const jsonbDoc = (r) => ({ _id: r.id, ...(r.extra || {}) });

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
    // Epoch ms comme Firestore : le portail trie les notes récentes en tête.
    createdAt: r.created_at ? Date.parse(r.created_at) : null,
    updatedAt: r.updated_at ? Date.parse(r.updated_at) : null,
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
    _id: r.id, login: r.login, email: r.email || "", role: r.role, nom: r.nom, label: r.label,
    section: r.section, sections: r.sections || [], enseignantId: r.enseignant_id,
    enseignantNom: r.enseignant_nom, matiere: r.matiere, statut: r.statut,
    premiereCo: !!r.premiere_co, posteId: r.poste_id || null, ...(r.extra || {}),
  }),
  tarifs: (r) => ({
    _id: r.id, section: r.section, classe: r.classe,
    montant: Number(r.montant), ...(r.extra || {}),
  }),
  salaires: (r) => ({
    _id: r.id, nom: r.nom, section: r.section, mois: r.mois,
    montantNet: Number(r.montant_net), ...(r.details || {}),
  }),
  // Grands livres : montant numérique + champs libres dans extra.
  recettes: (r) => ({ _id: r.id, annee: r.annee, date: r.date, montant: Number(r.montant), ...(r.extra || {}) }),
  depenses: (r) => ({ _id: r.id, annee: r.annee, date: r.date, montant: Number(r.montant), ...(r.extra || {}) }),
  versements: (r) => ({ _id: r.id, annee: r.annee, date: r.date, montant: Number(r.montant), ...(r.extra || {}) }),
  bons: (r) => ({ _id: r.id, annee: r.annee, date: r.date, montant: Number(r.montant), ...(r.extra || {}) }),
  personnel: (r) => ({ _id: r.id, nom: r.nom, prenom: r.prenom, ...(r.extra || {}) }),
  // eleve_id en colonne (filtre RLS parent) ; le reste dans extra.
  messages: (r) => ({ _id: r.id, eleveId: r.eleve_id, ...(r.extra || {}) }),
};
// Tables « document » : forward = { _id, ...extra }.
for (const t of JSONB_TABLES) TRANSFORMERS[t] = jsonbDoc;

export function transformRow(table, row) {
  const fn = TRANSFORMERS[table];
  return fn ? fn(row) : { _id: row.id, ...row };
}

// ── Sens inverse : item camelCase → ligne Postgres (pour les écritures) ─────
// Pour chaque table : correspondance itemKey → colonne. `extraCol` collecte les
// champs restants (non colonnes) dans le jsonb (extra/details). Les tables sans
// extraCol ignorent ces champs surnuméraires.
const COLUMN_DEFS = {
  eleves: { extraCol: "extra", cols: {
    nom: "nom", prenom: "prenom", sexe: "sexe", matricule: "matricule", ien: "ien",
    classe: "classe", dateNaissance: "date_naissance", lieuNaissance: "lieu_naissance",
    filiation: "filiation", tuteur: "tuteur", contactTuteur: "contact_tuteur",
    domicile: "domicile", photo: "photo", statut: "statut" } },
  notes: { cols: {
    eleveId: "eleve_id", matiere: "matiere", type: "type", periode: "periode",
    note: "note", annee: "annee", enseignantId: "enseignant_id", enseignantNom: "enseignant_nom" } },
  absences: { cols: {
    eleveId: "eleve_id", type: "type", date: "date", justifie: "justifie", motif: "motif",
    matiere: "matiere", signaledByEnseignantId: "signale_par_id", signaledByEnseignantNom: "signale_par_nom" } },
  classes: { extraCol: "extra", cols: {
    nom: "nom", effectif: "effectif", enseignantId: "enseignant_id", salle: "salle" } },
  enseignants: { extraCol: "extra", cols: {
    nom: "nom", prenom: "prenom", matiere: "matiere", contact: "contact", statut: "statut" } },
  matieres: { extraCol: "extra", cols: { nom: "nom", coefficient: "coefficient" } },
  emplois: { extraCol: "extra", cols: {
    classe: "classe", jour: "jour", heureDebut: "heure_debut", heureFin: "heure_fin",
    matiere: "matiere", enseignant: "enseignant", salle: "salle" } },
  enseignements: { extraCol: "extra", cols: {
    classe: "classe", matiere: "matiere", enseignantNom: "enseignant_nom", contenu: "contenu" } },
  appreciations: { cols: { eleveId: "eleve_id", periode: "periode", texte: "texte" } },
  tarifs: { extraCol: "extra", cols: { classe: "classe", montant: "montant" } },
  salaires: { extraCol: "details", cols: { nom: "nom", section: "section", mois: "mois", montantNet: "montant_net" } },
  recettes: { extraCol: "extra", cols: { annee: "annee", date: "date", montant: "montant" } },
  depenses: { extraCol: "extra", cols: { annee: "annee", date: "date", montant: "montant" } },
  versements: { extraCol: "extra", cols: { annee: "annee", date: "date", montant: "montant" } },
  bons: { extraCol: "extra", cols: { annee: "annee", date: "date", montant: "montant" } },
  personnel: { extraCol: "extra", cols: { nom: "nom", prenom: "prenom" } },
  messages: { extraCol: "extra", cols: { eleveId: "eleve_id" } },
};
// Tables « document » : reverse = tous les champs vers `extra`.
for (const t of JSONB_TABLES) COLUMN_DEFS[t] = { extraCol: "extra", cols: {} };

// Tables dont l'écriture est portée (Tranche 3). Les autres restent en garde-fou.
export function ecritureSupportee(table) {
  return Object.prototype.hasOwnProperty.call(COLUMN_DEFS, table);
}

// item camelCase → { ...colonnes, [extraCol]: {restes} }. `champsConnus` permet,
// pour un update partiel, de ne mapper que les clés fournies (toRow renvoie aussi
// `extraKeys` = les clés parties dans le jsonb, utile pour le merge read-modify-write).
export function toRow(table, item) {
  const def = COLUMN_DEFS[table];
  if (!def) return { row: { ...item }, extraKeys: [] };
  const row = {};
  const ignore = new Set(["_id", "id", "section", "createdAt", "updatedAt"]);
  const extra = {};
  const extraKeys = [];
  for (const [key, val] of Object.entries(item)) {
    if (ignore.has(key)) continue;
    if (def.cols[key]) { row[def.cols[key]] = val; continue; }
    if (def.extraCol) { extra[key] = val; extraKeys.push(key); }
  }
  if (def.extraCol && extraKeys.length) row[def.extraCol] = extra;
  return { row, extraKeys, extraCol: def.extraCol };
}
