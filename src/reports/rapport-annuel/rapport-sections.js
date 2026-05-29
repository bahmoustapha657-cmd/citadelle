// ══════════════════════════════════════════════════════════════
//  Rapport annuel — sections de données (tableaux du corps)
// ══════════════════════════════════════════════════════════════
// Chaque builder transforme une tranche du modèle en bloc HTML. Aucun
// calcul métier : tout est déjà agrégé par computeRapportAnnuel.
import { fmt } from "../../constants.js";

const fmtMoney = (n) => fmt(Math.round(Number(n) || 0));
const barreLargeur = (value, max) => Math.max(0, Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0));
const vide = (txt) => `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">${txt}</p>`;

export const buildEffectifs = ({ lignesEffectif, totEleves }) => `
  <div class="section-title">Effectifs par classe</div>
  <table>
    <thead><tr><th>Classe</th><th>Section</th><th class="num">Effectif</th><th class="num">%</th></tr></thead>
    <tbody>
      ${lignesEffectif.map((l) => `<tr>
        <td><strong>${l.classe}</strong></td>
        <td>${l.section}</td>
        <td class="num">${l.effectif}</td>
        <td class="num">${totEleves > 0 ? Math.round((l.effectif / totEleves) * 100) : 0}%</td>
      </tr>`).join("")}
    </tbody>
    <tfoot><tr><td>Total</td><td>—</td><td class="num">${totEleves}</td><td class="num">100%</td></tr></tfoot>
  </table>`;

export const buildFinances = ({ moisAnnee, lignesFinance, totRecAnnuel, totDepAnnuel, totSalAnnuel, soldeAnnuel, maxFinance }) => `
  <div class="section-title">Finances mensuelles (${moisAnnee.length} mois)</div>
  <table>
    <thead><tr>
      <th>Mois</th>
      <th class="num">Recettes</th>
      <th class="num">Dépenses</th>
      <th class="num">Salaires</th>
      <th class="num">Solde</th>
      <th>Tendance</th>
    </tr></thead>
    <tbody>
      ${lignesFinance.map((l) => `<tr>
        <td><strong>${l.mois}</strong></td>
        <td class="num" style="color:#059669">${fmtMoney(l.recettes)}</td>
        <td class="num" style="color:#dc2626">${fmtMoney(l.depenses)}</td>
        <td class="num" style="color:#7c3aed">${fmtMoney(l.salaires)}</td>
        <td class="num" style="font-weight:800;color:${l.solde >= 0 ? "#059669" : "#dc2626"}">${fmtMoney(l.solde)}</td>
        <td><span class="bar" style="width:${barreLargeur(l.recettes, maxFinance)}%;background:#059669"></span><span class="bar" style="width:${barreLargeur(l.depenses + l.salaires, maxFinance)}%;background:#dc2626"></span></td>
      </tr>`).join("")}
    </tbody>
    <tfoot><tr>
      <td>Total annuel</td>
      <td class="num">${fmtMoney(totRecAnnuel)}</td>
      <td class="num">${fmtMoney(totDepAnnuel)}</td>
      <td class="num">${fmtMoney(totSalAnnuel)}</td>
      <td class="num" style="color:${soldeAnnuel >= 0 ? "#059669" : "#dc2626"}">${fmtMoney(soldeAnnuel)}</td>
      <td></td>
    </tr></tfoot>
  </table>`;

export const buildPedagogie = ({ lignesPedagogie }) => `
  <div class="section-title page-break">Performance pédagogique par classe</div>
  ${lignesPedagogie.length === 0
    ? vide("Aucune note enregistrée sur l'année.")
    : `<table>
        <thead><tr>
          <th>Classe</th>
          <th>Section</th>
          <th class="num">Effectif</th>
          <th class="num">Notés</th>
          <th class="num">Moy. classe</th>
          <th class="num">% réussite</th>
        </tr></thead>
        <tbody>
          ${lignesPedagogie.map((p) => `<tr>
            <td><strong>${p.classe}</strong></td>
            <td>${p.section}</td>
            <td class="num">${p.effectif}</td>
            <td class="num">${p.nbAvecNotes}</td>
            <td class="num" style="font-weight:800;color:${p.moyClasse == null ? "#94a3b8" : p.moyClasse >= (p.max / 2) ? "#059669" : "#dc2626"}">${p.moyClasse == null ? "—" : `${p.moyClasse.toFixed(2)} / ${p.max}`}</td>
            <td class="num" style="font-weight:700;color:${p.tauxReussite == null ? "#94a3b8" : p.tauxReussite >= 60 ? "#059669" : p.tauxReussite >= 40 ? "#d97706" : "#dc2626"}">${p.tauxReussite == null ? "—" : `${p.tauxReussite}%`}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;font-style:italic;margin:4px 0 0">Moyenne indicative (arithmétique non pondérée). Le bulletin officiel reste la référence pour la moyenne par coefficient.</p>`}`;

export const buildMensualites = ({ lignesMens, totEleves, totalDu, totalPercu, tauxRecouvrement }) => `
  <div class="section-title">Mensualités — recouvrement par classe</div>
  ${lignesMens.length === 0
    ? vide("Aucune donnée de mensualité.")
    : `<table>
        <thead><tr>
          <th>Classe</th>
          <th>Section</th>
          <th class="num">Effectif</th>
          <th class="num">Mois dus</th>
          <th class="num">Mois payés</th>
          <th class="num">Impayés</th>
          <th class="num">Taux</th>
        </tr></thead>
        <tbody>
          ${lignesMens.map((m) => `<tr>
            <td><strong>${m.classe}</strong></td>
            <td>${m.section}</td>
            <td class="num">${m.effectif}</td>
            <td class="num">${m.due}</td>
            <td class="num" style="color:#059669">${m.paye}</td>
            <td class="num" style="color:#dc2626">${m.due - m.paye}</td>
            <td class="num" style="font-weight:800;color:${m.taux >= 80 ? "#059669" : m.taux >= 50 ? "#d97706" : "#dc2626"}">${m.taux}%</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <td>Total annuel</td><td>—</td>
          <td class="num">${totEleves}</td>
          <td class="num">${totalDu}</td>
          <td class="num">${totalPercu}</td>
          <td class="num">${totalDu - totalPercu}</td>
          <td class="num">${tauxRecouvrement}%</td>
        </tr></tfoot>
      </table>`}`;

export const buildSalaires = ({ lignesSalSection, masseTotale }) => `
  <div class="section-title page-break">Masse salariale par section</div>
  ${lignesSalSection.length === 0
    ? vide("Aucune fiche de paie enregistrée.")
    : `<table>
        <thead><tr>
          <th>Section</th>
          <th class="num">Effectif distinct</th>
          <th class="num">Masse annuelle</th>
          <th class="num">% du total</th>
        </tr></thead>
        <tbody>
          ${lignesSalSection.map((sec) => `<tr>
            <td><strong>${sec.section}</strong></td>
            <td class="num">${sec.effectif}</td>
            <td class="num">${fmtMoney(sec.masse)}</td>
            <td class="num">${masseTotale > 0 ? Math.round((sec.masse / masseTotale) * 100) : 0}%</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <td>Total</td><td class="num">—</td>
          <td class="num">${fmtMoney(masseTotale)}</td>
          <td class="num">100%</td>
        </tr></tfoot>
      </table>`}`;

export const buildAbsences = ({ topAbsences, topElevesAbsents, totAbsences }) => `
  <div class="section-title">Absences — Top 10 classes</div>
  ${topAbsences.length === 0
    ? vide("Aucune absence enregistrée sur l'année.")
    : `<table>
        <thead><tr><th>Classe</th><th class="num">Total</th><th class="num">Justifiées</th><th class="num">Non justifiées</th></tr></thead>
        <tbody>
          ${topAbsences.map((a) => `<tr>
            <td><strong>${a.classe}</strong></td>
            <td class="num">${a.total}</td>
            <td class="num" style="color:#059669">${a.justif}</td>
            <td class="num" style="color:#dc2626">${a.nonJust}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr><td>Total annuel (toutes classes)</td><td class="num">${totAbsences}</td><td class="num">—</td><td class="num">—</td></tr></tfoot>
      </table>`}

  <div class="section-title">Absences — Top 10 élèves</div>
  ${topElevesAbsents.length === 0
    ? vide("Aucun élève absentéiste détecté.")
    : `<table>
        <thead><tr><th>Élève</th><th>Classe</th><th class="num">Total</th><th class="num">Justifiées</th><th class="num">Non justifiées</th></tr></thead>
        <tbody>
          ${topElevesAbsents.map((e) => `<tr>
            <td><strong>${e.nom}</strong></td>
            <td>${e.classe}</td>
            <td class="num" style="font-weight:800;color:${e.total >= 10 ? "#dc2626" : "#1e293b"}">${e.total}</td>
            <td class="num" style="color:#059669">${e.justif}</td>
            <td class="num" style="color:#dc2626">${e.nonJust}</td>
          </tr>`).join("")}
        </tbody>
      </table>`}`;
