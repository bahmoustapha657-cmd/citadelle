// ══════════════════════════════════════════════════════════════
//  Aperçu d'un modèle de bulletin (Paramètres → Évaluations)
// ══════════════════════════════════════════════════════════════
// Un élève fictif dans une classe fictive, imprimé avec l'en-tête, les
// couleurs et les signatures de l'école : la Direction voit le rendu du
// modèle avant de le choisir. Aucune donnée réelle n'est lue ni écrite.
import { getPeriodesForSection } from "../../period-utils.js";
import { qrImgHtml } from "../qr.js";
import {
  getEvolutionPeriode, getMoyenneClasseParMatiere, getMoyennesPeriodes, getProfesseursParMatiere,
  getRangEleve, getRangsParMatiere, getStatsClasse,
} from "./bulletin-helpers.js";
import { MODELES_BULLETIN, buildBulletinPageHTML, estModeleComplet, getModeleBulletin } from "./bulletin-page.js";
import { ouvrirFenetreBulletin } from "./bulletin-doc.js";

const MATIERES = [
  ["Français", 4, "M. A. Barry"], ["Mathématiques", 4, "Mme F. Condé"], ["Anglais", 2, "M. I. Touré"],
  ["Physique-Chimie", 2, "M. S. Sylla"], ["Sciences de la Vie et de la Terre", 2, "Mme H. Bangoura"],
  ["Histoire-Géographie", 2, "M. O. Diallo"], ["Éducation civique et morale", 1, "M. O. Diallo"],
  ["Éducation physique et sportive", 1, "M. L. Kaba"],
];
const CLASSE = "7ème année A";
const ELEVE = {
  _id: "apercu-1", nom: "DIALLO", prenom: "Mariama", sexe: "F", classe: CLASSE,
  matricule: "0417", ien: "GN-2025-00417", dateNaissance: "2013-03-12", lieuNaissance: "Conakry",
  filiation: "Fille de Mamadou Diallo et de Kadiatou Bah",
};
// Niveau de chaque élève fictif (sur 20) : l'élève imprimée est 2e.
const NIVEAUX = [14.8, 11, 16.4, 8.6, 12.5, 10.2, 13.6, 9.4];
const APPRECIATION = "Bon travail. Élève sérieuse et appliquée, qui participe volontiers. Elle doit encore consolider le français, notamment l'expression écrite.";

// Notes d'interrogation, de devoir et de composition pour chaque élève,
// matière et période — de quoi remplir toutes les colonnes du bulletin.
function donneesFictives(periodes) {
  const eleves = NIVEAUX.map((_, i) => (i === 0 ? ELEVE : { _id: `apercu-${i + 1}`, nom: "ÉLÈVE", prenom: String(i + 1), classe: CLASSE }));
  const notes = [];
  eleves.forEach((e, i) => MATIERES.forEach(([matiere, , prof], j) => periodes.forEach((periode, p) => {
    const base = NIVEAUX[i] + (((i * 3 + j * 5) % 7) - 3) * 0.5 + p * 0.6;
    [["Interrogation", 0.5], ["Devoir", -1.5], ["Composition", 1]].forEach(([type, ecart]) => {
      const note = Math.max(2, Math.min(19.5, Math.round((base + ecart) * 2) / 2));
      notes.push({ eleveId: e._id, matiere, periode, type, note, enseignantNom: prof });
    });
  })));
  return { eleves, notes };
}

// `win` : fenêtre ouverte sur le clic (avant tout await), sinon bloquée.
export async function apercuBulletin(schoolInfo = {}, win = null) {
  const niveau = "college", maxNote = 20;
  const periodes = getPeriodesForSection(schoolInfo, niveau);
  // La 2e période quand il y en a plusieurs : l'évolution a de quoi s'afficher.
  const periode = periodes[Math.min(1, periodes.length - 1)];
  const { eleves, notes } = donneesFictives(periodes.slice(0, periodes.indexOf(periode) + 1));
  const matieres = MATIERES.map(([nom, coefficient]) => ({ nom, coefficient }));
  const modele = getModeleBulletin(schoolInfo);

  const supplements = estModeleComplet(schoolInfo)
    ? {
        rangsParMatiere: getRangsParMatiere(eleves, notes, matieres, periode, CLASSE, niveau),
        professeurs: getProfesseursParMatiere({ classe: CLASSE, matieres, eleveIds: eleves.map((e) => e._id), notes, periode }),
        moyennesPeriodes: getMoyennesPeriodes(ELEVE, notes, matieres, CLASSE, niveau, periodes),
        assiduite: { absJ: 2, absNJ: 1, retards: 3 },
      }
    : {};
  const page = buildBulletinPageHTML({
    eleve: ELEVE, notes, matieres, periode, niveau, maxNote, schoolInfo,
    rang: getRangEleve(ELEVE, eleves, notes, matieres, periode, CLASSE, niveau),
    classStats: getStatsClasse(eleves, notes, matieres, periode, CLASSE, niveau),
    matiereClasseAvg: Object.fromEntries(matieres.map((m) => [m.nom, getMoyenneClasseParMatiere(eleves, notes, m.nom, periode, CLASSE, niveau)])),
    evolution: getEvolutionPeriode(ELEVE, notes, matieres, CLASSE, niveau, periode, schoolInfo),
    appreciation: APPRECIATION,
    qr: await qrImgHtml("APERCU EDUGEST", { size: modele === "compact" ? 68 : 92 }),
    ...supplements,
  });

  const avis = `<div class="no-print" style="max-width:210mm;margin:8px auto;padding:8px 12px;border-radius:8px;background:#fef3c7;border:1px solid #fbbf24;color:#92400e;font:13px Arial,sans-serif">
    <strong>Aperçu du modèle « ${MODELES_BULLETIN.find((m) => m.id === modele)?.label || modele} »</strong> avec un élève fictif. Vos bulletins reprendront vos vraies notes, vos élèves et vos absences.</div>`;
  ouvrirFenetreBulletin({
    title: "Aperçu du bulletin",
    body: avis + (modele === "compact" ? `<div class="feuille">${page}${page}</div>` : page),
    schoolInfo,
    win,
    imprimer: false,
  });
}
