// ══════════════════════════════════════════════════════════════
//  Reçus de paiement — getRecuTotals + imprimerRecu
// ══════════════════════════════════════════════════════════════
// Génère 2 exemplaires (comptable + payant) sur une page A4.
// Les fragments HTML vivent dans recus/recu-blocs.js et le style
// dans recus/recus-styles.js.

import { MOIS_ANNEE } from "../constants.js";
import { resolveLegalFields } from "../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML, printDir, printLang, tr } from "./print-helpers.js";
import { blocRecu } from "./recus/recu-blocs.js";
import { RECU_STYLES } from "./recus/recus-styles.js";
import { qrSecuriseImgHtml, qrPayload } from "./qr.js";

export const getRecuTotals = (eleve, montantUnit, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const moisPayes = moisAnnee.filter(m=>mens[m]==="Payé");
  const fraisIns = Number(fraisAnnexes?.inscription||0);
  const fraisAutre = Number(fraisAnnexes?.autre||0);
  const totalMensualites = moisPayes.length*montantUnit;
  const totalGeneral = totalMensualites
    + (eleve.inscriptionPayee&&fraisIns>0?fraisIns:0)
    + (eleve.autrePayee&&fraisAutre>0?fraisAutre:0);
  return { moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral };
};

export const imprimerRecu = async (eleve, montantUnit, schoolInfo={}, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const mensDates = eleve.mensDates||{};
  const {moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral} = getRecuTotals(eleve, montantUnit, moisAnnee, fraisAnnexes);
  const lf = resolveLegalFields(schoolInfo);

  // window.open AVANT l'await (geste utilisateur) pour éviter le blocage popup.
  const w = window.open("","_blank");

  // QR de vérification : école, élève, total payé, période.
  const qr = await qrSecuriseImgHtml(qrPayload({
    EduGest: "Recu",
    Ecole: schoolInfo.nom,
    Eleve: `${eleve.nom||""} ${eleve.prenom||""}`,
    Classe: eleve.classe,
    IEN: eleve.ien,
    Total: `${totalGeneral} GNF`,
    Mois: moisPayes.join(","),
  }), schoolInfo, { size: 56, alt: "QR recu" });
  const ctx = { schoolInfo, lf, eleve, moisAnnee, mens, mensDates, fraisIns, fraisAutre, totalMensualites, moisPayes, totalGeneral, qr };

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
