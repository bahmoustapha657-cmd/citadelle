import { getAnnee } from "../../constants";
import { getAnnualAverage, getSubjectAverage } from "../../note-utils";

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

// Pré-remplit une entrée annuelle depuis les notes actuelles de l'élève.
export function buildAnneePreRemplie(eleve, { notes, matieres, periodes, section, maxNote, eleves, annee }) {
  const notesEleve = notes.filter((n) => n.eleveId === eleve._id);
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
    anneeScolaire: annee || getAnnee(),
    classe: eleve.classe || "",
    enseignantPrincipal: "",
    notes: matieresList,
    absences: { justifiees: 0, nonJustifiees: 0 },
    rang: "", effectifClasse: eleves.filter((e) => e.classe === eleve.classe).length,
    appreciation: "", decision: "Admis",
    signe: false, dateSigne: null,
  };
}
