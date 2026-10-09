import { getAnnee } from "../../constants";
import { getAnnualAverage, getSubjectAverage } from "../../note-utils";
import { notesDeLEleve } from "../../note-index";

// Helpers purs des livrets scolaires (sans état React).

// Génère un numéro de livret incrémental : LIV-AA-NNNN.
export function genNumeroLivret(livrets) {
  const an = getAnnee().split("-")[0].slice(-2);
  const nums = livrets.map((l) => parseInt((l.numeroLivret || "").replace(/[^0-9]/g, "")) || 0);
  const n = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `LIV-${an}-${String(n).padStart(4, "0")}`;
}

// Construit le document livret initial pour un élève.
export function buildNouveauLivret(eleve, { section, numeroLivret, annee }) {
  return {
    eleveId: eleve._id,
    eleveNom: `${eleve.nom} ${eleve.prenom}`,
    matricule: eleve.matricule || "",
    ien: eleve.ien || "",
    dateNaissance: eleve.dateNaissance || "",
    lieuNaissance: eleve.lieuNaissance || "",
    photo: eleve.photo || "",
    section,
    numeroLivret,
    dateCreation: new Date().toISOString().slice(0, 10),
    annees: [],
    annee: annee || getAnnee(),
  };
}

// Pré-remplit une entrée annuelle depuis les notes de l'élève pour CETTE année.
// Un élève resté dans la même section d'une année sur l'autre (7ème → 8ème) a
// un T1 chaque année : sans filtre par année, le pré-remplissage les moyennait
// ensemble. Même règle que le module École (filtre `annee = ?` au chargement) :
// une note sans année n'est pas reprise.
export function buildAnneePreRemplie(eleve, { notes, matieres, periodes, section, maxNote, eleves, annee }) {
  const anneeScolaire = annee || getAnnee();
  const notesEleve = notesDeLEleve(notes, eleve._id).filter((n) => n.annee === anneeScolaire);
  const matieresList = matieres.map((mat) => {
    const notesParPeriode = periodes.reduce((acc, p) => {
      const ns = notesEleve.filter((n) => n.matiere === mat.nom && n.periode === p);
      acc[p] = getSubjectAverage(ns, eleve.classe, section);
      return acc;
    }, {});
    // Moyenne annuelle par matière : diviseur fixe au nombre de périodes
    // (3 trimestres, 2 semestres ou 9 mois), périodes vides comptées 0.
    const ann = getAnnualAverage(periodes.map((p) => notesParPeriode[p]));
    return { matiere: mat.nom, coef: mat.coefficient || 1, maxNote, ...notesParPeriode, annuelle: ann };
  });
  return {
    anneeScolaire,
    classe: eleve.classe || "",
    enseignantPrincipal: "",
    notes: matieresList,
    absences: { justifiees: 0, nonJustifiees: 0 },
    rang: "", effectifClasse: eleves.filter((e) => e.classe === eleve.classe).length,
    appreciation: "", decision: "Admis",
    signe: false, dateSigne: null,
  };
}

// Années du livret après saisie : remplace l'entrée éditée, sinon en ajoute une.
// `_idx` (index édité) est un marqueur du formulaire, jamais persisté.
export function anneesApresSaisie(annees, formAnnee) {
  const { _idx, ...entree } = formAnnee;
  const liste = [...(annees || [])];
  if (_idx != null) liste[_idx] = entree;
  else liste.push(entree);
  return liste;
}

// Années du livret après signature de l'entrée `idx` (verrouillée ensuite).
export function anneesApresSignature(annees, idx, dateSigne) {
  return (annees || []).map((an, i) => (i === idx ? { ...an, signe: true, dateSigne } : an));
}
