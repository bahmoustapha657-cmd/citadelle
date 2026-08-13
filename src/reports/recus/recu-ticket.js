// ══════════════════════════════════════════════════════════════
//  Reçu au format TICKET — imprimantes thermiques 58 mm / 80 mm
// ══════════════════════════════════════════════════════════════
// Cible : terminaux POS Android à imprimante intégrée (Sunmi, Telpo…) et
// imprimantes de caisse USB/Bluetooth déclarées dans le système. On imprime
// du HTML via le service d'impression de l'appareil — aucun pilote ni SDK
// natif n'est nécessaire.
//
// Contraintes du thermique, qui expliquent tous les choix de style ici :
//   • 1 bit par point : ni couleur ni gris → aplats interdits (ils sortent
//     en tramé sale et usent la tête d'impression). Séparateurs en tirets.
//   • rouleau de largeur fixe, hauteur libre → `@page{size:58mm auto}`.
//   • coupe automatique juste après la dernière ligne → marge basse
//     généreuse pour ne pas trancher le pied de ticket.
//   • résolution 203 dpi (8 pts/mm) : 58 mm ⇒ 48 mm imprimables,
//     80 mm ⇒ 72 mm. Le padding latéral tient dans cet écart.

import { fmt, fmtN, today } from "../../constants.js";
import { montantMoisPaye } from "../../mensualite-utils.js";
import { EDUGEST_SITE, printResetFor, tr } from "../print-helpers.js";

// Largeurs de rouleau proposées à l'utilisateur (mm).
export const TICKET_LARGEURS = [58, 80];

export const normaliserLargeur = (largeurMm) =>
  TICKET_LARGEURS.includes(Number(largeurMm)) ? Number(largeurMm) : 58;

export const TICKET_STYLES = (largeurMm = 58) => {
  const large = largeurMm >= 80;
  const marge = large ? 4 : 3; // mm de chaque côté
  return `
    *{box-sizing:border-box}
    body{width:${largeurMm}mm;margin:0;padding:${marge}mm ${marge}mm 12mm;
         background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;
         font-size:${large ? 12 : 11}px;line-height:1.35;-webkit-text-size-adjust:none}
    .t-logo{display:block;margin:0 auto 3px;width:${large ? 22 : 18}mm;height:auto;
            filter:grayscale(1) contrast(1.6)}
    .t-ecole{text-align:center;font-size:${large ? 15 : 13}px;font-weight:800;
             text-transform:uppercase;line-height:1.2;word-wrap:break-word}
    .t-sous{text-align:center;font-size:${large ? 10 : 9}px;line-height:1.3;margin-top:2px}
    .t-titre{text-align:center;font-weight:800;font-size:${large ? 13 : 12}px;
             letter-spacing:.06em;text-transform:uppercase;margin:5px 0 2px}
    /* Filet en tirets : rendu net en 1 bit, contrairement à un aplat gris. */
    .t-sep{border-top:1px dashed #000;margin:4px 0}
    .t-info{display:flex;justify-content:space-between;gap:6px;align-items:baseline}
    .t-info span{flex-shrink:0}
    .t-info b{text-align:right;word-break:break-word}
    table.t-lignes{width:100%;border-collapse:collapse}
    table.t-lignes td{padding:1px 0;vertical-align:top}
    table.t-lignes td.m{text-align:right;white-space:nowrap;padding-inline-start:6px;font-variant-numeric:tabular-nums}
    .t-groupe{font-weight:700;text-transform:uppercase;font-size:${large ? 11 : 10}px;margin-top:3px}
    /* Le montant ne doit jamais être coupé en deux. Sur 48 mm imprimables, un
       total à 7 chiffres + la devise ne tient pas à côté de son libellé : on
       empile (libellé au-dessus, montant à droite). En 80 mm, tout tient sur
       une ligne. */
    .t-total{font-weight:800;margin:3px 0${large
      ? ";display:flex;justify-content:space-between;gap:6px;align-items:baseline;font-size:15px"
      : ";display:block;font-size:11px;text-transform:uppercase"}}
    .t-total b{white-space:nowrap;font-size:${large ? 16 : 15}px${large ? "" : ";display:block;text-align:right"}}
    .t-reste{text-align:center;font-size:${large ? 10 : 9}px;margin-top:2px}
    .t-qr{text-align:center;margin-top:5px}
    .t-qr img{display:inline-block}
    .t-legende{font-size:${large ? 9 : 8}px;margin-top:1px}
    .t-merci{text-align:center;font-weight:700;margin-top:5px;font-size:${large ? 12 : 11}px}
    .t-marque{text-align:center;font-size:${large ? 9 : 8}px;margin-top:3px;line-height:1.3}
    @media print{body{width:auto}}`;
};

// Une ligne « libellé …… montant » du détail. Montants nus (fmtN) : la devise
// n'est rappelée que sur le total, sinon elle mange la largeur du rouleau.
const ligne = (libelle, montant) =>
  `<tr><td>${libelle}</td><td class="m">${fmtN(montant)}</td></tr>`;

// Corps du ticket. `ctx` est le même contexte que le reçu A4 (voir recus.js),
// enrichi du QR déjà rendu.
export const blocTicket = (ctx) => {
  const {
    schoolInfo = {}, eleve = {}, moisAnnee = [], mensDates = {}, montantUnit,
    fraisIns, fraisAutre, fraisDiversPayes = [], totalMensualites, moisPayes = [],
    totalGeneral, qr,
  } = ctx;
  const nbImpayes = moisAnnee.length - moisPayes.length;
  // Contact école : téléphone/adresse si renseignés, sinon rien (pas de ligne vide).
  const contactEcole = [schoolInfo.telephone, schoolInfo.adresse || schoolInfo.ville]
    .filter((v) => String(v || "").trim()).join(" · ");

  return `
  <div class="t-recu">
    ${schoolInfo.logo ? `<img class="t-logo" src="${schoolInfo.logo}" alt=""/>` : ""}
    <div class="t-ecole">${schoolInfo.nom || ""}</div>
    ${contactEcole ? `<div class="t-sous">${contactEcole}</div>` : ""}
    <div class="t-titre">${tr("reports.receipt.title")}</div>
    <div class="t-sep"></div>
    <div class="t-info"><span>${tr("reports.studentName")}</span><b>${eleve.nom || ""} ${eleve.prenom || ""}</b></div>
    <div class="t-info"><span>${tr("school.bulletins.matricule")}</span><b>${eleve.matricule || "—"}</b></div>
    <div class="t-info"><span>${tr("reports.class")}</span><b>${eleve.classe || "—"}</b></div>
    <div class="t-info"><span>${tr("school.students.parent")}</span><b>${eleve.tuteur || "—"}</b></div>
    <div class="t-info"><span>${tr("common.date")}</span><b>${today()}</b></div>
    <div class="t-sep"></div>
    <table class="t-lignes">
      ${moisPayes.length ? `<tr><td colspan="2" class="t-groupe">${tr("reports.receipt.monthlyFee")}</td></tr>` : ""}
      ${moisPayes.map((m) => ligne(
        `${m}${mensDates[m] ? ` <span style="font-size:.85em">(${mensDates[m]})</span>` : ""}`,
        montantMoisPaye(eleve, m, montantUnit),
      )).join("")}
      ${moisPayes.length ? `<tr><td colspan="2" style="text-align:right;font-weight:700">${fmtN(totalMensualites)}</td></tr>` : ""}
      ${(eleve.inscriptionPayee && fraisIns > 0) || (eleve.autrePayee && fraisAutre > 0) || fraisDiversPayes.length
        ? `<tr><td colspan="2" class="t-groupe">${tr("reports.receipt.otherFees")}</td></tr>` : ""}
      ${eleve.inscriptionPayee && fraisIns > 0 ? ligne(tr("reports.receipt.registration"), fraisIns) : ""}
      ${eleve.autrePayee && fraisAutre > 0 ? ligne(tr("reports.receipt.otherFees"), fraisAutre) : ""}
      ${fraisDiversPayes.map((f) => ligne(f.label, f.montant)).join("")}
    </table>
    <div class="t-sep"></div>
    <div class="t-total"><span>${tr("reports.receipt.amount")}</span><b>${fmt(totalGeneral)}</b></div>
    <div class="t-reste">${tr("accounting.paid")} : ${moisPayes.length}/${moisAnnee.length} ${tr("accounting.month").toLowerCase()}${
      nbImpayes > 0 ? ` — ${tr("reports.receipt.remaining")} : ${nbImpayes}` : ""}</div>
    ${qr ? `<div class="t-qr">${qr}<div class="t-legende">${tr("reports.qrVerify")}</div></div>` : ""}
    <div class="t-merci">${tr("reports.receipt.thanks")}</div>
    <div class="t-marque">EduGest · ${EDUGEST_SITE}</div>
  </div>`;
};

// Document complet prêt à écrire dans la fenêtre d'impression.
export const documentTicket = (ctx, printTrigger, lang = "fr", dir = "ltr") => {
  const largeurMm = normaliserLargeur(ctx.largeurMm);
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><title>${tr("reports.receipt.title")}</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    ${printResetFor(`size:${largeurMm}mm auto;margin:0`)}${TICKET_STYLES(largeurMm)}
  </style></head><body>
  ${blocTicket({ ...ctx, largeurMm })}
  <script>${printTrigger}</script>
  </body></html>`;
};
