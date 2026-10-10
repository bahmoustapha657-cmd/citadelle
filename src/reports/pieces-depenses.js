// ══════════════════════════════════════════════════════════════
//  Fiche de bon + État des dépenses
// ══════════════════════════════════════════════════════════════
// Fiche de bon : la pièce que signe l'agent qui reçoit un bon (avance sur
// salaire). Deux exemplaires sur une feuille A4 — l'un reste à l'école comme
// preuve de remise, l'autre au bénéficiaire —, montant en chiffres et en
// lettres, reconnaissance de dette, signature du bénéficiaire et celles de la
// matrice « Qui signe quoi » (Comptable, visa de la Direction).
//
// État des dépenses : les dépenses d'un mois ou de toute l'année, total en
// chiffres et en lettres, répartition par catégorie (et par mois pour l'état
// global), signatures de la matrice.

import { fmtN, getMonnaie, today } from "../constants.js";
import { PRINT_TRIGGER, edugestBrandHTML, enteteDoc } from "./print-helpers.js";
import { blocsSignatures } from "./signatures.js";
import { etatsCss } from "./etats-salaires/etats-styles.js";
import { montantEnLettres } from "./montant-lettres.js";
import {
  libelleMois, moisDeDepense, regrouperDepenses, totalDepenses,
} from "../components/comptabilite/depenses-utils.js";

// Noms, motifs et libellés sont saisis à la main : un « < » ou un « & » ne
// doit ni casser la page ni y injecter de balise.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// « 2026-10-14 » → « 14/10/2026 » ; une date déjà lisible passe telle quelle.
const dateFr = (valeur) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valeur || "");
};

// Date de remise du bon : celle saisie, sinon celle de son enregistrement.
const dateDuBon = (bon) => {
  if (bon.date) return dateFr(bon.date);
  if (bon.createdAt) return new Date(bon.createdAt).toLocaleDateString("fr-FR");
  return "";
};

// N° lisible tiré de l'identifiant : le même bon réimprimé garde son numéro.
export const numeroBon = (bon) => String(bon?._id || "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();

const exemplaireBon = ({ bon, schoolInfo, annee, monnaie, mention }) => {
  const montant = Number(bon.montant) || 0;
  const nom = echapper(bon.nom) || "………………………………";
  const mois = echapper(bon.mois) || "………………";
  const numero = numeroBon(bon);
  const date = dateDuBon(bon);
  return `<section class="bon">
    <div class="bon-tete">
      ${schoolInfo.logo ? `<img crossOrigin="anonymous" src="${schoolInfo.logo}" alt=""/>` : ""}
      <div class="bon-ecole">
        <strong>${echapper(schoolInfo.nom || "")}</strong>
        <span>${[schoolInfo.ville, annee ? `Année scolaire ${annee}` : ""].filter(Boolean).map(echapper).join(" · ")}</span>
      </div>
      <div class="bon-mention">${mention}</div>
    </div>
    <div class="bon-titre">BON${numero ? ` N° ${numero}` : ""}</div>
    <table class="bon-infos">
      <tr><th>Bénéficiaire</th><td><strong>${nom}</strong></td><th>Section</th><td>${echapper(bon.section) || "—"}</td></tr>
      <tr><th>Salaire du mois</th><td>${mois}</td><th>Date</th><td>${date || "……/……/…………"}</td></tr>
      <tr><th>Motif</th><td colspan="3">${echapper(bon.motif) || "—"}</td></tr>
      <tr class="bon-montant"><th>Montant</th><td colspan="3">${fmtN(montant)} ${echapper(monnaie)}</td></tr>
    </table>
    <p class="bon-texte">Je soussigné(e) <strong>${nom}</strong> reconnais avoir reçu la somme de
      <strong>${montantEnLettres(montant, monnaie)}</strong> (${fmtN(montant)} ${echapper(monnaie)})
      à titre de bon sur mon salaire du mois de <strong>${mois}</strong>, montant qui sera retenu sur ce salaire.</p>
    <p class="bon-lieu">Fait à ${echapper(schoolInfo.ville || "……………………")}, le ${date || "……/……/…………"}</p>
    <div class="signatures">
      <div class="sig">Le Bénéficiaire<br/><span style="font-weight:400">« Lu et approuvé »</span><br/><br/><br/></div>
      ${blocsSignatures(schoolInfo, "bon", (identite) => `<div class="sig">${identite}<br/><br/><br/></div>`)}
    </div>
  </section>`;
};

// Contenu HTML complet — séparé de l'ouverture de fenêtre pour être testable.
export function ficheBonHTML({ bon = {}, schoolInfo = {}, annee = "" }) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const monnaie = schoolInfo.monnaie || getMonnaie();
  const exemplaire = (mention) => exemplaireBon({ bon, schoolInfo, annee, monnaie, mention });
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>Bon ${echapper(numeroBon(bon))} — ${echapper(bon.nom || "")}</title>
  <style>${etatsCss(c1)}
    body{padding:8mm 12mm}
    .bon{height:132mm;display:flex;flex-direction:column;overflow:hidden}
    .bon-tete{display:flex;align-items:center;gap:10px;border-bottom:2px solid ${c1};padding-bottom:6px}
    .bon-tete img{width:44px;height:44px;object-fit:contain}
    .bon-ecole{flex:1;display:flex;flex-direction:column;line-height:1.4}
    .bon-ecole strong{font-size:13px;color:${c1}}
    .bon-ecole span{font-size:9.5px;color:#64748b}
    .bon-mention{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${c1};
                 border:1px solid ${c1};border-radius:4px;padding:3px 7px}
    .bon-titre{text-align:center;font-size:16px;font-weight:900;letter-spacing:.08em;color:${c1};margin:9px 0 7px}
    .bon-infos th{width:17%;background:${c1}10;color:${c1};text-align:start;font-size:10px;padding:6px 8px;border:1px solid #e5e7eb}
    .bon-infos td{font-size:11px;padding:6px 8px;background:#fff!important}
    .bon-montant td{font-size:14px!important;font-weight:900;color:${c1}}
    .bon-texte{font-family:Georgia,"Times New Roman",serif;font-size:11.5px;line-height:1.6;margin:4px 0 0}
    .bon-lieu{text-align:end;font-size:11px;margin:6px 0 0}
    .bon .signatures{margin-top:auto;padding-top:8px}
    .coupe{border:0;border-top:1.5px dashed #94a3b8;margin:4mm 0;position:relative}
    .coupe::after{content:"✂";position:absolute;left:-2px;top:-10px;font-size:13px;color:#94a3b8;background:#fff}
    .brand{margin-top:2mm}
  </style></head><body>
    ${exemplaire("Exemplaire de l'école")}
    <hr class="coupe"/>
    ${exemplaire("Exemplaire du bénéficiaire")}
    <div class="brand">${edugestBrandHTML(schoolInfo)}</div>
    <script>${PRINT_TRIGGER}</script>
  </body></html>`;
}

// `depenses` : déjà filtrées et triées (cf. filtrerDepensesParMois).
// `mois` : clé « AAAA-MM » de l'état mensuel ; vide pour l'état global.
export function etatDepensesHTML({ depenses = [], schoolInfo = {}, annee = "", mois = "" }) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const monnaie = schoolInfo.monnaie || getMonnaie();
  const total = totalDepenses(depenses);
  const sousTitre = [
    mois ? `MOIS ${/^[AEIOU]/.test(libelleMois(mois).toUpperCase()) ? "D'" : "DE "}${libelleMois(mois).toUpperCase()}` : "ÉTAT GLOBAL",
    annee ? `ANNÉE SCOLAIRE ${echapper(annee)}` : "",
  ].filter(Boolean).join(" — ");

  const lignes = depenses.map((d, i) => `<tr>
      <td class="center">${i + 1}</td>
      <td class="center">${echapper(dateFr(d.date)) || "—"}</td>
      <td class="left">${echapper(d.libelle) || "—"}</td>
      <td class="center">${echapper(d.categorie) || "—"}</td>
      <td class="center">${echapper(d.periode) || "—"}</td>
      <td class="right montant">${fmtN(d.montant)}</td>
    </tr>`).join("");

  const parCategorie = regrouperDepenses(depenses, (d) => d.categorie || "Sans catégorie")
    .sort((a, b) => b.total - a.total);
  const cartes = parCategorie.map((g) =>
    `<div class="stat-card"><div class="lib">${echapper(g.cle)} (${g.nb})</div><div class="val">${fmtN(g.total)}</div></div>`).join("");

  // État global : récapitulatif mois par mois, dans l'ordre du calendrier.
  const parMois = mois ? [] : regrouperDepenses(depenses, moisDeDepense)
    .sort((a, b) => (a.cle && b.cle ? a.cle.localeCompare(b.cle) : a.cle ? -1 : 1));
  const recapMois = parMois.length > 1 ? `
    <div class="recap-titre">Récapitulatif par mois</div>
    <table class="recap">
      <thead><tr><th>Mois</th><th>Nombre</th><th>Montant (${echapper(monnaie)})</th></tr></thead>
      <tbody>${parMois.map((g) => `<tr><td class="left">${g.cle ? libelleMois(g.cle) : "Sans date"}</td><td class="center">${g.nb}</td><td class="right montant">${fmtN(g.total)}</td></tr>`).join("")}</tbody>
      <tfoot><tr class="total-row"><td style="text-align:right" colspan="2">TOTAL</td><td class="right">${fmtN(total)}</td></tr></tfoot>
    </table>` : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>État des dépenses — ${mois ? libelleMois(mois) : "global"} — ${echapper(schoolInfo.nom || "")}</title>
  <style>${etatsCss(c1)}
    .stats-row{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
    .stat-card.total{border-top:3px solid #B91C1C;background:linear-gradient(180deg,#FEE2E2 0%,#fff 100%)}
    .stat-card.total .val{color:#B91C1C}
    th{background:${c1};color:#fff;padding:7px 6px;font-size:9.5px;border:1px solid ${c1};font-weight:800;letter-spacing:.02em;text-align:center}
    td.montant{font-weight:800;white-space:nowrap}
    tr.total-row td{background:#FEE2E2;color:#991B1B;font-weight:900;font-size:11.5px;padding:8px}
    .recap-titre{font-weight:800;color:${c1};font-size:12px;margin:16px 0 6px}
    table.recap{width:60%}
    .arrete{margin:14px 0 0;padding:10px 14px;border:1px solid ${c1}33;border-inline-start:4px solid ${c1};border-radius:6px;
            font-family:Georgia,"Times New Roman",serif;font-size:12.5px;line-height:1.7;background:${c1}0a}
    .arrete strong{color:${c1}}
    .lieu-date{text-align:end;margin:12px 0 0;font-size:11.5px}
  </style></head><body>
    ${enteteDoc(schoolInfo, schoolInfo.logo)}
    <div class="titre-wrap">
      <div class="titre">ÉTAT DES DÉPENSES</div>
      <div class="sous-titre">${sousTitre}</div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="lib">Dépenses</div><div class="val">${depenses.length}</div></div>
      <div class="stat-card total"><div class="lib">Total dépensé</div><div class="val">${fmtN(total)} ${echapper(monnaie)}</div></div>
      ${cartes}
    </div>

    <table>
      <thead><tr><th>N°</th><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Période</th><th>Montant (${echapper(monnaie)})</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="6" class="center">Aucune dépense sur cette période.</td></tr>`}</tbody>
      <tfoot><tr class="total-row"><td colspan="5" style="text-align:right">TOTAL DES DÉPENSES</td><td class="right">${fmtN(total)}</td></tr></tfoot>
    </table>
    ${recapMois}

    <p class="arrete">Arrêté le présent état à la somme de :
      <strong>${montantEnLettres(total, monnaie)}</strong> (${fmtN(total)} ${echapper(monnaie)}).</p>
    <p class="lieu-date">Fait à ${echapper(schoolInfo.ville || "—")}, le ${today()}</p>

    <div class="signatures">
      ${blocsSignatures(schoolInfo, "depenses", (identite) => `<div class="sig">${identite}<br/><br/><br/>Signature</div>`)}
    </div>

    <div class="footer-note">État émis le ${today()} — ${echapper(schoolInfo.nom || "École")} — montants en ${echapper(monnaie)}</div>
    ${edugestBrandHTML(schoolInfo)}
    <script>${PRINT_TRIGGER}</script>
  </body></html>`;
}

// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
const imprimerHTML = (html) => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
};

export const imprimerFicheBon = (options) => imprimerHTML(ficheBonHTML(options));
export const imprimerEtatDepenses = (options) => imprimerHTML(etatDepensesHTML(options));
