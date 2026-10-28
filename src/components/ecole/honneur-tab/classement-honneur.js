// ══════════════════════════════════════════════════════════════
//  Tableau d'honneur — lauréats de CHAQUE classe
// ══════════════════════════════════════════════════════════════
// Un seul palmarès pour toute la section mettait en concurrence la 7ème et la
// 10ème : les petites classes n'y figuraient jamais. Le tableau d'honneur se
// lit classe par classe, comme le rang du bulletin.
//
// Les chiffres sont CEUX DU BULLETIN, calculés de la même façon :
//   • une période à la fois (T1, S2…) ou l'année (moyenne des périodes, via
//     les notes annuelles synthétiques de annual-notes.js) — l'ancien
//     palmarès mêlait toutes les notes de l'année et ne correspondait à
//     aucun bulletin ;
//   • moyenne générale = getGeneralAverage avec la SECTION du module
//     (même appel que le bulletin imprimé) ;
//   • rang avec ex aequo : deux élèves à la même moyenne partagent le rang,
//     le suivant saute d'autant (règle de getRangEleve) ;
//   • élèves retenus = elevesPourPeriode : les présents, plus les partis qui
//     ont des notes sur la période — ils étaient en classe.
// Un élève sans aucune note sur la période n'est pas classé : getGeneralAverage
// lui donnerait 0, et il n'a rien à faire sur une affiche.
import { elevesPourPeriode } from "../../../depart-utils.js";
import { getGeneralAverage } from "../../../note-utils.js";
import { indexerNotesParEleve, notesDeLEleve } from "../../../note-index.js";
import { PERIODE_ANNEE, buildBulletinNotesAnnuelles } from "../../../reports/bulletins/annual-notes.js";

// Nombre de lauréats par classe proposé à la Direction.
export const NOMBRES_HONNEUR = [3, 5, 10];
export const NOMBRE_HONNEUR_DEFAUT = 5;

// Moyenne minimale, en PART DU BARÈME : le primaire et le préscolaire sont
// notés sur 10, un seuil « 10 » figé y écarterait tout le monde. Par défaut,
// la moyenne : une affiche qui félicite ne porte pas « Insuffisant ».
export const SEUILS_HONNEUR = [
  { id: "aucun", part: 0, libelle: "Sans minimum" },
  { id: "passable", part: 0.5, libelle: "Moyenne" },
  { id: "assez-bien", part: 0.6, libelle: "Assez bien" },
  { id: "bien", part: 0.7, libelle: "Bien" },
];
export const SEUIL_HONNEUR_DEFAUT = "passable";
export const partDuSeuil = (id) => (SEUILS_HONNEUR.find((s) => s.id === id) || SEUILS_HONNEUR[1]).part;

// Période ouverte à l'arrivée sur l'onglet : la DERNIÈRE qui a des notes. La
// première période (défaut des bulletins) montrerait le T1 en plein T3.
export function periodeHonneurParDefaut(notes = [], periodes = []) {
  const avecNotes = new Set(notes.map((n) => n.periode));
  for (let i = periodes.length - 1; i >= 0; i--) if (avecNotes.has(periodes[i])) return periodes[i];
  return periodes[0] || PERIODE_ANNEE;
}

// Notes sur lesquelles classer : celles de la période, ou les notes annuelles
// synthétiques (une par élève × matière, taguées PERIODE_ANNEE).
function notesAClasser({ eleves, notes, matieresForClasse, periode, periodes, section }) {
  if (periode !== PERIODE_ANNEE) return notes;
  return buildBulletinNotesAnnuelles({ eleves, notes, matsFor: matieresForClasse, periodes, niveau: section });
}

// Classe un groupe d'élèves par moyenne générale décroissante, rang avec ex
// aequo. Renvoie [{ ...eleve, moyenne, rang }], élèves sans note écartés.
function classer(groupe, index, matieresForClasse, section) {
  const classement = groupe
    .map((e) => {
      const notesE = notesDeLEleve(index, e._id);
      if (!notesE.length) return null;
      const moyenne = getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe, section);
      return moyenne != null && moyenne > 0 ? { ...e, moyenne } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.moyenne - a.moyenne
      || `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr"));
  classement.forEach((e, i) => {
    e.rang = i > 0 && e.moyenne === classement[i - 1].moyenne ? classement[i - 1].rang : i + 1;
  });
  return classement;
}

// Classes dans l'ordre des niveaux pour les écoles qui les numérotent
// (« 7ème » avant « 10ème ») — même tri que les autres listes de classes.
const comparerClasses = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });

// Lauréats d'un classement : les `nombre` premiers RANGS (un ex aequo au
// dernier rang retenu entre aussi — on ne coupe pas deux élèves à égalité),
// à condition d'atteindre le seuil.
const laureatsDe = (classes, nombre, minimum) => classes.filter((e) => e.rang <= nombre && e.moyenne >= minimum);

/**
 * Tableau d'honneur de chaque classe.
 * @returns {Array<{ classe: string, effectif: number, evalues: number, laureats: Array<object> }>}
 *   une entrée par classe, dans l'ordre des niveaux ; `evalues` = élèves
 *   classés (ayant des notes), `effectif` = élèves retenus pour la période.
 */
export function tableauxHonneurParClasse({
  eleves = [], notes = [], matieresForClasse = () => [], periode, periodes = [],
  section = "", maxNote = 20, nombre = NOMBRE_HONNEUR_DEFAUT, seuil = SEUIL_HONNEUR_DEFAUT, classes = [],
}) {
  const periodeNotes = periode === PERIODE_ANNEE ? null : periode;
  const retenus = elevesPourPeriode(eleves, notes, periodeNotes);
  const source = notesAClasser({ eleves: retenus, notes, matieresForClasse, periode, periodes, section });
  const index = indexerNotesParEleve(source, periode);
  const minimum = partDuSeuil(seuil) * maxNote;
  // Toutes les classes connues, même vides (« aucune note » se lit aussi),
  // plus celles qui n'existent que sur des fiches d'élèves.
  const noms = [...new Set([...classes, ...retenus.map((e) => e.classe)].filter(Boolean))]
    .sort(comparerClasses);
  return noms.map((classe) => {
    const groupe = retenus.filter((e) => e.classe === classe);
    const classement = classer(groupe, index, matieresForClasse, section);
    return { classe, effectif: groupe.length, evalues: classement.length, laureats: laureatsDe(classement, nombre, minimum) };
  });
}

/**
 * Palmarès de toute la section (meilleurs élèves toutes classes confondues),
 * mêmes règles que par classe.
 */
export function tableauHonneurSection({
  eleves = [], notes = [], matieresForClasse = () => [], periode, periodes = [],
  section = "", maxNote = 20, nombre = NOMBRE_HONNEUR_DEFAUT, seuil = SEUIL_HONNEUR_DEFAUT,
}) {
  const periodeNotes = periode === PERIODE_ANNEE ? null : periode;
  const retenus = elevesPourPeriode(eleves, notes, periodeNotes);
  const source = notesAClasser({ eleves: retenus, notes, matieresForClasse, periode, periodes, section });
  const index = indexerNotesParEleve(source, periode);
  const classement = classer(retenus, index, matieresForClasse, section);
  return { effectif: retenus.length, evalues: classement.length, laureats: laureatsDe(classement, nombre, partDuSeuil(seuil) * maxNote) };
}
