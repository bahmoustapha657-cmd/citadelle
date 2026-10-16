// Impression de l'emploi du temps depuis les portails (enseignant, parent) :
// une grille horaires × jours sur une feuille A4 paysage, comme celle que
// l'école imprime pour une classe, au lieu d'une longue liste de lignes.
import { edugestBrandHTML, printResetFor } from "./print-helpers.js";
import {
  normaliserCreneau, joursAffiches, creneauxDuJour, tranchesPortail,
  planifierJour, palettePour, libellesCreneau, horaire, heuresSemaine,
} from "../edt-portail.js";

const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function grilleHtml(emplois, jours, mode, matiereParDefaut) {
  const tranches = tranchesPortail(emplois);
  const couleur = palettePour(emplois, mode === "enseignant" ? "classe" : "matiere");
  const plans = Object.fromEntries(jours.map((j) => [j, planifierJour(creneauxDuJour(emplois, j), tranches)]));
  const lignes = tranches.slice(0, -1).map((hd, i) => {
    const cases = jours.map((jour) => {
      const { debuts, occupees } = plans[jour];
      if (occupees.has(i)) return "";
      const debut = debuts.get(i);
      if (!debut) return "<td></td>";
      const c = debut.creneau;
      const col = couleur(c);
      const { titre, detail } = libellesCreneau(c, mode, matiereParDefaut);
      return `<td rowspan="${debut.span}"><div class="cr" style="background:${col.fond};border-left-color:${col.trait}">`
        + `<b style="color:${col.texte}">${echapper(titre)}</b>`
        + (c.type === "revision" ? ` <span class="rev">RÉV</span>` : "")
        + (detail ? `<span>${echapper(detail)}</span>` : "")
        + `<small>${echapper(horaire(c))}${c.salle ? ` · Salle ${echapper(c.salle)}` : ""}</small></div></td>`;
    }).join("");
    return `<tr><th class="h">${hd}<br/><small>${tranches[i + 1]}</small></th>${cases}</tr>`;
  }).join("");
  return `<table><colgroup><col style="width:19mm"/>${jours.map(() => "<col/>").join("")}</colgroup>`
    + `<tr><th class="t">Heure</th>${jours.map((j) => `<th class="t">${j}</th>`).join("")}</tr>${lignes}</table>`;
}

// `titre` : « Emploi du temps — M. Diallo » ; `sousTitre` : matière ou classe.
export function imprimerEdtPortail({ emplois: brut, joursOuvrables, mode, matiereParDefaut = "", titre, sousTitre, schoolInfo = {}, annee = "" }) {
  const emplois = brut.map(normaliserCreneau);
  const jours = joursAffiches(emplois, joursOuvrables);
  const w = window.open("", "_blank");
  if (!w) return;
  const ecole = [schoolInfo.nom, annee && `Année ${annee}`].filter(Boolean).map(echapper).join(" · ");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${echapper(titre)}</title><style>
${printResetFor("size:A4 landscape;margin:0")}
body{font-family:Arial,sans-serif;padding:10mm 10mm 6mm;margin:0;color:#0f172a}
.ent{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0A1628;padding-bottom:6px;margin-bottom:8px}
h1{margin:0;font-size:19px;color:#0A1628}.st{font-size:12px;color:#475569;margin-top:3px}.ec{font-size:11px;color:#475569;text-align:right}
table{border-collapse:collapse;width:100%;table-layout:fixed}
th.t{background:#0A1628;color:#fff;font-size:12px;padding:6px 4px}
th.h{background:#f1f5f9;font-size:11px;padding:4px;border:1px solid #cbd5e1;vertical-align:top}th.h small{color:#64748b;font-weight:400}
td{border:1px solid #cbd5e1;padding:2px;vertical-align:top;height:12mm}
.cr{height:100%;box-sizing:border-box;border-left:4px solid;border-radius:4px;padding:3px 5px;display:flex;flex-direction:column;gap:1px;font-size:10px}
.cr b{font-size:11px}.cr small{color:#475569}.rev{background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:0 3px;border-radius:3px;align-self:flex-start}
.pied{display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-top:6px}
button{margin-top:10px;padding:8px 16px}
</style></head><body>
<div class="ent"><div><h1>${echapper(titre)}</h1>${sousTitre ? `<div class="st">${echapper(sousTitre)}</div>` : ""}</div><div class="ec">${ecole}</div></div>
${grilleHtml(emplois, jours, mode, matiereParDefaut)}
<div class="pied"><span>${emplois.filter((c) => c.type !== "recreation").length} cours · ${heuresSemaine(emplois)} par semaine</span><span>Imprimé le ${new Date().toLocaleDateString("fr-FR")}</span></div>
${edugestBrandHTML(schoolInfo)}
<button class="no-print" onclick="window.print()">Imprimer</button>
</body></html>`);
  w.document.close();
}
