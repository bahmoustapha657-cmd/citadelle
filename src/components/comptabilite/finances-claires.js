// Synthèse financière « lisible » : une seule définition de l'argent entré,
// de l'argent sorti et du solde, partagée par le Bilan et le Tableau de bord.
// Logique pure — aucune dépendance React.
//
// Pourquoi : l'ancien Bilan (et la tuile « Solde tréso. ») faisait
// « recettes saisies à la main − dépenses ». La scolarité encaissée sur les
// fiches élèves — l'essentiel de l'argent d'une école — n'y entrait jamais,
// et les versements (argent SORTI vers la banque ou la Fondation) étaient
// posés à côté des recettes. Ici, chaque ligne dit ce qu'elle contient.
//
// Source : l'état des fiches élèves (getMensualiteOverview), net des
// annulations — un mois remboursé n'est plus « Payé ». Les paiements sans
// date y comptent, alors que la Caisse, journal daté, les ignore.

import i18n from "../../i18n";

// Libellés en accesseurs : lus au rendu, ils suivent la langue choisie même
// quand la synthèse est mémorisée (tableau de bord).
const ligne = (id, cle, montant, aide) => {
  const l = { id, montant, get label() { return i18n.t(`accounting.fin.${cle}`); } };
  if (aide) Object.defineProperty(l, "aide", { get: aide, enumerable: true });
  return l;
};

// Écoles qui gardent l'affichage financier d'origine, à leur demande.
// Clé = schoolId (code école).
const ECOLES_AFFICHAGE_CLASSIQUE = new Set(["citadelle"]);

export const affichageFinancesClassique = (schoolId) => ECOLES_AFFICHAGE_CLASSIQUE.has(schoolId);

const somme = (lignes) => lignes.reduce((s, l) => s + l.montant, 0);
const total = (docs = []) => docs.reduce((s, d) => s + (Number(d.montant) || 0), 0);

export function syntheseFinances({ overview = {}, recettes = [], depenses = [], versements = [] }) {
  const o = {
    totalDu: 0, totalPercu: 0, totalInscriptionsPercues: 0, totalAutresPercus: 0,
    totalResteInscriptions: 0, totalResteAutres: 0, totalExonere: 0, totalElevesExoneres: 0,
    totalPayes: 0, totalImpayes: 0, totalPartiels: 0,
    ...overview,
  };

  const entrees = [
    ligne("scolarite", "in.scolarite", o.totalPercu, () => i18n.t("accounting.fin.in.scolariteHint")),
    ligne("inscription", "in.inscription", o.totalInscriptionsPercues, () => i18n.t("accounting.fin.in.inscriptionHint")),
    ligne("frais", "in.frais", o.totalAutresPercus, () => i18n.t("accounting.fin.in.fraisHint")),
    ligne("recette", "in.recette", total(recettes), () => i18n.t("accounting.fin.in.recetteHint", { count: recettes.length })),
  ];
  const sorties = [
    ligne("depense", "out.depense", total(depenses), () => i18n.t("accounting.fin.out.depenseHint", { count: depenses.length })),
    ligne("versement", "out.versement", total(versements), () => i18n.t("accounting.fin.out.versementHint", { count: versements.length })),
  ];
  const totalEntrees = somme(entrees);
  const totalSorties = somme(sorties);

  // Reste à encaisser : tout ce que les élèves doivent encore, dispenses
  // déduites. « Attendu » = encaissé + reste, sur le même périmètre.
  const resteMensualites = Math.max(0, o.totalDu - o.totalPercu);
  const reste = resteMensualites + o.totalResteInscriptions + o.totalResteAutres;
  const encaisseScolarite = o.totalPercu + o.totalInscriptionsPercues + o.totalAutresPercus;
  const attendu = encaisseScolarite + reste;

  return {
    entrees, sorties, totalEntrees, totalSorties,
    solde: totalEntrees - totalSorties,
    recouvrement: {
      attendu,
      encaisse: encaisseScolarite,
      reste,
      taux: attendu > 0 ? (encaisseScolarite / attendu) * 100 : 0,
      detailReste: [
        ligne("scolarite", "rest.scolarite", resteMensualites),
        ligne("inscription", "rest.inscription", o.totalResteInscriptions),
        ligne("frais", "rest.frais", o.totalResteAutres),
      ],
      moisPayes: o.totalPayes,
      moisImpayes: o.totalImpayes,
      moisEntames: o.totalPartiels,
      exonere: o.totalExonere,
      elevesExoneres: o.totalElevesExoneres,
    },
  };
}

// Graduation d'axe lisible : « 1,2 M », « 350 k » plutôt que « 0.4M ».
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
export const montantAxe = (v) => compact.format(Number(v) || 0);
