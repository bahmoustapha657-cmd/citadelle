// Encaissement / retrait d'un frais ponctuel sur la fiche élève : inscription,
// « Autre frais », révision et frais du catalogue. Logique pure — payment-
// actions l'applique, les tests la vérifient.
//
// Le MONTANT est figé au paiement (inscriptionMontant, fraisMontants[id]),
// comme les mensualités depuis la v2 : un tarif modifié ensuite ne réécrit
// plus ce qui a été encaissé. Et un retrait contre-passe au journal ce qui a
// réellement été encaissé, pas le tarif du jour.
//
// Un clic « payé » SOLDE le poste : s'il porte déjà un acompte (versement en
// plusieurs fois, cf. paiements-scolarite), seul le reste s'encaisse et le
// montant figé est le total versé.
import { acompteFrais, acompteInscription } from "../../mensualite-utils.js";

// `poste` : "inscription" ou l'id d'un frais du catalogue (autre, revision…).
// `montant` : ce que le poste coûte en tout (dû net de dispense) ; au retrait,
// le montant affiché, repli si rien n'avait été figé.
// Renvoie les champs à écrire sur la fiche, le montant de l'écriture au
// journal des paiements et l'acompte qui était déjà versé.
export function champsBasculeFrais({ eleve = {}, poste, valeurActuelle = false, montant = 0, date = "" }) {
  if (poste === "inscription") {
    if (valeurActuelle) {
      const fige = Number(eleve.inscriptionMontant);
      return {
        champs: { inscriptionPayee: false, inscriptionDate: null, inscriptionMontant: null, inscriptionAcompte: null },
        montantJournal: fige > 0 ? fige : montant,
        acompte: 0,
      };
    }
    const acompte = acompteInscription(eleve);
    const total = Math.max(Number(montant) || 0, acompte);
    return {
      champs: { inscriptionPayee: true, inscriptionDate: date, inscriptionMontant: total, inscriptionAcompte: null },
      montantJournal: total - acompte,
      acompte,
    };
  }

  const fraisPayes = { ...(eleve.fraisPayes || {}) };
  const fraisMontants = { ...(eleve.fraisMontants || {}) };
  const fraisAcomptes = { ...(eleve.fraisAcomptes || {}) };
  if (valeurActuelle) {
    const fige = Number(fraisMontants[poste]);
    delete fraisPayes[poste];
    delete fraisMontants[poste];
    delete fraisAcomptes[poste];
    return {
      // « Autre frais » payé avec les anciens drapeaux : on les éteint aussi,
      // sinon le frais resterait payé à la relecture.
      champs: {
        fraisPayes, fraisMontants, fraisAcomptes,
        ...(poste === "autre" ? { autrePayee: false, autreDate: null } : {}),
      },
      montantJournal: fige > 0 ? fige : montant,
      acompte: 0,
    };
  }
  const acompte = acompteFrais(eleve, poste);
  const total = Math.max(Number(montant) || 0, acompte);
  delete fraisAcomptes[poste];
  fraisPayes[poste] = date;
  fraisMontants[poste] = total;
  return { champs: { fraisPayes, fraisMontants, fraisAcomptes }, montantJournal: total - acompte, acompte };
}
