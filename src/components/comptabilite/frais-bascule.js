// Encaissement / retrait d'un frais ponctuel sur la fiche élève : inscription,
// « Autre frais », révision et frais du catalogue. Logique pure — payment-
// actions l'applique, les tests la vérifient.
//
// Le MONTANT est figé au paiement (inscriptionMontant, fraisMontants[id]),
// comme les mensualités depuis la v2 : un tarif modifié ensuite ne réécrit
// plus ce qui a été encaissé. Et un retrait contre-passe au journal ce qui a
// réellement été encaissé, pas le tarif du jour.

// `poste` : "inscription" ou l'id d'un frais du catalogue (autre, revision…).
// Renvoie les champs à écrire sur la fiche et le montant de l'écriture au
// journal des paiements.
export function champsBasculeFrais({ eleve = {}, poste, valeurActuelle = false, montant = 0, date = "" }) {
  if (poste === "inscription") {
    if (valeurActuelle) {
      const fige = Number(eleve.inscriptionMontant);
      return {
        champs: { inscriptionPayee: false, inscriptionDate: null, inscriptionMontant: null },
        montantJournal: fige > 0 ? fige : montant,
      };
    }
    return {
      champs: { inscriptionPayee: true, inscriptionDate: date, inscriptionMontant: montant },
      montantJournal: montant,
    };
  }

  const fraisPayes = { ...(eleve.fraisPayes || {}) };
  const fraisMontants = { ...(eleve.fraisMontants || {}) };
  if (valeurActuelle) {
    const fige = Number(fraisMontants[poste]);
    delete fraisPayes[poste];
    delete fraisMontants[poste];
    return {
      // « Autre frais » payé avec les anciens drapeaux : on les éteint aussi,
      // sinon le frais resterait payé à la relecture.
      champs: { fraisPayes, fraisMontants, ...(poste === "autre" ? { autrePayee: false, autreDate: null } : {}) },
      montantJournal: fige > 0 ? fige : montant,
    };
  }
  fraisPayes[poste] = date;
  fraisMontants[poste] = montant;
  return { champs: { fraisPayes, fraisMontants }, montantJournal: montant };
}
