// ══════════════════════════════════════════════════════════════
//  Situation des versements
// ══════════════════════════════════════════════════════════════
// Pièce que le comptable remet avec l'argent de la caisse versé à la banque
// ou à la Fondation : chaque versement de la période, le total en chiffres
// et en lettres, et les signatures — celles de la matrice « Qui signe quoi »
// (Comptable, visa de la Direction) et celle de qui reçoit les fonds.
// Imprimée pour une période (onglet Versements) ou pour un seul versement.

import { fmtN, getMonnaie, today } from "../constants.js";
import { PRINT_TRIGGER, edugestBrandHTML, enteteDoc } from "./print-helpers.js";
import { blocsSignatures } from "./signatures.js";
import { etatsCss } from "./etats-salaires/etats-styles.js";
import { montantEnLettres } from "./montant-lettres.js";
import {
  dateCourte, libellePeriodeVersements, resumeVersements,
} from "../components/comptabilite/fondation/versements-utils.js";

// Libellés et descriptions sont saisis à la main : un « < » ou un « & » ne
// doit ni casser le tableau ni injecter de balise dans la page imprimée.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Contenu HTML complet — séparé de l'ouverture de fenêtre pour être testable.
// `versements` : déjà filtrés et triés (cf. filtrerVersements).
export function situationVersementsHTML({
  versements = [], schoolInfo = {}, annee = "", du = "", au = "", beneficiaire = "",
}) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const monnaie = schoolInfo.monnaie || getMonnaie();
  const { total, nb, parBeneficiaire } = resumeVersements(versements);
  const unSeul = nb === 1;
  const titre = unSeul ? "SITUATION DE VERSEMENT" : "SITUATION DES VERSEMENTS";
  const sousTitre = [
    annee ? `ANNÉE SCOLAIRE ${echapper(annee)}` : "",
    libellePeriodeVersements({ du, au }),
    beneficiaire ? `Bénéficiaire : ${echapper(beneficiaire)}` : "",
  ].filter(Boolean).join(" · ");

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
  <title>${unSeul ? "Situation de versement" : "Situation des versements"} — ${echapper(schoolInfo.nom || "")}</title>
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
      <div class="titre">${titre}</div>
      ${sousTitre ? `<div class="sous-titre">${sousTitre}</div>` : ""}
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="lib">Versements</div><div class="val">${nb}</div></div>
      <div class="stat-card total"><div class="lib">Total versé</div><div class="val">${fmtN(total)} ${echapper(monnaie)}</div></div>
      ${cartesBeneficiaires}
    </div>

    <table>
      <thead><tr><th>N°</th><th>Date</th><th>Libellé</th><th>Bénéficiaire</th><th>Référence</th><th>Description</th><th>Montant (${echapper(monnaie)})</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="7" class="center">Aucun versement sur cette période.</td></tr>`}</tbody>
      <tfoot><tr class="total-row"><td colspan="6" style="text-align:right">TOTAL VERSÉ</td><td class="right">${fmtN(total)}</td></tr></tfoot>
    </table>

    <p class="arrete">Arrêtée la présente situation à la somme de :
      <strong>${montantEnLettres(total, monnaie)}</strong> (${fmtN(total)} ${echapper(monnaie)}).</p>
    <p class="lieu-date">Fait à ${echapper(schoolInfo.ville || "—")}, le ${today()}</p>

    <div class="signatures">
      ${blocsSignatures(schoolInfo, "versements", (identite) => `<div class="sig">${identite}<br/><br/><br/>Signature</div>`)}
      <div class="sig">Pour réception<br/><span style="font-weight:400">(nom, cachet et signature)</span><br/><br/><br/></div>
    </div>

    <div class="footer-note">Situation émise le ${today()} — ${echapper(schoolInfo.nom || "École")} — montants en ${echapper(monnaie)}</div>
    ${edugestBrandHTML(schoolInfo)}
    <script>${PRINT_TRIGGER}</script>
  </body></html>`;
}

// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
export function imprimerSituationVersements(options) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(situationVersementsHTML(options));
  w.document.close();
}
