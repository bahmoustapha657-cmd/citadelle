// ══════════════════════════════════════════════════════════════
//  Impressions Portail Enseignant — EDT + fiches de paie
// ══════════════════════════════════════════════════════════════
// Documents générés depuis le portail enseignant. Extraits de
// PortailEnseignant.jsx au refactor découpage 2026-05-20.

import { groupSalariesByPersonMonth } from "../salary-utils.js";

// Formatage heure d'un créneau d'EDT (gestion des deux formats stockés :
// "heure" simple ou "heureDebut" + "heureFin").
function formatEmploiHeure(emploi) {
  if (emploi.heure) return emploi.heure;
  if (emploi.heureDebut || emploi.heureFin) {
    return [emploi.heureDebut || "", emploi.heureFin || ""].filter(Boolean).join(" - ");
  }
  return "-";
}

// Imprime l'emploi du temps complet de l'enseignant (table A4).
export function imprimerEdtEnseignant({ emplois, nomEns, matiere, schoolInfo, annee }) {
  const rows = emplois.map((emploi) => (
    `<tr><td>${emploi.jour || "-"}</td><td>${formatEmploiHeure(emploi)}</td><td>${emploi.classe || "-"}</td><td>${emploi.matiere || matiere || "-"}</td></tr>`
  )).join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>EDT - ${nomEns}</title><style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}button{display:none}}body{font-family:Arial,sans-serif;padding:14mm 12mm;margin:0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0dce8;padding:8px 10px;font-size:12px}th{background:#0A1628;color:#fff}</style></head><body><h2 style="color:#0A1628">Emploi du temps - ${nomEns}</h2><p style="color:#555">${matiere} - ${schoolInfo.nom} - ${annee}</p><table><tr><th>Jour</th><th>Heure</th><th>Classe</th><th>Matiere</th></tr>${rows}</table><br/><button onclick="window.print()">Imprimer</button></body></html>`);
  w.document.close();
}

// Imprime un récapitulatif des fiches de paie sur l'année. Un mois =
// 1 ligne consolidée ; si l'enseignant cumule plusieurs fonctions
// (ex: secondaire + personnel), on ajoute des sous-lignes par source.
export function imprimerPaiesEnseignant({ salaires, nomEns, matiere, schoolInfo, annee }) {
  const groupes = groupSalariesByPersonMonth(salaires);
  const lignes = groupes.map((g) => {
    const sections = g.sections.join(" + ") || "—";
    const detail = g.parts.length === 1
      ? (() => {
          const s = g.parts[0];
          const heuresExec = Number(s.vhPrevu || 0) + Number(s.cinqSem || 0) - Number(s.nonExecute || 0);
          return s.section === "Secondaire"
            ? (s.primesVariables ? `${heuresExec} h - primes variables` : `${heuresExec} h x ${(s.primeHoraire || 0).toLocaleString("fr-FR")} GNF`)
            : `Forfait ${Number(s.montantForfait || 0).toLocaleString("fr-FR")} GNF`;
        })()
      : g.parts.map((s) => {
          const heuresExec = Number(s.vhPrevu || 0) + Number(s.cinqSem || 0) - Number(s.nonExecute || 0);
          const lib = s.section === "Secondaire"
            ? `${heuresExec} h x ${(s.primeHoraire || 0).toLocaleString("fr-FR")} GNF`
            : `Forfait ${Number(s.montantForfait || 0).toLocaleString("fr-FR")} GNF`;
          return `<div style="font-size:11px;color:#475569">• ${s.section} : ${lib}</div>`;
        }).join("");
    return `<tr><td>${g.mois}</td><td>${sections}</td><td>${detail}</td><td>${g.totalBon > 0 ? `-${g.totalBon.toLocaleString("fr-FR")}` : "-"}</td><td>${g.totalRevision > 0 ? `+${g.totalRevision.toLocaleString("fr-FR")}` : "-"}</td><td style="font-weight:900;color:#0A1628">${g.totalNet.toLocaleString("fr-FR")} GNF</td></tr>`;
  }).join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Paies - ${nomEns}</title><style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}button{display:none}}body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:13px;margin:0}h2{color:#0A1628}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px 10px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}</style></head><body><h2>${schoolInfo.nom || "Ecole"} - Fiches de paie</h2><p>${nomEns} - ${matiere || "Enseignant"} - Annee ${annee}</p><table><tr><th>Mois</th><th>Fonction(s)</th><th>Detail</th><th>Bon</th><th>Revision</th><th>Net a payer</th></tr>${lignes}</table><br/><button onclick="window.print()">Imprimer</button></body></html>`);
  w.document.close();
}
