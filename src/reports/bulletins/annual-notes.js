// ══════════════════════════════════════════════════════════════
//  Notes annuelles synthétiques (résultats de fin d'année)
// ══════════════════════════════════════════════════════════════
// Pour le bulletin annuel et la fiche de résultats annuelle, on calcule la
// moyenne annuelle de chaque matière = moyenne des périodes
// ((T1+T2+T3)/3, (S1+S2)/2, (M1+…+M9)/9) puis on émet UNE note synthétique
// par élève×matière, taguée sur la période sentinelle PERIODE_ANNEE.
//
// Astuce : en réinjectant ces notes dans le pipeline existant (filtré sur
// PERIODE_ANNEE), la moyenne générale, le rang, la mention et les stats de
// classe se recalculent SANS code dédié. C'est mathématiquement identique à
// la moyenne des moyennes générales périodiques (le dénominateur des
// coefficients étant constant d'une période à l'autre).
import { getAnnualAverage, getSubjectAverage } from "../../note-utils.js";

export const PERIODE_ANNEE = "__ANNEE__";

const nomEleve = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim();

function buildCore({ eleves, notes, matsFor, periodes, valeurPeriode, type }) {
  const out = [];
  for (const e of eleves) {
    const mats = matsFor(e.classe) || [];
    const notesE = notes.filter((n) => n.eleveId === e._id);
    for (const mat of mats) {
      const notesMat = notesE.filter((n) => n.matiere === mat.nom);
      const parPeriode = periodes.map((p) => valeurPeriode(notesMat.filter((n) => n.periode === p), e.classe));
      const annuelle = getAnnualAverage(parPeriode);
      if (annuelle == null) continue;
      out.push({
        eleveId: e._id, eleveNom: nomEleve(e), matiere: mat.nom,
        periode: PERIODE_ANNEE, type, note: annuelle,
      });
    }
  }
  return out;
}

// Bulletin annuel : valeur par période = moyenne de matière (formule
// cours/composition du secondaire, moyenne simple au primaire).
export function buildBulletinNotesAnnuelles({ eleves, notes, matsFor, periodes, niveau }) {
  return buildCore({
    eleves, notes, matsFor, periodes, type: "Composition",
    valeurPeriode: (ns, classe) => getSubjectAverage(ns, classe, niveau),
  });
}

// Fiche de résultats annuelle : valeur par période = moyenne des
// COMPOSITIONS de la matière (la fiche ne classe que sur les compositions).
export function buildFicheNotesAnnuelles({ eleves, notes, matsFor, periodes }) {
  const moyCompo = (ns) => {
    const compos = ns.filter((n) => n.type === "Composition");
    if (!compos.length) return null;
    return compos.reduce((s, n) => s + Number(n.note), 0) / compos.length;
  };
  return buildCore({
    eleves, notes, matsFor, periodes, type: "Composition",
    valeurPeriode: (ns) => moyCompo(ns),
  });
}
