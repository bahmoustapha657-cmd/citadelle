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

// Clé métier d'un mouvement : ce qu'il désigne, indépendamment du support
// (journal ou fiche élève). Sert à ne pas compter deux fois un paiement
// présent des deux côtés — cf. fusionnerMouvements dans caisse-utils.
export const clePaiement = ({ annee = "", eleveId = "", type = "", mois = "" } = {}) =>
  `${annee}|${eleveId}|${type}|${mois}`;

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

// Contre-passation : même désignation, statut « annule ». Le montant reste
// positif ; c'est le statut qui porte le sens (un montant négatif se prête
// mal aux sommes de contrôle).
export function ecritureAnnulation(params) {
  return { ...ecritureEncaissement(params), statut: "annule" };
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
// depuis les fiches élèves). Une annulation devient une SORTIE : la caisse
// doit voir l'argent ressortir, sinon le solde du jour est faux.
export function mouvementsDepuisJournal(lignes = []) {
  return lignes.map((ligne) => {
    const annule = ligne.statut === "annule";
    const source = ligne.type === "inscription" ? "inscription"
      : ligne.type === "frais" ? "frais" : "scolarite";
    return {
      id: `journal-${ligne._id}`,
      cle: clePaiement(ligne),
      dateBrute: ligne.date,
      sens: annule ? "sortie" : "entree",
      source: annule ? "annulation" : source,
      libelle: ligne.eleveNom || "Élève",
      detail: [
        annule ? `Annulation — ${ligne.libelle}` : ligne.libelle,
        ligne.classe,
      ].filter(Boolean).join(" · "),
      montant: Number(ligne.montant) || 0,
      auteur: ligne.auteur || "",
    };
  });
}
