// ══════════════════════════════════════════════════════════════
//  Situation des dispenses de paiement — fenêtre « 🎓 Dispenses »
// ══════════════════════════════════════════════════════════════
// Calculs : components/comptabilite/mensualites-tab/situation-dispenses.js.
//  • detail « eleves » : les élèves dispensés, classe par classe — taux de
//    chaque poste, motif, qui l'a accordée et quand, manque à gagner, puis à
//    payer / payé / reste et l'état (tout payé, à jour, mois en retard) —,
//    avec un sous-total par classe et le total, puis les statistiques ;
//  • detail « stats » : les statistiques seules.
// Statistiques : vue d'ensemble, par poste, état des paiements des dispensés,
// ce qu'ils paient poste par poste, par motif, par classe et, à plusieurs
// sections, par section. Puis, si demandé, les demandes de la comptabilité
// en attente ou refusées. Signatures : comptable et Direction.

import { fmtN, getMonnaie, today } from "../constants.js";
import { STATUT_REFUSEE } from "../demande-dispense.js";
import { celluleEleve, echapper, ouvrir, pageListe } from "./listes-mensualites.js";
import { tr } from "./print-helpers.js";

const POSTES = ["mensualites", "inscription", "fraisAnnexes"];

// Part en pourcentage arrondi ; « — » sans rien à compter.
const part = (n, sur) => (sur > 0 ? tr("reports.situation.taux", { n: Math.round((n * 100) / sur) }) : "—");
// Total d'une colonne de parts : 100 %, ou « — » si elle est vide.
const toutOuRien = (n) => (n > 0 ? tr("reports.situation.taux", { n: 100 }) : "—");

const libellePoste = (poste) => echapper(tr(`accounting.exempt.post.${poste}`));
const libelleMotif = (motif) => echapper(tr(`accounting.exempt.reason.${motif || "autre"}`, {
  defaultValue: tr("accounting.exempt.reason.autre"),
}));
const nomClasse = (classe) => echapper(classe) || tr("reports.listeMois.sansClasse");
const nomSection = (section) => echapper(tr(`accounting.sections.${section}`, { defaultValue: section }));

// Taux d'un poste dans la liste : 100 % en gras, « — » s'il n'est pas dispensé.
const celluleTaux = (taux) => (taux >= 100
  ? `<td class="c tot">${tr("reports.situation.taux", { n: taux })}</td>`
  : taux > 0 ? `<td class="c">${tr("reports.situation.taux", { n: taux })}</td>` : `<td class="c vide">—</td>`);

// « Mensualités 100 % · Inscription 50 % » d'une demande.
const resumeDemande = (d) => POSTES.filter((p) => d[p] > 0)
  .map((p) => tr("accounting.exempt.summaryItem", { label: libellePoste(p), rate: d[p] })).join(" · ");

// État des paiements d'un dispensé, sous son reste : « ✔ Tout payé »,
// « À jour », « ⚠ 2 mois en retard (100 000) », « Rien à payer ».
const libelleEtat = (l) => (l.etat === "retard"
  ? `<span class="ko">${tr("reports.dispenses.etatRetardMois", { n: l.moisRetard, montant: fmtN(l.montantRetard) })}</span>`
  : `<span class="${l.etat === "solde" ? "ok" : "mat"}">${tr(`reports.dispenses.etat.${l.etat}`)}</span>`);

// Manque à gagner, à payer, payé, reste : les quatre montants d'une ligne,
// d'un sous-total ou du total.
const cellulesMontants = (x) => ["montant", "aPayer", "paye", "reste"]
  .map((champ) => `<td class="m">${fmtN(x[champ])}</td>`).join("");

// Liste des élèves dispensés, rangés par classe : la dispense (taux, motif,
// qui l'a accordée), ce qu'elle coûte à l'école, puis ce que l'élève doit
// encore payer, ce qu'il a payé et ce qui lui reste, avec son état.
function tableauEleves(groupes, total, monnaie) {
  const accordee = (l) => (l.accordeePar || l.accordeeLe
    ? `<br/><span class="mat">${tr("reports.dispenses.accordeeParLe", {
      author: echapper(l.accordeePar) || "—", date: echapper(l.accordeeLe) || "—",
    })}</span>`
    : "");
  const ligne = (l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${celluleEleve(l.eleve)}</td>
      ${POSTES.map((p) => celluleTaux(l.taux[p])).join("")}
      <td>${libelleMotif(l.motif)}${l.precision ? `<br/><span class="mat">${echapper(l.precision)}</span>` : ""}${accordee(l)}</td>
      <td class="m">${fmtN(l.total)}</td>
      <td class="m">${fmtN(l.aPayer)}</td>
      <td class="m">${fmtN(l.paye)}<br/><span class="mat">${[
  l.aPayer > 0 ? tr("reports.dispenses.partPayee", { part: part(l.paye, l.aPayer) }) : "",
  // Dispensé de tous les mois : pas de « 0 mois payé ».
  l.paiement.mensualites.aPayer > 0 ? tr("reports.dispenses.moisPayes", { n: l.moisPayes }) : "",
].filter(Boolean).join(" · ")}</span></td>
      <td class="m">${fmtN(l.reste)}<br/>${libelleEtat(l)}</td>
    </tr>`;
  const corps = groupes.map((g) => `<tr class="grp"><td colspan="10">${tr("reports.dispenses.grpClasse", {
    classe: nomClasse(g.classe), n: g.dispenses, effectif: g.effectif, part: part(g.dispenses, g.effectif),
  })}</td></tr>
    ${g.lignes.map(ligne).join("")}
    <tr class="st"><td colspan="6">${tr("reports.dispenses.sousTotal", { classe: nomClasse(g.classe) })}</td>${cellulesMontants(g)}</tr>`).join("");
  return `<table class="liste">
    <thead><tr><th class="c">${tr("reports.rowNumber")}</th><th>${tr("reports.studentName")}</th>
      ${POSTES.map((p) => `<th class="c">${libellePoste(p)}</th>`).join("")}
      <th>${tr("reports.dispenses.colMotifAccordee")}</th>
      <th>${tr("reports.dispenses.colManque", { monnaie })}</th>
      <th>${tr("reports.dispenses.colAPayer", { monnaie })}</th>
      <th>${tr("reports.dispenses.colPaye", { monnaie })}</th>
      <th>${tr("reports.dispenses.colReste", { monnaie })}</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td colspan="6">${tr("reports.dispenses.totalGeneral", { n: total.dispenses })}</td>${cellulesMontants(total)}</tr></tfoot>
  </table>`;
}

// Ce que paient les dispensés, poste par poste : la part laissée à la
// famille, ce qu'elle a payé (et quelle part) et ce qui lui reste.
function tableauPaiements(total, monnaie) {
  const cellules = (x) => `<td class="m">${fmtN(x.aPayer)}</td><td class="m">${fmtN(x.paye)}</td>
    <td class="c">${part(x.paye, x.aPayer)}</td><td class="m">${fmtN(x.reste)}</td>`;
  return `<table class="stats">
    <caption>${tr("reports.dispenses.paiementsTitre")}</caption>
    <thead><tr><th>${tr("reports.dispenses.colPoste")}</th><th>${tr("reports.dispenses.colAPayer", { monnaie })}</th>
      <th>${tr("reports.dispenses.colPaye", { monnaie })}</th><th class="c">${tr("reports.dispenses.colPartPayee")}</th>
      <th>${tr("reports.dispenses.colReste", { monnaie })}</th></tr></thead>
    <tbody>${POSTES.map((p) => `<tr><td>${libellePoste(p)}</td>${cellules(total.paiement[p])}</tr>`).join("")}</tbody>
    <tfoot><tr><td>${tr("common.total")}</td>${cellules(total)}</tr></tfoot>
  </table>`;
}

// Où en sont les dispensés : tout payé, à jour, en retard, rien à payer —
// et ceux qui n'ont encore rien payé.
function tableauEtats(total, monnaie) {
  const ligne = (libelle, n, classe = "") => `<tr><td${classe ? ` class="${classe}"` : ""}>${libelle}</td>
    <td class="c">${n}</td><td class="c">${part(n, total.dispenses)}</td></tr>`;
  return `<table class="stats ensemble">
    <caption>${tr("reports.dispenses.etatsTitre")}</caption>
    <thead><tr><th>${tr("reports.dispenses.colEtat")}</th><th class="c">${tr("reports.dispenses.colEleves")}</th>
      <th class="c">${tr("reports.dispenses.colPartDispenses")}</th></tr></thead>
    <tbody>
      ${ligne(tr("reports.dispenses.etat.solde"), total.etats.solde, "ok")}
      ${ligne(tr("reports.dispenses.etat.ajour"), total.etats.ajour)}
      ${ligne(tr("reports.dispenses.etat.retard"), total.etats.retard, "ko")}
      ${ligne(tr("reports.dispenses.etat.rien"), total.etats.rien)}
      ${ligne(tr("reports.dispenses.rienPaye"), total.rienPaye)}
      <tr><td>${tr("reports.dispenses.montantRetard", { monnaie })}</td><td class="m" colspan="2">${fmtN(total.montantRetard)}</td></tr>
    </tbody>
  </table>`;
}

// Vue d'ensemble : les chiffres que la Direction cherche d'abord.
function tableauEnsemble(total, demandes, monnaie) {
  const attente = demandes.filter((d) => d.demande.statut !== STATUT_REFUSEE).length;
  const refusees = demandes.length - attente;
  const lignes = [
    [tr("reports.dispenses.effectif"), total.effectif],
    [tr("reports.dispenses.dispenses"), tr("reports.dispenses.partEffectif", { n: total.dispenses, part: part(total.dispenses, total.effectif) })],
    [tr("reports.dispenses.manqueTotal", { monnaie }), fmtN(total.montant)],
    [tr("reports.dispenses.manqueMoyen", { monnaie }), total.dispenses ? fmtN(Math.round(total.montant / total.dispenses)) : "—"],
    [tr("reports.dispenses.moisDispenses"), total.moisDispenses],
    [tr("reports.dispenses.demandesAttente"), attente],
    [tr("reports.dispenses.demandesRefusees"), refusees],
  ];
  return `<table class="stats ensemble">
    <caption>${tr("reports.dispenses.vueEnsemble")}</caption>
    <tbody>${lignes.map(([libelle, valeur]) => `<tr><td>${libelle}</td><td class="m">${valeur}</td></tr>`).join("")}</tbody>
  </table>`;
}

// Par poste : combien sont dispensés de chaque poste, en totalité ou en
// partie, à quel taux moyen, et ce que cela représente.
function tableauPostes(total, monnaie) {
  const lignes = POSTES.map((p) => {
    const s = total.parPoste[p];
    return `<tr><td>${libellePoste(p)}</td><td class="c">${s.eleves}</td><td class="c">${s.totale}</td>
      <td class="c">${s.partielle}</td><td class="c">${s.eleves ? tr("reports.situation.taux", { n: s.tauxMoyen }) : "—"}</td>
      <td class="m">${fmtN(s.montant)}</td><td class="c">${part(s.montant, total.montant)}</td></tr>`;
  }).join("");
  return `<table class="stats">
    <caption>${tr("reports.dispenses.parPoste")}</caption>
    <thead><tr><th>${tr("reports.dispenses.colPoste")}</th><th class="c">${tr("reports.dispenses.colEleves")}</th>
      <th class="c">${tr("reports.dispenses.colTotale")}</th><th class="c">${tr("reports.dispenses.colPartielle")}</th>
      <th class="c">${tr("reports.dispenses.colTauxMoyen")}</th><th>${tr("reports.dispenses.colManque", { monnaie })}</th>
      <th class="c">${tr("reports.dispenses.colPartManque")}</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td colspan="5">${tr("common.total")}</td><td class="m">${fmtN(total.montant)}</td><td class="c">${toutOuRien(total.montant)}</td></tr></tfoot>
  </table>`;
}

// Par motif : pourquoi l'école dispense, et ce que coûte chaque raison.
function tableauMotifs(total, monnaie) {
  const corps = total.parMotif.length
    ? total.parMotif.map((m) => `<tr><td>${libelleMotif(m.motif)}</td><td class="c">${m.eleves}</td>
      <td class="c">${part(m.eleves, total.dispenses)}</td><td class="m">${fmtN(m.montant)}</td>
      <td class="c">${part(m.montant, total.montant)}</td></tr>`).join("")
    : `<tr><td colspan="5" class="c vide">${tr("reports.dispenses.aucunDispense")}</td></tr>`;
  return `<table class="stats">
    <caption>${tr("reports.dispenses.parMotif")}</caption>
    <thead><tr><th>${tr("reports.dispenses.colMotif")}</th><th class="c">${tr("reports.dispenses.colEleves")}</th>
      <th class="c">${tr("reports.dispenses.colPartDispenses")}</th><th>${tr("reports.dispenses.colManque", { monnaie })}</th>
      <th class="c">${tr("reports.dispenses.colPartManque")}</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td>${tr("common.total")}</td><td class="c">${total.dispenses}</td><td class="c">${toutOuRien(total.dispenses)}</td>
      <td class="m">${fmtN(total.montant)}</td><td class="c">${toutOuRien(total.montant)}</td></tr></tfoot>
  </table>`;
}

// Par classe (toutes les classes de l'année, même sans dispensé) ou par
// section : effectif, dispensés, part de l'effectif, dispensés de chaque
// poste, manque à gagner, puis ce que les dispensés ont payé, ce qui leur
// reste et combien sont en retard.
function tableauGroupes(groupes, total, { titre, colonne, nom, monnaie }) {
  const cellules = (g) => `<td class="c">${g.effectif}</td><td class="c"><strong>${g.dispenses}</strong></td>
    <td class="c">${part(g.dispenses, g.effectif)}</td>
    ${POSTES.map((p) => `<td class="c">${g.parPoste[p].eleves}</td>`).join("")}
    <td class="m">${fmtN(g.montant)}</td><td class="m">${fmtN(g.paye)}</td><td class="m">${fmtN(g.reste)}</td>
    <td class="c${g.etats.retard ? " ko" : ""}">${g.etats.retard}</td>`;
  return `<table class="stats">
    <caption>${titre}</caption>
    <thead><tr><th>${colonne}</th><th class="c">${tr("reports.dispenses.colEffectif")}</th>
      <th class="c">${tr("reports.dispenses.colDispenses")}</th><th class="c">${tr("reports.dispenses.colPartEffectif")}</th>
      ${POSTES.map((p) => `<th class="c">${libellePoste(p)}</th>`).join("")}
      <th>${tr("reports.dispenses.colManque", { monnaie })}</th>
      <th>${tr("reports.dispenses.colPaye", { monnaie })}</th><th>${tr("reports.dispenses.colReste", { monnaie })}</th>
      <th class="c">${tr("reports.dispenses.colRetard")}</th></tr></thead>
    <tbody>${groupes.map((g) => `<tr><td><strong>${nom(g)}</strong></td>${cellules(g)}</tr>`).join("")}</tbody>
    <tfoot><tr><td>${tr("common.total")}</td>${cellules(total)}</tr></tfoot>
  </table>`;
}

// Demandes de la comptabilité : en attente, puis refusées avec la raison.
function tableauDemandes(demandes) {
  const ligne = ({ eleve, demande: d }, i) => {
    const etat = d.statut === STATUT_REFUSEE
      ? `<span class="ko">${tr("reports.dispenses.refusee", {
        author: echapper(d.refuseePar) || "—", date: echapper(d.refuseeLe) || "—", reason: echapper(d.motifRefus) || "—",
      })}</span>`
      : `<span class="att">${tr("reports.dispenses.enAttente")}</span>`;
    return `<tr><td class="c">${i + 1}</td><td>${celluleEleve(eleve)}</td><td class="c">${nomClasse(eleve.classe)}</td>
      <td>${resumeDemande(d)}<br/><span class="mat">${libelleMotif(d.motif)}${d.precision ? ` — ${echapper(d.precision)}` : ""}</span></td>
      <td class="signe">${echapper(d.demandeePar) || "—"}${d.demandeeLe ? `<br/><span class="mat">${echapper(d.demandeeLe)}</span>` : ""}</td>
      <td>${etat}</td></tr>`;
  };
  return `<h3>${tr("reports.dispenses.demandesTitre", { n: demandes.length })}</h3>
    <table><thead><tr><th class="c">${tr("reports.rowNumber")}</th><th>${tr("reports.studentName")}</th>
      <th class="c">${tr("reports.class")}</th><th>${tr("reports.dispenses.colProposition")}</th>
      <th>${tr("reports.dispenses.colDemandee")}</th><th>${tr("reports.dispenses.colEtat")}</th></tr></thead>
    <tbody>${demandes.map(ligne).join("")}</tbody></table>`;
}

/**
 * Situation des dispenses (calculs : situationDispenses de
 * components/comptabilite/mensualites-tab/situation-dispenses.js).
 * @param {{ groupes: Record<string, any>[], classes: Record<string, any>[], sections: Record<string, any>[],
 *   total: Record<string, any>, demandes: Record<string, any>[] }} situation
 * @param {{ detail?: string, avecDemandes?: boolean, schoolInfo?: Record<string, any>, annee?: string,
 *   perimetre?: string }} options
 */
export function situationDispensesHTML(situation, { detail = "eleves", avecDemandes = true, ...options } = {}) {
  const { groupes = [], classes = [], sections = [], total, demandes = [] } = situation || {};
  const monnaie = echapper(options.schoolInfo?.monnaie || getMonnaie());
  const liste = detail === "eleves"
    ? (groupes.length ? tableauEleves(groupes, total, monnaie) : `<p class="vide-liste">${tr("reports.dispenses.aucunDispense")}</p>`)
    : "";
  const statistiques = `<div>
    <h3>${tr("reports.dispenses.statsTitre")}</h3>
    <div class="duo">${tableauEnsemble(total, demandes, monnaie)}${tableauPostes(total, monnaie)}</div>
    <div class="duo">${tableauEtats(total, monnaie)}${tableauPaiements(total, monnaie)}</div>
    ${tableauMotifs(total, monnaie)}
    ${sections.length > 1 ? tableauGroupes(sections, total, {
    titre: tr("reports.dispenses.parSection"), colonne: tr("reports.dispenses.colSection"), nom: (g) => nomSection(g.section), monnaie,
  }) : ""}
    ${tableauGroupes(classes, total, {
    titre: tr("reports.dispenses.parClasse", { n: classes.length }), colonne: tr("reports.class"), nom: (g) => nomClasse(g.classe), monnaie,
  })}
  </div>`;
  const blocDemandes = avecDemandes && demandes.length ? tableauDemandes(demandes) : "";
  const pied = `<div class="pied"><span>${tr("reports.dispenses.imprimeLe", { date: today() })}</span>
    <span><strong>${tr("reports.dispenses.signatureComptable")}</strong><br/><br/><br/></span>
    <span><strong>${tr("reports.dispenses.signatureDirection")}</strong><br/><br/><br/></span></div>`;
  return pageListe({
    ...options,
    couleur: "#0f4c81",
    titre: tr("reports.dispenses.titre"),
    titreFenetre: tr("reports.dispenses.fenetre"),
    note: [
      tr("reports.dispenses.noteTaux"), tr("reports.dispenses.noteManque"),
      tr("reports.dispenses.notePaiement"), tr("reports.dispenses.noteEffectif"),
    ].join("<br/>"),
    tableau: liste + statistiques + blocDemandes,
    pied,
    css: `td{vertical-align:middle}
      td.tot{color:#166534;font-weight:900} td.vide{color:#94a3b8}
      td.signe{font-size:10px;white-space:nowrap}
      table.liste td{font-size:10.5px} table.liste td.m .mat,table.liste td.m span{font-weight:700;white-space:normal}
      .ok{color:#166534;font-weight:700} .ko{color:#b91c1c;font-weight:700} .att{color:#92400e;font-weight:700}
      tr.grp td{background:#e2e8f0!important;font-weight:900;font-size:11.5px;padding:5px 6px}
      tr.st td{background:#f1f5f9!important;font-weight:800}
      .vide-liste{text-align:center;color:#64748b;font-weight:700;margin:16px 0}
      h3{font-size:13px;margin:18px 0 6px;color:#0f4c81}
      .duo{display:flex;gap:12px;align-items:flex-start}
      .duo table.ensemble{flex:0 0 38%} .duo table.stats:not(.ensemble){flex:1}
      table.stats{margin-top:10px;break-inside:avoid;page-break-inside:avoid}
      table.stats caption{caption-side:top;text-align:start;font-weight:900;font-size:12px;color:#0f4c81;padding:4px 0}
      table.stats td{padding:3px 6px}
      table.ensemble td:first-child{font-weight:700}`,
  });
}

export function imprimerSituationDispenses(situation, options) {
  if (!situation?.total?.effectif) { alert(tr("reports.dispenses.aucun")); return; }
  ouvrir(situationDispensesHTML(situation, options));
}
