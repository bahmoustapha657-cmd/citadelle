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
// exemplaire du bénéficiaire). Une longue période ne tiendrait pas dans un
// demi-A4 sans devenir illisible : au-delà de MAX_LIGNES_COUPON versements,
// la situation garde sa page entière.

import { fmtN, getMonnaie, today } from "../constants.js";
import { resolveLegalFields } from "../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML, enteteDoc } from "./print-helpers.js";
import { blocsSignatures } from "./signatures.js";
import { etatsCss } from "./etats-salaires/etats-styles.js";
import { montantEnLettres } from "./montant-lettres.js";
import { enteteCompact } from "./recus/recu-blocs.js";
import { RECU_AJUSTEMENT, RECU_STYLES } from "./recus/recus-styles.js";
import {
  dateCourte, libellePeriodeVersements, resumeVersements,
} from "../components/comptabilite/fondation/versements-utils.js";

export const MAX_LIGNES_COUPON = 8;

// Libellés et descriptions sont saisis à la main : un « < » ou un « & » ne
// doit ni casser le tableau ni injecter de balise dans la page imprimée.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Ce que les deux mises en page partagent : titre, sous-titre, totaux.
const donneesSituation = ({ versements, schoolInfo, annee, du, au, beneficiaire }) => {
  const { total, nb, parBeneficiaire } = resumeVersements(versements);
  const unSeul = nb === 1;
  return {
    c1: schoolInfo.couleur1 || "#0A1628",
    monnaie: schoolInfo.monnaie || getMonnaie(),
    total, nb, parBeneficiaire, unSeul,
    titre: unSeul ? "SITUATION DE VERSEMENT" : "SITUATION DES VERSEMENTS",
    titreFenetre: `${unSeul ? "Situation de versement" : "Situation des versements"} — ${echapper(schoolInfo.nom || "")}`,
    sousTitre: [
      annee ? `ANNÉE SCOLAIRE ${echapper(annee)}` : "",
      libellePeriodeVersements({ du, au }),
      beneficiaire ? `Bénéficiaire : ${echapper(beneficiaire)}` : "",
    ].filter(Boolean).join(" · "),
  };
};

const signaturesHTML = (schoolInfo) => `
  ${blocsSignatures(schoolInfo, "versements", (identite) => `<div class="sig">${identite}<br/><br/><br/>Signature</div>`)}
  <div class="sig">Pour réception<br/><span style="font-weight:400">(nom, cachet et signature)</span><br/><br/><br/></div>`;

const arreteHTML = (schoolInfo, d) => `
  <p class="arrete">Arrêtée la présente situation à la somme de :
    <strong>${montantEnLettres(d.total, d.monnaie)}</strong> (${fmtN(d.total)} ${echapper(d.monnaie)}).</p>
  <p class="lieu-date">Fait à ${echapper(schoolInfo.ville || "—")}, le ${today()}</p>`;

// ── Deux coupons sur un A4 ──────────────────────────────────────
// Un versement tient en peu de lignes : texte plus grand que sur un reçu de
// scolarité (RECU_AJUSTEMENT réduit le coupon s'il venait à déborder).
const couponStyles = (c1) => `
    .badge{font-size:12px;padding:5px}
    .exemplaire{font-size:9px}
    .sous-titre{font-size:10px;font-weight:700;color:#475569;letter-spacing:.04em;margin-bottom:8px}
    .grid{gap:6px 16px;margin:4px 0 10px}
    .row{font-size:11px}
    .vers-table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:6px}
    .vers-table th{background:${c1};color:#fff;padding:4px 5px;font-size:9px;text-align:center}
    .vers-table td{padding:3px 5px;border:1px solid #e5e7eb;text-align:center}
    .vers-table td.left{text-align:left;font-weight:600}
    .vers-table td.montant{text-align:right;font-weight:800;white-space:nowrap}
    .vers-table tr.total-row td{background:#DCFCE7;color:#166534;font-weight:900}
    .montant-fort{font-size:14px;font-weight:900;color:#166534}
    .arrete{margin:6px 0 0;padding:7px 10px;border-inline-start:3px solid ${c1};border-radius:2px;background:${c1}0a;
            font-family:Georgia,"Times New Roman",serif;font-size:11.5px;line-height:1.6}
    .lieu-date{text-align:end;margin:6px 0 0;font-size:10px}
    .sig{font-size:10px}`;

// Un seul versement : ses champs, comme sur un reçu. Plusieurs : un tableau.
const detailCoupon = (versements, d) => {
  if (d.unSeul) {
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
  const lignes = versements.map((v, i) => `<tr>
      <td>${i + 1}</td>
      <td>${echapper(dateCourte(v.date)) || "—"}</td>
      <td class="left">${echapper(v.libelle) || "—"}</td>
      <td>${echapper(v.beneficiaire) || "—"}</td>
      <td>${echapper(v.reference) || "—"}</td>
      <td class="montant">${fmtN(v.montant)}</td>
    </tr>`).join("");
  return `<table class="vers-table">
      <thead><tr><th>N°</th><th>Date</th><th>Libellé</th><th>Bénéficiaire</th><th>Référence</th><th>Montant (${echapper(d.monnaie)})</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="6">Aucun versement sur cette période.</td></tr>`}</tbody>
      <tfoot><tr class="total-row"><td colspan="5" style="text-align:right">TOTAL VERSÉ (${d.nb})</td><td class="montant">${fmtN(d.total)}</td></tr></tfoot>
    </table>`;
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
      ${arreteHTML(schoolInfo, d)}
      <div class="sigs">${signaturesHTML(schoolInfo)}</div>
    </div>
  </div>`;

const situationCouponsHTML = (versements, schoolInfo, d) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>${d.titreFenetre}</title>
  <style>${PRINT_RESET}${RECU_STYLES}${couponStyles(d.c1)}</style></head><body>
    ${coupon("Exemplaire — Comptable", versements, schoolInfo, d)}
    ${coupon("Exemplaire — Bénéficiaire", versements, schoolInfo, d)}
    ${edugestBrandHTML(schoolInfo)}
    <script>${RECU_AJUSTEMENT}${PRINT_TRIGGER}</script>
  </body></html>`;

// ── Page entière (longue période) ───────────────────────────────
const situationPageHTML = (versements, schoolInfo, d) => {
  const { c1, monnaie, total, nb, parBeneficiaire } = d;
  const lignes = versements.map((v, i) => `<tr>
      <td class="center">${i + 1}</td>
      <td class="center">${echapper(dateCourte(v.date)) || "—"}</td>
      <td class="left">${echapper(v.libelle) || "—"}</td>
      <td class="center">${echapper(v.beneficiaire) || "—"}</td>
      <td class="center">${echapper(v.reference) || "—"}</td>
      <td>${echapper(v.description)}</td>
      <td class="right montant">${fmtN(v.montant)}</td>
    </tr>`).join("");

  // Détail par bénéficiaire : utile seulement quand la pièce en mélange.
  const cartesBeneficiaires = parBeneficiaire.length > 1
    ? parBeneficiaire.map((b) => `<div class="stat-card"><div class="lib">${echapper(b.beneficiaire)} (${b.nb})</div><div class="val">${fmtN(b.total)}</div></div>`).join("")
    : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>${d.titreFenetre}</title>
  <style>${etatsCss(c1)}
    .stats-row{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
    .stat-card.total{border-top:3px solid #166534;background:linear-gradient(180deg,#DCFCE7 0%,#fff 100%)}
    .stat-card.total .val{color:#166534}
    th{background:${c1};color:#fff;padding:7px 6px;font-size:9.5px;border:1px solid ${c1};font-weight:800;letter-spacing:.02em;text-align:center}
    td.montant{font-weight:800;white-space:nowrap}
    tr.total-row td{background:#DCFCE7;color:#166534;font-weight:900;font-size:11.5px;padding:8px}
    .arrete{margin:14px 0 0;padding:10px 14px;border:1px solid ${c1}33;border-inline-start:4px solid ${c1};border-radius:6px;
            font-family:Georgia,"Times New Roman",serif;font-size:12.5px;line-height:1.7;background:${c1}0a}
    .arrete strong{color:${c1}}
    .lieu-date{text-align:end;margin:12px 0 0;font-size:11.5px}
  </style></head><body>
    ${enteteDoc(schoolInfo, schoolInfo.logo)}
    <div class="titre-wrap">
      <div class="titre">${d.titre}</div>
      ${d.sousTitre ? `<div class="sous-titre">${d.sousTitre}</div>` : ""}
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="lib">Versements</div><div class="val">${nb}</div></div>
      <div class="stat-card total"><div class="lib">Total versé</div><div class="val">${fmtN(total)} ${echapper(monnaie)}</div></div>
      ${cartesBeneficiaires}
    </div>

    <table>
      <thead><tr><th>N°</th><th>Date</th><th>Libellé</th><th>Bénéficiaire</th><th>Référence</th><th>Description</th><th>Montant (${echapper(monnaie)})</th></tr></thead>
      <tbody>${lignes}</tbody>
      <tfoot><tr class="total-row"><td colspan="6" style="text-align:right">TOTAL VERSÉ</td><td class="right">${fmtN(total)}</td></tr></tfoot>
    </table>

    ${arreteHTML(schoolInfo, d)}

    <div class="signatures">${signaturesHTML(schoolInfo)}</div>

    <div class="footer-note">Situation émise le ${today()} — ${echapper(schoolInfo.nom || "École")} — montants en ${echapper(monnaie)}</div>
    ${edugestBrandHTML(schoolInfo)}
    <script>${PRINT_TRIGGER}</script>
  </body></html>`;
};

// Contenu HTML complet — séparé de l'ouverture de fenêtre pour être testable.
// `versements` : déjà filtrés et triés (cf. filtrerVersements).
export function situationVersementsHTML({
  versements = [], schoolInfo = {}, annee = "", du = "", au = "", beneficiaire = "",
}) {
  const d = donneesSituation({ versements, schoolInfo, annee, du, au, beneficiaire });
  return versements.length <= MAX_LIGNES_COUPON
    ? situationCouponsHTML(versements, schoolInfo, d)
    : situationPageHTML(versements, schoolInfo, d);
}

// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
export function imprimerSituationVersements(options) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(situationVersementsHTML(options));
  w.document.close();
}
