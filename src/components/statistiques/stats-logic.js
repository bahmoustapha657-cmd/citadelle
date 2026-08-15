// ══════════════════════════════════════════════════════════════════════════
//  Statistiques avancées — calculs purs
// ══════════════════════════════════════════════════════════════════════════
// Aucune dépendance réseau ni React : prend les collections déjà chargées et
// produit les jeux de données des écrans. Les analyses de RÉSULTATS réutilisent
// apercu-tab/analytics.js — une seule définition de la moyenne dans l'app,
// donc pas de risque qu'un tableau de bord contredise un bulletin.

import { CATALOGUE_FRAIS_ANNEXES, getFraisAnnexeLabel, aReinscrire, estReinscrit } from "../../constants";
import { getEleveSolde, getMensualiteOverview, getTarifMensuelForClasse } from "../../mensualite-utils";
import { notesDeLEleve } from "../../note-index";

const parCle = (liste, cle) => liste.reduce((acc, item) => {
  const k = cle(item) || "—";
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const enTableau = (objet, nomCle = "cle") => Object.entries(objet)
  .map(([k, valeur]) => ({ [nomCle]: k, valeur }))
  .sort((a, b) => b.valeur - a.valeur);

// ── ASSIDUITÉ ───────────────────────────────────────────────────────────────
// La table des absences peut être vide : le module Discipline n'est pas
// toujours utilisé. Les écrans doivent alors le DIRE plutôt que d'afficher
// des graphiques à zéro, d'où `vide` renvoyé explicitement.
export function statsAssiduite(absences = [], eleves = []) {
  const total = absences.length;
  const justifiees = absences.filter((a) => a.justifie === "Oui" || a.justifie === true).length;
  const parType = enTableau(parCle(absences, (a) => a.type), "type");
  const parClasse = enTableau(parCle(absences, (a) => a.classe), "classe");
  const parMotif = enTableau(parCle(absences.filter((a) => a.motif), (a) => a.motif), "motif");

  // Élèves les plus absents : c'est le signal d'alerte que cherche un
  // surveillant, bien plus que le total de l'école.
  const parEleve = new Map();
  for (const a of absences) {
    const id = a.eleveId || a.eleveNom;
    if (!id) continue;
    const e = parEleve.get(id) || { nom: a.eleveNom || "—", classe: a.classe || "—", total: 0, nonJustifiees: 0 };
    e.total += 1;
    if (!(a.justifie === "Oui" || a.justifie === true)) e.nonJustifiees += 1;
    parEleve.set(id, e);
  }
  const alerte = [...parEleve.values()].sort((a, b) => b.total - a.total).slice(0, 10);

  return {
    vide: total === 0,
    total,
    justifiees,
    tauxJustifie: total ? (justifiees / total) * 100 : 0,
    moyenneParEleve: eleves.length ? total / eleves.length : 0,
    parType,
    parClasse,
    parMotif,
    alerte,
  };
}

// ── FINANCES ────────────────────────────────────────────────────────────────
// La matière vit sur les FICHES élèves (mensualités, inscription, frais) et
// dans le journal des paiements — pas dans les grands livres, quasi vides
// dans les écoles observées.
export function statsFinances(eleves = [], moisAnnee = [], tarifsClasses = [], paiements = []) {
  const actifs = eleves.filter((e) => (e.statut || "Actif") === "Actif");
  // getMensualiteOverview est le calcul de référence de la Comptabilité : on
  // le réutilise tel quel, par classe puis globalement, pour que les chiffres
  // des statistiques ne puissent pas contredire ceux de la Compta.
  const global = getMensualiteOverview(actifs, moisAnnee, tarifsClasses);
  const du = global.totalDu;
  const percu = global.totalPercu;

  const parClasse = new Map();
  for (const e of actifs) {
    const cle = e.classe || "—";
    if (!parClasse.has(cle)) parClasse.set(cle, []);
    parClasse.get(cle).push(e);
  }

  const classes = [...parClasse.entries()]
    .map(([classe, liste]) => {
      const o = getMensualiteOverview(liste, moisAnnee, tarifsClasses);
      const aJour = liste.filter((e) => getEleveSolde(e, moisAnnee, tarifsClasses) <= 0).length;
      return {
        classe,
        eleves: liste.length,
        aJour,
        du: o.totalDu,
        percu: o.totalPercu,
        impaye: Math.max(0, o.totalDu - o.totalPercu),
        taux: o.totalDu ? (o.totalPercu / o.totalDu) * 100 : 0,
      };
    })
    .sort((a, b) => a.taux - b.taux); // les classes en difficulté d'abord

  // Encaissements par mois : le journal fait foi quand il existe, sinon on
  // retombe sur les dates portées par les fiches (paiements antérieurs).
  const parMois = {};
  for (const p of paiements) {
    if (p.statut === "annule") continue;
    const m = String(p.date || "").slice(0, 7); // AAAA-MM
    if (!m) continue;
    parMois[m] = (parMois[m] || 0) + (Number(p.montant) || 0);
  }

  // Frais annexes réellement encaissés, par type.
  const frais = CATALOGUE_FRAIS_ANNEXES.map((f) => ({
    frais: getFraisAnnexeLabel(f.id),
    eleves: eleves.filter((e) => (f.id === "autre" ? e.autrePayee : (e.fraisPayes || {})[f.id])).length,
  })).filter((x) => x.eleves > 0).sort((a, b) => b.eleves - a.eleves);

  return {
    du,
    percu,
    impaye: Math.max(0, du - percu),
    taux: du ? (percu / du) * 100 : 0,
    classes,
    parMois: Object.entries(parMois).sort(([a], [b]) => a.localeCompare(b)).map(([mois, montant]) => ({ mois, montant })),
    frais,
    tarifMoyen: actifs.length
      ? actifs.reduce((s, e) => s + getTarifMensuelForClasse(tarifsClasses, e.classe), 0) / actifs.length
      : 0,
  };
}

// ── EFFECTIFS ET PARCOURS ───────────────────────────────────────────────────
export function statsEffectifs(eleves = []) {
  const actifs = eleves.filter((e) => (e.statut || "Actif") === "Actif");
  const partis = eleves.filter((e) => e.statut && e.statut !== "Actif");
  const sexe = { F: actifs.filter((e) => String(e.sexe || "").toUpperCase().startsWith("F")).length, M: 0 };
  sexe.M = actifs.length - sexe.F;

  return {
    total: eleves.length,
    actifs: actifs.length,
    partis: partis.length,
    sexe,
    parClasse: enTableau(parCle(actifs, (e) => e.classe), "classe")
      .sort((a, b) => String(a.classe).localeCompare(String(b.classe), "fr", { numeric: true })),
    parStatut: enTableau(parCle(partis, (e) => e.statut), "statut"),
    parMotifDepart: enTableau(parCle(partis.filter((e) => e.motifDepart), (e) => e.motifDepart), "motif"),
    reinscrits: actifs.filter(estReinscrit).length,
    aReinscrire: actifs.filter(aReinscrire).length,
    // Un élève ayant au moins une année archivée est un ancien : c'est la
    // mesure la plus fiable de la fidélisation dont on dispose.
    anciens: actifs.filter((e) => Object.keys(e.historique || {}).length > 0).length,
  };
}

// ── ENSEIGNANTS ─────────────────────────────────────────────────────────────
// Croise trois sources : la fiche enseignant, les créneaux d'emploi du temps
// (charge horaire réelle) et les notes saisies (activité pédagogique).
export function statsEnseignants(enseignants = [], emplois = [], notes = []) {
  const heures = (creneau) => {
    const [h1, m1] = String(creneau.heureDebut || "").split(":").map(Number);
    const [h2, m2] = String(creneau.heureFin || "").split(":").map(Number);
    if (![h1, m1, h2, m2].every(Number.isFinite)) return 0;
    return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
  };

  const notesParEnseignant = notes.reduce((acc, n) => {
    const nom = (n.enseignantNom || "").trim();
    if (nom) acc[nom] = (acc[nom] || 0) + 1;
    return acc;
  }, {});

  const lignes = enseignants.map((ens) => {
    const nomComplet = `${ens.prenom || ""} ${ens.nom || ""}`.trim();
    const siens = emplois.filter((c) => String(c.enseignant || "").includes(ens.nom || " "));
    return {
      nom: nomComplet || ens.nom || "—",
      matiere: ens.matiere || "—",
      creneaux: siens.length,
      heures: Math.round(siens.reduce((s, c) => s + heures(c), 0) * 10) / 10,
      classes: [...new Set(siens.map((c) => c.classe).filter(Boolean))].length,
      notesSaisies: notesParEnseignant[nomComplet] || 0,
    };
  }).sort((a, b) => b.heures - a.heures);

  return {
    total: enseignants.length,
    heuresTotal: Math.round(lignes.reduce((s, l) => s + l.heures, 0) * 10) / 10,
    creneauxTotal: emplois.length,
    sansCreneau: lignes.filter((l) => l.creneaux === 0).length,
    lignes,
  };
}

// ── RÉSULTATS : distribution des mentions ───────────────────────────────────
// Complète analytics.js, qui donne déjà moyennes et taux de réussite.
export function distributionMentions(eleves = [], notes = [], matieresForClasse, periode, mentionDe) {
  const dist = { "Très Bien": 0, Bien: 0, "Assez Bien": 0, Passable: 0, Insuffisant: 0 };
  let evalues = 0;
  for (const e of eleves) {
    const notesE = notesDeLEleve(notes, e._id, periode);
    if (!notesE.length) continue;
    const moy = mentionDe(e, notesE);
    if (moy == null) continue;
    evalues += 1;
    if (dist[moy] !== undefined) dist[moy] += 1;
  }
  return { evalues, dist: Object.entries(dist).map(([mention, valeur]) => ({ mention, valeur })) };
}
