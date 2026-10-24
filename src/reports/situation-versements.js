// ══════════════════════════════════════════════════════════════
//  Situation des versements
// ══════════════════════════════════════════════════════════════
// Pièce que le comptable remet avec l'argent de la caisse versé à la banque
// ou à la Fondation : chaque versement de la période, le total en chiffres
// et en lettres, et les signatures — celles de la matrice « Qui signe quoi »
// (Comptable, visa de la Direction) et celle de qui reçoit les fonds.
// Imprimée pour une période (onglet Versements) ou pour un seul versement.
//
// Comme les reçus : deux coupons sur une page A4 (exemplaire du comptable,
// exemplaire du bénéficiaire), quel que soit le nombre de versements. Une
// longue période passe ses lignes sur deux tableaux côte à côte, et le zoom
// de sécurité des reçus réduit le coupon s'il déborde encore.

import { fmtN, getMonnaie, today } from "../constants.js";
import { resolveLegalFields } from "../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML } from "./print-helpers.js";
import { blocsSignatures } from "./signatures.js";
import { montantEnLettres } from "./montant-lettres.js";
import { enteteCompact } from "./recus/recu-blocs.js";
import { RECU_AJUSTEMENT, RECU_STYLES } from "./recus/recus-styles.js";
import {
  dateCourte, libellePeriodeVersements, resumeVersements,
} from "../components/comptabilite/fondation/versements-utils.js";

// Au-delà, un seul tableau ferait réduire tout le coupon (84 % dès 12
// lignes) : les lignes se répartissent sur deux tableaux côte à côte, comme
// les mois des reçus — 20 versements tiennent ainsi sans réduction.
export const LIGNES_UNE_COLONNE = 8;

// Libellés et descriptions sont saisis à la main : un « < » ou un « & » ne
// doit ni casser le tableau ni injecter de balise dans la page imprimée.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Un versement tient en peu de lignes : texte plus grand que sur un reçu de
// scolarité (RECU_AJUSTEMENT réduit le coupon s'il venait à déborder).
const couponStyles = (c1) => `
    .badge{font-size:12px;padding:5px}
    .exemplaire{font-size:9px}
    .sous-titre{font-size:10px;font-weight:700;color:#475569;letter-spacing:.04em;margin-bottom:8px}
    .grid{gap:6px 16px;margin:4px 0 10px}
    .row{font-size:11px}
    .vers-cols{display:grid;grid-template-columns:1fr;gap:8px;align-items:start}
    .vers-cols.deux{grid-template-columns:1fr 1fr}
    .vers-table{width:100%;border-collapse:collapse;font-size:9.5px}
    .vers-table th{background:${c1};color:#fff;padding:4px 5px;font-size:9px;text-align:center}
    .vers-table td{padding:3px 5px;border:1px solid #e5e7eb;text-align:center}
    .vers-table td.left{text-align:left;font-weight:600}
    .vers-table td.montant{text-align:right;font-weight:800;white-space:nowrap}
    .vers-table .desc{display:block;font-weight:400;color:#64748b;font-size:.9em}
    .vers-cols.deux .vers-table{font-size:8px}
    .vers-cols.deux .vers-table th{font-size:7.5px;padding:3px 3px}
    .vers-cols.deux .vers-table td{padding:2px 3px}
    .vide{text-align:center;font-size:10px;color:#64748b;padding:8px}
    .total.versements{font-size:11px;margin-top:6px}
    .total.versements .detail{display:block;font-weight:400;font-size:8.5px}
    .montant-fort{font-size:14px;font-weight:900;color:#166534}
    .arrete{margin:6px 0 0;padding:7px 10px;border-inline-start:3px solid ${c1};border-radius:2px;background:${c1}0a;
            font-family:Georgia,"Times New Roman",serif;font-size:11.5px;line-height:1.6}
    .lieu-date{text-align:end;margin:6px 0 0;font-size:10px}
    .sig{font-size:10px}`;

const tableVersements = (lignes, premierNumero, monnaie) => `<table class="vers-table">
    <thead><tr><th>N°</th><th>Date</th><th>Libellé</th><th>Bénéficiaire</th><th>Référence</th><th>Montant (${echapper(monnaie)})</th></tr></thead>
    <tbody>${lignes.map((v, i) => `<tr>
      <td>${premierNumero + i}</td>
      <td>${echapper(dateCourte(v.date)) || "—"}</td>
      <td class="left">${echapper(v.libelle) || "—"}${v.description ? `<span class="desc">${echapper(v.description)}</span>` : ""}</td>
      <td>${echapper(v.beneficiaire) || "—"}</td>
      <td>${echapper(v.reference) || "—"}</td>
      <td class="montant">${fmtN(v.montant)}</td>
    </tr>`).join("")}</tbody>
  </table>`;

// Un seul versement : ses champs, comme sur un reçu. Plusieurs : le tableau
// (sur deux colonnes au-delà de LIGNES_UNE_COLONNE), puis le total, détaillé
// par bénéficiaire quand la pièce en mélange plusieurs.
const detailCoupon = (versements, d) => {
  if (d.nb === 1) {
    const v = versements[0];
    const ligne = (lbl, val) => `<div class="row"><span class="lbl">${lbl} : </span>${val}</div>`;
    return `<div class="grid">
      ${ligne("Date", echapper(dateCourte(v.date)) || "—")}
      ${ligne("Bénéficiaire", echapper(v.beneficiaire) || "—")}
      ${ligne("Libellé", echapper(v.libelle) || "—")}
      ${ligne("Référence", echapper(v.reference) || "—")}
      ${v.description ? ligne("Description", echapper(v.description)) : ""}
      ${ligne("Montant", `<span class="montant-fort">${fmtN(v.montant)} ${echapper(d.monnaie)}</span>`)}
    </div>`;
  }
  if (!versements.length) return `<div class="vide">Aucun versement sur cette période.</div>`;
  const milieu = versements.length > LIGNES_UNE_COLONNE ? Math.ceil(versements.length / 2) : versements.length;
  const colonnes = [versements.slice(0, milieu), versements.slice(milieu)].filter((c) => c.length);
  const parBeneficiaire = d.parBeneficiaire.length > 1
    ? `<span class="detail">${d.parBeneficiaire.map((b) => `${echapper(b.beneficiaire)} (${b.nb}) : ${fmtN(b.total)}`).join(" · ")}</span>`
    : "";
  return `<div class="vers-cols${colonnes.length > 1 ? " deux" : ""}">
      ${colonnes.map((c, k) => tableVersements(c, k * milieu + 1, d.monnaie)).join("")}
    </div>
    <div class="total versements">TOTAL VERSÉ (${d.nb}) : ${fmtN(d.total)} ${echapper(d.monnaie)}${parBeneficiaire}</div>`;
};

const coupon = (exemplaire, versements, schoolInfo, d) => `
  <div class="recu">
    ${schoolInfo.logo ? `<div class="watermark"><img crossOrigin="anonymous" src="${schoolInfo.logo}" alt=""/></div>` : ""}
    <div class="recu-corps">
      ${enteteCompact(schoolInfo, resolveLegalFields(schoolInfo))}
      <div class="badge">${d.titre}</div>
      <div class="exemplaire">${exemplaire}</div>
      ${d.sousTitre ? `<div class="sous-titre">${d.sousTitre}</div>` : ""}
      ${detailCoupon(versements, d)}
      <p class="arrete">Arrêtée la présente situation à la somme de :
        <strong>${montantEnLettres(d.total, d.monnaie)}</strong> (${fmtN(d.total)} ${echapper(d.monnaie)}).</p>
      <p class="lieu-date">Fait à ${echapper(schoolInfo.ville || "—")}, le ${today()}</p>
      <div class="sigs">
        ${blocsSignatures(schoolInfo, "versements", (identite) => `<div class="sig">${identite}<br/><br/><br/>Signature</div>`)}
        <div class="sig">Pour réception<br/><span style="font-weight:400">(nom, cachet et signature)</span><br/><br/><br/></div>
      </div>
    </div>
  </div>`;

// Contenu HTML complet — séparé de l'ouverture de fenêtre pour être testable.
// `versements` : déjà filtrés et triés (cf. filtrerVersements).
export function situationVersementsHTML({
  versements = [], schoolInfo = {}, annee = "", du = "", au = "", beneficiaire = "",
}) {
  const { total, nb, parBeneficiaire } = resumeVersements(versements);
  const unSeul = nb === 1;
  const d = {
    monnaie: schoolInfo.monnaie || getMonnaie(),
    total, nb, parBeneficiaire,
    titre: unSeul ? "SITUATION DE VERSEMENT" : "SITUATION DES VERSEMENTS",
    sousTitre: [
      annee ? `ANNÉE SCOLAIRE ${echapper(annee)}` : "",
      libellePeriodeVersements({ du, au }),
      beneficiaire ? `Bénéficiaire : ${echapper(beneficiaire)}` : "",
    ].filter(Boolean).join(" · "),
  };
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>${unSeul ? "Situation de versement" : "Situation des versements"} — ${echapper(schoolInfo.nom || "")}</title>
  <style>${PRINT_RESET}${RECU_STYLES}${couponStyles(schoolInfo.couleur1 || "#0A1628")}</style></head><body>
    ${coupon("Exemplaire — Comptable", versements, schoolInfo, d)}
    ${coupon("Exemplaire — Bénéficiaire", versements, schoolInfo, d)}
    ${edugestBrandHTML(schoolInfo)}
    <script>${RECU_AJUSTEMENT}${PRINT_TRIGGER}</script>
  </body></html>`;
}

// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
export function imprimerSituationVersements(options) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(situationVersementsHTML(options));
  w.document.close();
}
