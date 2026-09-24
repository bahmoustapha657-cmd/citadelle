// ══════════════════════════════════════════════════════════════
//  Reçus de paiement — getRecuTotals + imprimerRecu
// ══════════════════════════════════════════════════════════════
// Deux formats, mêmes données et même QR de vérification :
//   • A4 : 2 exemplaires (comptable + payant) sur une page — imprimerRecu.
//   • ticket 58/80 mm pour imprimante thermique — imprimerRecuTicket.
// Les fragments HTML vivent dans recus/recu-blocs.js (A4) et
// recus/recu-ticket.js (thermique), le style A4 dans recus/recus-styles.js.

import { MOIS_ANNEE } from "../constants.js";
import { getFraisAnnexesEleve, montantInscriptionPaye, montantMoisPaye } from "../mensualite-utils.js";
import { resolveLegalFields } from "../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML, printDir, printLang, tr } from "./print-helpers.js";
import { blocRecu } from "./recus/recu-blocs.js";
import { RECU_STYLES } from "./recus/recus-styles.js";
import { documentTicket, normaliserLargeur } from "./recus/recu-ticket.js";
import { qrSecuriseImgHtml, qrPayload } from "./qr.js";

// `fraisAnnexes` : tarifs de la classe — { inscription, autre, revision,
// divers: { uniforme: 50000, … } }. Chaque montant réglé est celui FIGÉ au
// paiement quand il existe, sinon le tarif courant : mêmes montants que la
// grille des mensualités (getEleveMensualiteSnapshot).
export const getRecuTotals = (eleve, montantUnit, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const moisPayes = moisAnnee.filter(m=>mens[m]==="Payé");
  // Inscription : 0 tant qu'elle n'est pas réglée.
  const fraisIns = eleve.inscriptionPayee ? montantInscriptionPaye(eleve, Number(fraisAnnexes?.inscription||0)) : 0;
  // Frais annexes PAYÉS (autre, révision, uniforme, cantine…) : chacun devient
  // une ligne du reçu et entre dans le total général — y compris un frais que
  // la classe ne facture plus.
  const tarifFrais = { autre: fraisAnnexes?.autre, revision: fraisAnnexes?.revision, fraisDivers: fraisAnnexes?.divers };
  const fraisDiversPayes = getFraisAnnexesEleve(eleve, tarifFrais)
    .filter((f) => f.paye && f.montant > 0)
    .map(({ id, label, montant }) => ({ id, label, montant }));
  const totalMensualites = moisPayes.reduce((somme, m) => somme + montantMoisPaye(eleve, m, montantUnit), 0);
  const totalGeneral = totalMensualites + fraisIns
    + fraisDiversPayes.reduce((somme, f) => somme + f.montant, 0);
  return { moisPayes, fraisIns, fraisDiversPayes, totalMensualites, totalGeneral };
};

// QR de vérification : école, élève, total payé, période. Partagé par les deux
// formats — un ticket thermique se vérifie avec le même scanner qu'un A4.
const payloadRecu = (eleve, schoolInfo, totalGeneral, moisPayes) => qrPayload({
  EduGest: "Recu",
  Ecole: schoolInfo.nom,
  Eleve: `${eleve.nom||""} ${eleve.prenom||""}`,
  Classe: eleve.classe,
  IEN: eleve.ien,
  Total: `${totalGeneral} GNF`,
  Mois: moisPayes.join(","),
});

export const imprimerRecu = async (eleve, montantUnit, schoolInfo={}, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const mensDates = eleve.mensDates||{};
  const {moisPayes, fraisIns, fraisDiversPayes, totalMensualites, totalGeneral} = getRecuTotals(eleve, montantUnit, moisAnnee, fraisAnnexes);
  const lf = resolveLegalFields(schoolInfo);

  // window.open AVANT l'await (geste utilisateur) pour éviter le blocage popup.
  const w = window.open("","_blank");

  const qr = await qrSecuriseImgHtml(payloadRecu(eleve, schoolInfo, totalGeneral, moisPayes), schoolInfo, { size: 84, alt: "QR recu" });
  const ctx = { schoolInfo, lf, eleve, moisAnnee, mens, mensDates, fraisIns, fraisDiversPayes, totalMensualites, moisPayes, totalGeneral, qr };

  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.receipt.title")}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}${RECU_STYLES}
  </style></head><body>
  ${blocRecu("Exemplaire — Comptable", ctx)}
  ${blocRecu("Exemplaire — Payant", ctx)}
  ${edugestBrandHTML(schoolInfo)}
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};

// Reçu format ticket pour imprimante thermique (58 ou 80 mm) : un seul
// exemplaire, remis au payant. Le détail imprimé ne liste que les mois
// RÉGLÉS — sur un rouleau, la liste des impayés ne ferait que gâcher du papier
// (le solde restant est résumé en une ligne).
export const imprimerRecuTicket = async (eleve, montantUnit, schoolInfo={}, moisAnnee=MOIS_ANNEE, fraisAnnexes={}, largeurMm=58) => {
  const mensDates = eleve.mensDates||{};
  const {moisPayes, fraisIns, fraisDiversPayes, totalMensualites, totalGeneral} = getRecuTotals(eleve, montantUnit, moisAnnee, fraisAnnexes);

  // window.open AVANT l'await (geste utilisateur) pour éviter le blocage popup.
  const w = window.open("","_blank");
  if (!w) return;

  // QR plus grand que sur A4 : sur un rouleau 58 mm la tête imprime en 203 dpi,
  // un QR chiffré (donc dense) sous ~25 mm devient illisible à la caméra.
  const qr = await qrSecuriseImgHtml(payloadRecu(eleve, schoolInfo, totalGeneral, moisPayes), schoolInfo, { size: 104, alt: "QR recu" });

  w.document.write(documentTicket({
    schoolInfo, eleve, moisAnnee, mensDates, montantUnit,
    fraisIns, fraisDiversPayes, totalMensualites, moisPayes, totalGeneral,
    qr, largeurMm: normaliserLargeur(largeurMm),
  }, PRINT_TRIGGER, printLang(), printDir()));
  w.document.close();
};
