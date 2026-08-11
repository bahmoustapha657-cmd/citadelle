// Journal de caisse : collecte de TOUS les mouvements datés du module
// Comptabilité, puis filtrage sur une journée, une semaine ou un mois.
// Logique pure — aucune dépendance React.
//
// Pourquoi un module dédié : les mouvements ne vivent pas au même endroit.
// Les recettes/dépenses/versements sont des documents à part entière, alors
// que la scolarité (mensualités, inscriptions, frais annexes) est encaissée
// SUR la fiche élève, avec des dates au format français. Ce fichier ramène
// tout ça à une seule liste normalisée.

import {
  CATALOGUE_FRAIS_ANNEXES,
  getFraisAnnexeLabel,
  getTarifFraisDivers,
} from "../../../constants";
import {
  getTarifAutreForClasse,
  getTarifConfigForClasse,
  getTarifInscriptionForEleve,
  getTarifMensuelForClasse,
  montantMoisPaye,
} from "../../../mensualite-utils";

export const PERIODES_CAISSE = [
  { id: "jour", label: "Journée" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
];

// ── Dates ───────────────────────────────────────────────────────────────────
// Deux formats coexistent en base : "AAAA-MM-JJ" pour les champs saisis dans
// un <input type="date"> (recettes, dépenses, versements) et "JJ/MM/AAAA" pour
// les paiements de scolarité (new Date().toLocaleDateString("fr-FR")).
export function parseDateSouple(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : dateSeule(valeur);
  const texte = String(valeur).trim();
  const iso = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return construire(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const fr = texte.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) return construire(Number(fr[3]), Number(fr[2]), Number(fr[1]));
  return null;
}

function construire(annee, mois, jour) {
  const d = new Date(annee, mois - 1, jour);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Minuit local : toutes les comparaisons se font à la journée près.
export const dateSeule = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const cleJour = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatJour = (d) => d.toLocaleDateString("fr-FR");

// Lundi de la semaine contenant `d` (semaine ISO : lundi → dimanche).
export function debutSemaine(d) {
  const base = dateSeule(d);
  const decalage = (base.getDay() + 6) % 7; // dimanche (0) → 6
  base.setDate(base.getDate() - decalage);
  return base;
}

// Bornes [debut, fin] incluses de la période demandée autour de `date`.
export function bornesPeriode(date, periode) {
  const base = dateSeule(date);
  if (periode === "semaine") {
    const debut = debutSemaine(base);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 6);
    return { debut, fin };
  }
  if (periode === "mois") {
    return {
      debut: new Date(base.getFullYear(), base.getMonth(), 1),
      fin: new Date(base.getFullYear(), base.getMonth() + 1, 0),
    };
  }
  return { debut: base, fin: base };
}

// Décale la date de référence d'une période entière (navigation ← →).
export function decalerPeriode(date, periode, sens) {
  const base = dateSeule(date);
  if (periode === "semaine") base.setDate(base.getDate() + 7 * sens);
  else if (periode === "mois") base.setMonth(base.getMonth() + sens);
  else base.setDate(base.getDate() + sens);
  return base;
}

export function libellePeriode(date, periode) {
  const { debut, fin } = bornesPeriode(date, periode);
  if (periode === "jour") {
    return debut.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (periode === "mois") {
    const texte = debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }
  const memeMois = debut.getMonth() === fin.getMonth();
  const debutTexte = debut.toLocaleDateString("fr-FR", memeMois ? { day: "numeric" } : { day: "numeric", month: "short" });
  const finTexte = fin.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `Semaine du ${debutTexte} au ${finTexte}`;
}

// ── Collecte des mouvements ─────────────────────────────────────────────────
// Un mouvement : { id, date, sens: "entree"|"sortie", source, libelle,
//                  detail, montant }.
// `source` sert au regroupement par nature (voir SOURCES).
export const SOURCES = {
  scolarite: { label: "Scolarité (mensualités)", sens: "entree", couleur: "#00C48C" },
  inscription: { label: "Inscriptions", sens: "entree", couleur: "#0ea5e9" },
  frais: { label: "Frais annexes", sens: "entree", couleur: "#8b5cf6" },
  recette: { label: "Recettes diverses", sens: "entree", couleur: "#22c55e" },
  don: { label: "Dons & versements", sens: "entree", couleur: "#14b8a6" },
  depense: { label: "Dépenses", sens: "sortie", couleur: "#ef4444" },
};

// Mouvements portés par les documents comptables (date déjà au format ISO).
function mouvementsDocuments({ recettes = [], depenses = [], versements = [] }) {
  const lignes = [];
  for (const r of recettes) {
    const date = parseDateSouple(r.date);
    if (!date) continue;
    lignes.push({
      id: `recette-${r._id}`, date, sens: "entree", source: "recette",
      libelle: r.libelle || "Recette", detail: r.categorie || "", montant: Number(r.montant) || 0,
    });
  }
  for (const d of depenses) {
    const date = parseDateSouple(d.date);
    if (!date) continue;
    lignes.push({
      id: `depense-${d._id}`, date, sens: "sortie", source: "depense",
      libelle: d.libelle || "Dépense", detail: d.categorie || "", montant: Number(d.montant) || 0,
    });
  }
  for (const v of versements) {
    const date = parseDateSouple(v.date);
    if (!date) continue;
    lignes.push({
      id: `versement-${v._id}`, date, sens: "entree", source: "don",
      libelle: v.libelle || "Versement", detail: v.description || "", montant: Number(v.montant) || 0,
    });
  }
  return lignes;
}

// Mouvements encaissés sur la fiche élève : mensualités, inscription et frais
// annexes. Le montant d'une mensualité est celui FIGÉ au paiement quand il
// existe (mensMontants), sinon le tarif courant de la classe.
function mouvementsEleves({ eleves = [], moisAnnee = [], tarifsClasses = [] }) {
  const lignes = [];
  for (const eleve of eleves) {
    const nom = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim() || "Élève";
    const classe = eleve.classe || "";
    const mens = eleve.mens || {};
    const mensDates = eleve.mensDates || {};
    const tarifMensuel = getTarifMensuelForClasse(tarifsClasses, classe);

    for (const mois of moisAnnee) {
      if (mens[mois] !== "Payé") continue;
      const date = parseDateSouple(mensDates[mois]);
      if (!date) continue; // paiement sans date : invisible dans un journal daté
      lignes.push({
        id: `mens-${eleve._id}-${mois}`, date, sens: "entree", source: "scolarite",
        libelle: nom, detail: `${mois}${classe ? ` · ${classe}` : ""}`,
        montant: montantMoisPaye(eleve, mois, tarifMensuel),
      });
    }

    if (eleve.inscriptionPayee) {
      const date = parseDateSouple(eleve.inscriptionDate);
      if (date) {
        lignes.push({
          id: `insc-${eleve._id}`, date, sens: "entree", source: "inscription",
          libelle: nom, detail: `Inscription${classe ? ` · ${classe}` : ""}`,
          montant: getTarifInscriptionForEleve(eleve, tarifsClasses),
        });
      }
    }

    const fraisDivers = getTarifFraisDivers(getTarifConfigForClasse(tarifsClasses, classe) || {});
    const fraisPayes = eleve.fraisPayes || {};
    for (const frais of CATALOGUE_FRAIS_ANNEXES) {
      // « Autre frais » garde ses drapeaux dédiés (autrePayee / autreDate).
      const brut = frais.id === "autre"
        ? (eleve.autrePayee ? eleve.autreDate : null)
        : fraisPayes[frais.id];
      const date = parseDateSouple(brut);
      if (!date) continue;
      lignes.push({
        id: `frais-${eleve._id}-${frais.id}`, date, sens: "entree", source: "frais",
        libelle: nom, detail: `${getFraisAnnexeLabel(frais.id)}${classe ? ` · ${classe}` : ""}`,
        montant: frais.id === "autre"
          ? getTarifAutreForClasse(tarifsClasses, classe)
          : Number(fraisDivers[frais.id] || 0),
      });
    }
  }
  return lignes;
}

// Tous les mouvements datés, du plus récent au plus ancien.
export function collecterMouvements(sources) {
  return [...mouvementsDocuments(sources), ...mouvementsEleves(sources)]
    .sort((a, b) => b.date - a.date || a.libelle.localeCompare(b.libelle));
}

export function filtrerPeriode(mouvements, date, periode) {
  const { debut, fin } = bornesPeriode(date, periode);
  return mouvements.filter((m) => m.date >= debut && m.date <= fin);
}

// Totaux d'une liste de mouvements : entrées, sorties, solde et détail par
// nature (pour le tableau de répartition).
export function totauxMouvements(mouvements = []) {
  const parSource = {};
  let entrees = 0;
  let sorties = 0;
  for (const m of mouvements) {
    const montant = Number(m.montant) || 0;
    if (m.sens === "sortie") sorties += montant; else entrees += montant;
    const acc = parSource[m.source] || (parSource[m.source] = { montant: 0, nb: 0 });
    acc.montant += montant;
    acc.nb += 1;
  }
  return { entrees, sorties, solde: entrees - sorties, nb: mouvements.length, parSource };
}

// Série journalière de la période — alimente le graphique et la lecture
// « quel jour a-t-on encaissé quoi ». Les jours sans mouvement sont conservés
// (une caisse vide est une information).
export function serieParJour(mouvements, date, periode) {
  const { debut, fin } = bornesPeriode(date, periode);
  const jours = [];
  for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
    jours.push({ cle: cleJour(d), date: new Date(d), entrees: 0, sorties: 0 });
  }
  const index = new Map(jours.map((j) => [j.cle, j]));
  for (const m of mouvements) {
    const jour = index.get(cleJour(m.date));
    if (!jour) continue;
    const montant = Number(m.montant) || 0;
    if (m.sens === "sortie") jour.sorties += montant; else jour.entrees += montant;
  }
  return jours;
}
