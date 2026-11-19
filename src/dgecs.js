// ══════════════════════════════════════════════════════════════
//  Plateforme du ministère (DGECS, dgecsecoles.com) — lot B
// ══════════════════════════════════════════════════════════════
// Toute école guinéenne, publique comme privée, inscrit ses élèves sur la
// plateforme de la DGECS par leur MATRICULE, y saisit à la main UNE note par
// matière et par élève (tableau Matricule | Prénom et Nom | une colonne par
// matière), puis « Clôture » la classe : plus aucune modification. Une note
// manquante y classe l'élève redoublant. EduGest ne peut pas écrire sur la
// plateforme (aucun import connu) : il prépare ce qu'il faut y recopier et
// signale ce qui manque AVANT la clôture.
//
// Le matricule de la plateforme est l'identifiant national de l'élève : on le
// range dans le champ `ien` qui existait déjà (fiche d'enrôlement, import).
//
// Trois documents, par section :
//  - la fiche de notes d'une classe (moyenne annuelle ou d'une période) ;
//  - les statistiques de rentrée demandées par la DPE/DSEE (effectifs par
//    niveau et par sexe, redoublants, classes, enseignants) ;
//  - la liste des candidats aux examens (CEE en 6ème Année, BEPC en 10ème
//    Année, BAC en Terminale) avec ce qui manque à chaque dossier.
import { estSorti, getNiveauxForSection, getSystemeScolaire, SECTIONS_ECOLE } from "./constants.js";
import { estEspaceEnseignant } from "./espace-enseignant.js";
import { getDirectSubjectAverage, getSubjectAverage } from "./note-utils.js";
import { notesDeLEleve } from "./note-index.js";
import { PERIODE_ANNEE, buildBulletinNotesAnnuelles } from "./reports/bulletins/annual-notes.js";

export { PERIODE_ANNEE };

// Sections dont les notes et les effectifs remontent à la DGECS : pas la
// maternelle, qui n'a ni notes ni examen.
export const SECTIONS_DGECS = ["primaire", "college", "lycee"];

// Examen national passé à la fin de chaque cycle (système guinéen).
export const EXAMENS_PAR_SECTION = { primaire: "CEE", college: "BEPC", lycee: "BAC" };

// Onglet « DGECS » du module École : système guinéen seulement (la
// plateforme est guinéenne), écoles publiques ET privées, jamais dans
// l'espace d'un enseignant seul (il n'est pas un établissement).
export const ongletDgecsOuvert = (schoolInfo, section) =>
  getSystemeScolaire(schoolInfo || {}) === "guineen"
  && SECTIONS_DGECS.includes(section)
  && !estEspaceEnseignant(schoolInfo);

export const matriculeDgecs = (eleve) => String(eleve?.ien || "").trim();

// Saisie d'un matricule : majuscules, sans espaces (« ma 2503 2033 » →
// « MA25032033 »), comme la plateforme l'affiche.
export const normaliserMatricule = (texte) => String(texte || "").toUpperCase().replace(/\s+/g, "");

// La plateforme affiche « PRÉNOM NOM » en majuscules.
export const nomDgecs = (eleve = {}) =>
  `${eleve.prenom || ""} ${eleve.nom || ""}`.replace(/\s+/g, " ").trim().toLocaleUpperCase("fr");

// Note telle qu'on la tape sur la plateforme : point décimal, deux décimales
// au plus (7.666… → « 7.67 », 12,5 → « 12.5 »).
export const formatNoteDgecs = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return "";
  return String(Math.round(nombre * 100) / 100);
};

// « 2014-03-09 » → « 09/03/2014 » ; une date saisie autrement reste telle quelle.
export const dateLisible = (date) => {
  const texte = String(date || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : texte;
};

const comparerTextes = (a, b) => String(a || "").localeCompare(String(b || ""), "fr", { sensitivity: "base", numeric: true });
const comparerEleves = (a, b) => comparerTextes(a.nom, b.nom) || comparerTextes(a.prenom, b.prenom);

// Élèves présents dans la classe (les partis n'ont plus de place sur la
// plateforme), par ordre alphabétique du nom.
export const elevesDeClasse = (eleves = [], classe = "") =>
  eleves.filter((e) => e.classe === classe && !estSorti(e)).sort(comparerEleves);

// Redoublant de l'année : repère posé à la main (onglet DGECS) pour une
// année donnée — il ne suit pas l'élève l'année suivante.
export const estRedoublant = (eleve, annee) => !!annee && eleve?.redoublantAnnee === annee;

const coefficientDe = (matiere) => {
  const coef = Number(matiere?.coefficient ?? 1);
  return Number.isFinite(coef) && coef > 0 ? coef : 1;
};

// Matricules portés par plusieurs élèves : la plateforme en refuserait un.
export function matriculesEnDouble(eleves = []) {
  const vus = new Map();
  for (const e of eleves) {
    const matricule = matriculeDgecs(e);
    if (matricule) vus.set(matricule, (vus.get(matricule) || 0) + 1);
  }
  return [...vus].filter(([, n]) => n > 1).map(([matricule]) => matricule).sort();
}

// ── Fiche de notes d'une classe ────────────────────────────────
// Une ligne par élève, une cellule par matière évaluée de la classe :
//  - période = PERIODE_ANNEE : moyenne annuelle de la matière, calculée
//    comme au bulletin de fin d'année ;
//  - sinon : moyenne de la matière sur cette période, comme au bulletin.
// Cellule « manquante » : aucune note. Cellule « incomplète » (année
// seulement) : la moyenne existe, mais il manque à l'élève une période — le
// bulletin compte alors cette période pour 0, la note recopiée serait
// fausse (sauf moyenne de la matière saisie directement, qui vaut pour
// l'année). `periodesVides` : périodes où la classe n'a encore aucune note.
export function ficheNotesDgecs({ eleves = [], notes = [], matieres = [], periodes = [], periode = PERIODE_ANNEE, classe = "" }) {
  const liste = elevesDeClasse(eleves, classe);
  const valeurs = new Map();
  const poser = (eleveId, matiere, note) => {
    if (!valeurs.has(eleveId)) valeurs.set(eleveId, new Map());
    valeurs.get(eleveId).set(matiere, note);
  };
  const annuelle = periode === PERIODE_ANNEE;
  // Moyennes annuelles qui manquent d'une période, et périodes notées dans
  // la classe (toutes matières).
  const incompletes = new Set();
  const periodesNotees = new Set();
  for (const e of liste) {
    const notesE = notesDeLEleve(notes, e._id);
    notesE.forEach((n) => periodesNotees.add(n.periode));
    for (const m of matieres) {
      const notesMat = notesE.filter((n) => n.matiere === m.nom);
      if (annuelle) {
        const notees = new Set(notesMat.map((n) => n.periode));
        const directe = getDirectSubjectAverage(notesMat) !== null;
        if (notesMat.length && !directe && periodes.some((p) => !notees.has(p))) incompletes.add(`${e._id}|${m.nom}`);
      } else {
        const moyenne = getSubjectAverage(notesMat.filter((n) => n.periode === periode), e.classe);
        if (moyenne !== null && moyenne !== undefined) poser(e._id, m.nom, moyenne);
      }
    }
  }
  if (annuelle) {
    for (const n of buildBulletinNotesAnnuelles({ eleves: liste, notes, matsFor: () => matieres, periodes })) {
      poser(n.eleveId, n.matiere, n.note);
    }
  }

  const lignes = liste.map((eleve, i) => {
    const cellules = matieres.map((m) => {
      const valeur = valeurs.get(eleve._id)?.get(m.nom);
      const presente = valeur !== null && valeur !== undefined;
      const incomplete = presente && incompletes.has(`${eleve._id}|${m.nom}`);
      return { valeur: presente ? valeur : null, texte: presente ? formatNoteDgecs(valeur) : "", incomplete };
    });
    return {
      eleve, numero: i + 1, matricule: matriculeDgecs(eleve), nom: nomDgecs(eleve), cellules,
      manquantes: cellules.filter((c) => c.valeur === null).length,
      incompletes: cellules.filter((c) => c.incomplete).length,
    };
  });

  const notesManquantes = lignes.reduce((s, l) => s + l.manquantes, 0);
  const notesIncompletes = lignes.reduce((s, l) => s + l.incompletes, 0);
  const sansMatricule = lignes.filter((l) => !l.matricule).length;
  const doublons = matriculesEnDouble(liste);
  return {
    classe, periode,
    periodesVides: annuelle && liste.length ? periodes.filter((p) => !periodesNotees.has(p)) : [],
    matieres: matieres.map((m) => ({ nom: m.nom, titre: String(m.nom || "").toLocaleUpperCase("fr"), coefficient: coefficientDe(m) })),
    lignes, notesManquantes, notesIncompletes, sansMatricule, doublons,
    pret: lignes.length > 0 && matieres.length > 0
      && notesManquantes === 0 && notesIncompletes === 0 && sansMatricule === 0 && doublons.length === 0,
  };
}

// ── Niveau d'une classe ────────────────────────────────────────
// « 7ème Année B » → « 7ème Année », « Terminale SM » → « Terminale ». Une
// classe au nom libre reste son propre niveau.
const sansAccents = (texte) => String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

export function niveauDeClasse(classe, systeme = "guineen") {
  const cle = sansAccents(classe);
  const niveaux = SECTIONS_ECOLE.flatMap((s) => getNiveauxForSection(s, systeme))
    // Plus long d'abord : « 10ème Année » avant « 1ère Année ».
    .sort((a, b) => b.length - a.length);
  return niveaux.find((n) => cle === sansAccents(n) || cle.startsWith(`${sansAccents(n)} `)) || String(classe || "").trim();
}

// ── Statistiques de rentrée (fiche d'enquête de la DPE/DSEE) ───
// Par niveau, dans l'ordre du cycle : nombre de classes, garçons, filles,
// total, redoublants (garçons, filles, total). Puis les enseignants de la
// section, hommes et femmes d'après leur civilité.
const compterSexes = (liste) => {
  const garcons = liste.filter((e) => e.sexe === "M").length;
  const filles = liste.filter((e) => e.sexe === "F").length;
  return { garcons, filles, total: liste.length, sansSexe: liste.length - garcons - filles };
};

export function statistiquesRentree({ eleves = [], classes = [], enseignants = [], section = "primaire", schoolInfo = {}, annee = "" }) {
  const systeme = getSystemeScolaire(schoolInfo || {});
  const presents = eleves.filter((e) => !estSorti(e));
  const ordre = getNiveauxForSection(section, systeme);
  const parNiveau = new Map(ordre.map((n) => [n, { eleves: [], classes: new Set() }]));
  const groupe = (niveau) => {
    if (!parNiveau.has(niveau)) parNiveau.set(niveau, { eleves: [], classes: new Set() });
    return parNiveau.get(niveau);
  };
  for (const c of classes) if (c?.nom) groupe(niveauDeClasse(c.nom, systeme)).classes.add(c.nom);
  for (const e of presents) {
    const g = groupe(niveauDeClasse(e.classe, systeme));
    g.eleves.push(e);
    if (e.classe) g.classes.add(e.classe);
  }
  const lignes = [...parNiveau].map(([niveau, g]) => {
    const redoublants = compterSexes(g.eleves.filter((e) => estRedoublant(e, annee)));
    return { niveau, classes: g.classes.size, ...compterSexes(g.eleves), redoublants };
  }).filter((l) => l.total > 0 || l.classes > 0);
  const somme = (cle, sous) => lignes.reduce((s, l) => s + (sous ? l[sous][cle] : l[cle]), 0);
  const total = {
    classes: somme("classes"), garcons: somme("garcons"), filles: somme("filles"), total: somme("total"), sansSexe: somme("sansSexe"),
    redoublants: { garcons: somme("garcons", "redoublants"), filles: somme("filles", "redoublants"), total: somme("total", "redoublants") },
  };
  const hommes = enseignants.filter((x) => x.civilite === "M").length;
  const femmes = enseignants.filter((x) => x.civilite === "Mme").length;
  return {
    section, annee, lignes, total,
    enseignants: { hommes, femmes, total: enseignants.length, sansCivilite: enseignants.length - hommes - femmes },
  };
}

// ── Candidats aux examens ──────────────────────────────────────
// Élèves présents de la classe d'examen de la section (dernier niveau du
// cycle), classés par classe puis par nom, avec les pièces qui manquent au
// dossier : matricule, sexe, date et lieu de naissance.
export const PIECES_CANDIDAT = ["matricule", "sexe", "dateNaissance", "lieuNaissance"];

export function candidatsExamen({ eleves = [], section = "primaire", schoolInfo = {} }) {
  const systeme = getSystemeScolaire(schoolInfo || {});
  const niveau = getNiveauxForSection(section, systeme).slice(-1)[0] || "";
  const lignes = eleves
    .filter((e) => !estSorti(e) && niveau && niveauDeClasse(e.classe, systeme) === niveau)
    .sort((a, b) => comparerTextes(a.classe, b.classe) || comparerEleves(a, b))
    .map((eleve, i) => {
      const matricule = matriculeDgecs(eleve);
      const manque = PIECES_CANDIDAT.filter((piece) => (piece === "matricule"
        ? !matricule
        : !String(eleve[piece] || "").trim()));
      return { eleve, numero: i + 1, matricule, manque };
    });
  return {
    examen: EXAMENS_PAR_SECTION[section] || "", niveau, lignes,
    incomplets: lignes.filter((l) => l.manque.length > 0).length,
    doublons: matriculesEnDouble(lignes.map((l) => l.eleve)),
  };
}
