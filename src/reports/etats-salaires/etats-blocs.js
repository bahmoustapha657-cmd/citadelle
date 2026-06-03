// Fragments HTML du document « États de salaires » : entêtes de section,
// lignes de total et tableaux par section (Secondaire / Primaire / Personnel).
import { fmtN } from "../../constants.js";

// Couleurs par section (palette cohérente, lisible aussi à l'impression couleur)
export const SEC_COLORS = {
  secondaire: { primary: "#1D4ED8", soft: "#DBEAFE", line: "#BFDBFE" },  // bleu royal
  primaire:   { primary: "#15803D", soft: "#DCFCE7", line: "#BBF7D0" },  // vert
  personnel:  { primary: "#B45309", soft: "#FEF3C7", line: "#FDE68A" },  // ambre
};

// Bandeau d'en-tête d'une section avec le nombre de personnes.
const sectionHeader = (label, color, count) => `
  <div class="section-header" style="border-left:5px solid ${color.primary};background:linear-gradient(90deg, ${color.soft} 0%, transparent 100%);padding:9px 14px;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center;border-radius:0 6px 6px 0">
    <div style="font-size:12px;font-weight:900;color:${color.primary};letter-spacing:0.06em;text-transform:uppercase">${label}</div>
    <div style="font-size:10px;color:${color.primary};font-weight:700">${count} ${count > 1 ? "personnes" : "personne"}</div>
  </div>`;

// En-tête de tableau coloré (colonne 1 = N°, colonne « Prénoms et Nom » alignée à gauche).
const tableHead = (cols, color) => `
  <thead><tr>${cols.map((c, i) => `<th style="background:linear-gradient(180deg, ${color.primary} 0%, ${color.primary}dd 100%);color:#fff;padding:7px 6px;font-size:9.5px;text-align:${i===1?"left":"center"};border:1px solid ${color.primary};font-weight:800;letter-spacing:0.02em">${c}</th>`).join("")}</tr></thead>`;

// Ligne de total d'une section (montant / bon / révision / net).
const totalRow = (label, color, montant, bon, rev, net, colspan) => `
  <tr class="total-row">
    <td colspan="${colspan}" style="background:${color.soft};color:${color.primary};font-weight:900;text-align:right;padding:8px 10px;font-size:11px;letter-spacing:0.04em">${label}</td>
    <td style="background:#DBEAFE;color:#1D4ED8;font-weight:900;text-align:center;padding:8px;font-size:11px">${fmtN(montant)}</td>
    <td style="background:#FEE2E2;color:#B91C1C;font-weight:800;text-align:center;padding:8px;font-size:11px">${bon ? "-"+fmtN(bon) : "0"}</td>
    <td style="background:#FEF3C7;color:#B45309;font-weight:800;text-align:center;padding:8px;font-size:11px">${rev ? "+"+fmtN(rev) : "0"}</td>
    <td style="background:#DCFCE7;color:#166534;font-weight:900;text-align:center;padding:8px;font-size:12px">${fmtN(net)}</td>
  </tr>`;

// Section Secondaire (14 colonnes : volumes horaires + primes). calcExecute/
// calcMontant/calcNet sont des wrappers passés par l'orchestrateur.
export function blocSecondaire(salairesSec, { totMontantSec, totBonSec, totRevSec, totNetSec, calcExecute, calcMontant, calcNet }) {
  return `
    ${sectionHeader("Section Secondaire", SEC_COLORS.secondaire, salairesSec.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Matière","Niveau","V.H. Hebdo","V.H. Prévu","5è Sem","Non Exé.","Exécuté","Prime/h","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.secondaire)}
      <tbody>
      ${salairesSec.length === 0
        ? `<tr><td colspan="14" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant secondaire pour ce mois</td></tr>`
        : salairesSec.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.matiere||"—"}</td>
          <td class="center">${s.niveau||"—"}</td>
          <td class="center">${s.vhHebdo||0}</td>
          <td class="center">${s.vhPrevu||0}</td>
          <td class="center">${s.cinqSem||0}</td>
          <td class="center">${s.nonExecute||0}</td>
          <td class="center" style="background:#EFF6FF;font-weight:800;color:#1D4ED8">${calcExecute(s)}</td>
          <td class="right">${s.primesVariables?'<span style="color:#9a3412;font-weight:700;font-size:9.5px">Variable</span>':fmtN(s.primeHoraire)}</td>
          <td class="right">${fmtN(calcMontant(s))}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(calcNet(s))}</td>
        </tr>`).join("")}
      ${salairesSec.length > 0 ? totalRow("TOTAL SECONDAIRE", SEC_COLORS.secondaire, totMontantSec, totBonSec, totRevSec, totNetSec, 10) : ""}
      </tbody>
    </table>`;
}

// Section Primaire (7 colonnes, montant forfaitaire).
export function blocPrimaire(salairesPrim, { totMontantPrim, totBonPrim, totRevPrim, totNetPrim }) {
  return `
    ${sectionHeader("Section Primaire", SEC_COLORS.primaire, salairesPrim.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Classe","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.primaire)}
      <tbody>
      ${salairesPrim.length === 0
        ? `<tr><td colspan="7" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant primaire pour ce mois</td></tr>`
        : salairesPrim.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.niveau||"—"}</td>
          <td class="right">${fmtN(s.montantForfait||0)}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
        </tr>`).join("")}
      ${salairesPrim.length > 0 ? totalRow("TOTAL PRIMAIRE", SEC_COLORS.primaire, totMontantPrim, totBonPrim, totRevPrim, totNetPrim, 3) : ""}
      </tbody>
    </table>`;
}

// Section Administration & Personnel (8 colonnes, montant forfaitaire).
export function blocPersonnel(salairesPers, { totMontantPers, totBonPers, totRevPers, totNetPers }) {
  return `
    ${sectionHeader("Administration & Personnel", SEC_COLORS.personnel, salairesPers.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Poste","Catégorie","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.personnel)}
      <tbody>
      ${salairesPers.length === 0
        ? `<tr><td colspan="8" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun membre du personnel pour ce mois</td></tr>`
        : salairesPers.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.poste||"—"}</td>
          <td class="center">${s.categorie||"—"}</td>
          <td class="right">${fmtN(s.montantForfait||0)}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
        </tr>`).join("")}
      ${salairesPers.length > 0 ? totalRow("TOTAL ADMINISTRATION", SEC_COLORS.personnel, totMontantPers, totBonPers, totRevPers, totNetPers, 4) : ""}
      </tbody>
    </table>`;
}
