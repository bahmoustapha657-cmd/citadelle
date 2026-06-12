// ══════════════════════════════════════════════════════════════
//  États de salaires — Impression mensuelle
// ══════════════════════════════════════════════════════════════
// Document mensuel récapitulant les fiches de paie par section
// (Secondaire / Primaire / Personnel) avec totaux et signatures.
// Orchestrateur : assemble styles (./etats-salaires/etats-styles) et
// blocs de sections (./etats-salaires/etats-blocs).

import { fmtN, today } from "../constants.js";
import { edugestBrandHTML, enteteDoc } from "./print-helpers.js";
import { etatsCss } from "./etats-salaires/etats-styles.js";
import { blocSecondaire, blocPrimaire, blocPersonnel } from "./etats-salaires/etats-blocs.js";

// Fonction pure : tout ce dont elle a besoin arrive en params.
//
// Args :
//  - moisSel : "Octobre" | … (mois ciblé)
//  - anneeConsultee : "2025-2026"
//  - schoolInfo : info école pour l'en-tête + couleurs
//  - salairesSec/Prim/Pers : fiches du mois, déjà filtrées par section
//  - totals : { totMontantGlobal, totBonGlobal, totNetGlobal,
//      totMontantSec/Prim/Pers, totBonSec/Prim/Pers, totNetSec/Prim/Pers }
//  - calcExecute/calcMontant/calcNet : wrappers d'accès aux helpers
//    salary-utils (laissés en params pour rester découplé).
export function imprimerEtatsSalaires({
  moisSel,
  anneeConsultee,
  schoolInfo,
  salairesSec,
  salairesPrim,
  salairesPers,
  totals,
  calcExecute,
  calcMontant,
  calcNet,
}) {
  const {
    totMontantGlobal, totBonGlobal, totNetGlobal,
    totMontantSec, totBonSec, totNetSec,
    totMontantPrim, totBonPrim, totNetPrim,
    totMontantPers, totBonPers, totNetPers,
  } = totals;

  const c1 = schoolInfo?.couleur1 || "#0A1628";

  const totRevSec  = salairesSec.reduce((sum,s)=>sum+Number(s.revision||0),0);
  const totRevPrim = salairesPrim.reduce((sum,s)=>sum+Number(s.revision||0),0);
  const totRevPers = salairesPers.reduce((sum,s)=>sum+Number(s.revision||0),0);

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>États de Salaires — ${moisSel} ${anneeConsultee}</title>
  <style>${etatsCss(c1)}</style></head><body>
    ${enteteDoc(schoolInfo, schoolInfo?.logo)}
    <div class="titre-wrap">
      <div class="titre">ÉTATS DE SALAIRES</div>
      <div class="sous-titre">MOIS DE ${moisSel.toUpperCase()} — ANNÉE SCOLAIRE ${anneeConsultee}</div>
    </div>

    <div class="stats-row">
      <div class="stat-card brut"><div class="lib">Total brut</div><div class="val">${fmtN(totMontantGlobal)}</div></div>
      <div class="stat-card bons"><div class="lib">Total bons</div><div class="val">-${fmtN(totBonGlobal)}</div></div>
      <div class="stat-card rev"><div class="lib">Total révisions</div><div class="val">+${fmtN(totRevSec+totRevPrim+totRevPers)}</div></div>
      <div class="stat-card net"><div class="lib">Net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
    </div>

    ${blocSecondaire(salairesSec, { totMontantSec, totBonSec, totRevSec, totNetSec, calcExecute, calcMontant, calcNet })}
    ${blocPrimaire(salairesPrim, { totMontantPrim, totBonPrim, totRevPrim, totNetPrim })}
    ${blocPersonnel(salairesPers, { totMontantPers, totBonPers, totRevPers, totNetPers })}

    <div class="global-totaux">
      <div class="global-total montant"><div class="lib">Total brut à payer</div><div class="val">${fmtN(totMontantGlobal)} GNF</div></div>
      <div class="global-total bon"><div class="lib">Total bons</div><div class="val">${fmtN(totBonGlobal)} GNF</div></div>
      <div class="global-total net"><div class="lib">Total net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
    </div>

    <div class="signatures">
      <div class="sig">Le Comptable<br/><br/><br/>Signature</div>
      <div class="sig">Le Directeur<br/><br/><br/>Signature</div>
      <div class="sig">Le Fondateur<br/><br/><br/>Signature</div>
    </div>

    <div class="footer-note">État émis le ${today()} — ${schoolInfo?.nom||"École"} — Tous montants en Francs Guinéens (GNF)</div>
    ${edugestBrandHTML(schoolInfo)}

    <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
}
