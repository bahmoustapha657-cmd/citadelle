// GÉNÉRÉ par scripts/partager-edge.mjs depuis src/components/comptabilite/paiements-journal.js — ne pas modifier ici.
// ══════════════════════════════════════════════════════════════════════════
//  Journal des encaissements de scolarité — écritures et lecture
// ══════════════════════════════════════════════════════════════════════════
// Les champs de la fiche élève (mens, mensDates, fraisPayes…) sont un ÉTAT :
// ils disent ce qui est payé AUJOURD'HUI. Ils sont écrasés au décochage et
// remis à zéro à la clôture d'année. Le journal, lui, garde chaque mouvement.
//
// AJOUT SEUL : une annulation ajoute une ligne `statut: "annule"`, elle n'en
// supprime jamais (règles Firestore et RLS Supabase l'imposent aussi).
//
// Logique pure : aucune dépendance React ni backend.

export const TYPES_PAIEMENT = {
  mensualite: "Mensualité",
  inscription: "Inscription",
  frais: "Frais annexe",
};

// Date du jour au format ISO court — trié naturellement, lu par
// parseDateSouple comme le format français des anciens champs.
export const dateDuJour = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// « Autre frais » a d'abord été journalisé sous "autrePayee" (le nom de son
// drapeau sur la fiche) alors que la fiche le désigne par "autre" : les deux
// clés ne se reconnaissaient pas et la caisse le comptait DEUX fois.
const moisCanonique = (type, mois) => (type === "frais" && mois === "autrePayee" ? "autre" : mois);

// Clé métier d'un mouvement : ce qu'il désigne, indépendamment du support
// (journal ou fiche élève). Sert à ne pas compter deux fois un paiement
// présent des deux côtés — cf. collecterMouvements dans caisse-utils.
export const clePaiement = ({ annee = "", eleveId = "", type = "", mois = "" } = {}) =>
  `${annee}|${eleveId}|${type}|${moisCanonique(type, mois)}`;

// Écriture d'encaissement. `mois` porte le mois pour une mensualité, l'id du
// frais pour un frais annexe, "inscription" pour l'inscription.
export function ecritureEncaissement({
  annee, eleve = {}, type, mois = "", libelle = "", montant = 0, auteur = "", date = null,
}) {
  return {
    annee,
    type,
    statut: "encaisse",
    eleveId: eleve._id || "",
    eleveNom: `${eleve.nom || ""} ${eleve.prenom || ""}`.trim(),
    classe: eleve.classe || "",
    mois,
    libelle: libelle || TYPES_PAIEMENT[type] || type,
    montant: Number(montant) || 0,
    date: date || dateDuJour(),
    auteur: auteur || "",
  };
}

// Motif d'une annulation, choisi au décochage :
//   • erreur_saisie : la case a été cochée par erreur, AUCUN argent n'est
//     entré — la caisse neutralise l'encaissement et sa correction (ni
//     entrée ni sortie), la trace reste au journal ;
//   • remboursement : l'argent a réellement été rendu — c'est une sortie.
// Une annulation sans motif (antérieure à ce choix) reste une sortie.
export const MOTIFS_ANNULATION = {
  erreur_saisie: "Erreur de saisie",
  remboursement: "Remboursement",
};

// Contre-passation : même désignation, statut « annule ». Le montant reste
// positif ; c'est le statut qui porte le sens (un montant négatif se prête
// mal aux sommes de contrôle). `motif` et `explication` partent dans la
// colonne extra du journal.
export function ecritureAnnulation({ motif = "", explication = "", ...params }) {
  return {
    ...ecritureEncaissement(params),
    statut: "annule",
    ...(motif ? { motif } : {}),
    ...(explication ? { explication: String(explication).trim() } : {}),
  };
}

// Paires « encaissement + correction d'erreur de saisie » : chaque annulation
// motivée « erreur_saisie » neutralise les encaissements les plus récents de
// la même clé (même élève, même mois ou frais), antérieurs à elle et pas déjà
// neutralisés, dont la somme égale son montant — un mois payé en une fois,
// ou un acompte puis son solde. Renvoie l'ensemble des _id neutralisés
// (encaissements et corrections). Une correction sans contrepartie exacte
// (paiement d'avant le journal, montants divergents) n'est pas appariée.
export function lignesNeutralisees(lignes = []) {
  const neutres = new Set();
  const ordre = (l) => l.createdAt || 0;
  const corrections = lignes
    .filter((l) => l.statut === "annule" && l.motif === "erreur_saisie")
    .sort((a, b) => ordre(a) - ordre(b));
  for (const corr of corrections) {
    const cle = clePaiement(corr);
    const candidats = lignes
      .filter((l) => l.statut !== "annule" && !neutres.has(l._id) && clePaiement(l) === cle
        && (!corr.createdAt || !l.createdAt || l.createdAt <= corr.createdAt))
      .sort((a, b) => ordre(b) - ordre(a));
    const cible = Number(corr.montant) || 0;
    const pris = [];
    let somme = 0;
    for (const l of candidats) {
      if (somme >= cible) break;
      pris.push(l);
      somme += Number(l.montant) || 0;
    }
    if (cible > 0 && somme === cible) {
      neutres.add(corr._id);
      pris.forEach((l) => neutres.add(l._id));
    }
  }
  return neutres;
}

// Solde d'un mouvement au journal : +1 encaissement, −1 annulation.
const signe = (ligne) => (ligne.statut === "annule" ? -1 : 1);

// État NET du journal par clé métier : une clé dont les annulations
// compensent les encaissements n'est plus considérée comme payée.
// Renvoie une Map clé → { net, dernier } (dernier = ligne la plus récente).
export function etatNetParCle(lignes = []) {
  const parCle = new Map();
  for (const ligne of lignes) {
    const cle = clePaiement(ligne);
    const acc = parCle.get(cle) || { net: 0, dernier: null };
    acc.net += signe(ligne);
    if (!acc.dernier || (ligne.createdAt || 0) >= (acc.dernier.createdAt || 0)) acc.dernier = ligne;
    parCle.set(cle, acc);
  }
  return parCle;
}

// Lignes du journal → mouvements de caisse (même forme que ceux reconstitués
// depuis les fiches élèves). Une annulation (remboursement, ou ancienne
// annulation sans motif) devient une SORTIE : la caisse doit voir l'argent
// ressortir. Une erreur de saisie corrigée n'est NI une entrée NI une
// sortie : l'encaissement et sa correction restent visibles, en sens
// « neutre », hors des totaux. Sans contrepartie au journal, la correction
// retire son montant des entrées (l'argent n'est jamais entré).
export function mouvementsDepuisJournal(lignes = []) {
  const neutres = lignesNeutralisees(lignes);
  return lignes.map((ligne) => {
    const annule = ligne.statut === "annule";
    const erreur = annule && ligne.motif === "erreur_saisie";
    const neutre = neutres.has(ligne._id);
    const montant = Number(ligne.montant) || 0;
    const source = ligne.type === "inscription" ? "inscription"
      : ligne.type === "frais" ? "frais" : "scolarite";
    const explication = ligne.explication ? `« ${ligne.explication} »` : "";
    const libelleDetail = !annule
      ? (neutre ? `${ligne.libelle} — annulé (erreur de saisie)` : ligne.libelle)
      : erreur ? `Correction — ${ligne.libelle}`
        : `${ligne.motif === "remboursement" ? "Remboursement" : "Annulation"} — ${ligne.libelle}`;
    return {
      id: `journal-${ligne._id}`,
      cle: clePaiement(ligne),
      dateBrute: ligne.date,
      sens: neutre ? "neutre" : erreur ? "entree" : annule ? "sortie" : "entree",
      source: neutre || erreur ? "correction" : annule ? "annulation" : source,
      libelle: ligne.eleveNom || "Élève",
      detail: [libelleDetail, annule ? explication : "", ligne.classe].filter(Boolean).join(" · "),
      montant: erreur && !neutre ? -montant : montant,
      auteur: ligne.auteur || "",
    };
  });
}
