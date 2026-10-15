// ══════════════════════════════════════════════════════════════
//  Préavis de renvoi pour impayés
// ══════════════════════════════════════════════════════════════
// Remis à l'élève en retard de scolarité (alerte mensualités) : mois
// impayés, reste dû, date limite de règlement avant renvoi, signatures
// (matrice « Qui signe quoi », document « preavis ») et un TALON que le
// parent signe et rapporte — la preuve que la famille a été prévenue.
//
// Même support que les reçus de l'appareil (recu-format.js) :
//  • « a4 » : 2, 3 ou 4 préavis par page A4 (`parPage`), à découper ;
//  • « 58 » / « 80 » : un ticket thermique par élève, coupé entre deux.

import { fmtN, getMonnaie, getSectionForClasse, today } from "../constants.js";
import { resolveLegalFields } from "../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML, printResetFor } from "./print-helpers.js";
import { blocsSignatures } from "./signatures.js";
import { enteteCompact } from "./recus/recu-blocs.js";
import { RECU_AJUSTEMENT } from "./recus/recus-styles.js";
import { TICKET_STYLES, normaliserLargeur } from "./recus/recu-ticket.js";

// Noms, tuteurs, contacts sont saisis à la main : un « < » ou un « & » ne
// doit ni casser la page ni y injecter de balise.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Date locale → « AAAA-MM-JJ » (valeur d'un champ date).
export const dateIso = (date) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

// Date limite proposée à l'impression : dans 7 jours.
export const dateLimiteParDefaut = (aujourdhui = new Date()) =>
  dateIso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 7));

// « 2026-10-22 » → « 22/10/2026 » ; une date déjà lisible passe telle quelle.
export const dateLimiteFr = (iso = "") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};

// Accord au sexe de l'élève quand il est connu.
const renvoye = (eleve = {}) => (eleve.sexe === "F" ? "renvoyée" : eleve.sexe === "M" ? "renvoyé" : "renvoyé(e)");

// Ce que chaque mise en page affiche, calculé une fois.
const donnees = ({ eleve = {}, mois = [], montant = 0 }, { schoolInfo = {}, dateLimite = "" }) => ({
  eleve,
  nom: `${echapper(eleve.nom)} ${echapper(eleve.prenom)}`.trim(),
  mois: mois.map(echapper).join(", "),
  nbMois: mois.length,
  reste: montant > 0 ? `${fmtN(montant)} ${echapper(schoolInfo.monnaie || getMonnaie())}` : "",
  limite: echapper(dateLimiteFr(dateLimite)),
  section: getSectionForClasse(eleve.classe),
});

const phraseRenvoi = (d) =>
  `Faute de règlement avant le <strong>${d.limite}</strong>, l'élève sera <strong>${renvoye(d.eleve)}</strong> jusqu'à régularisation de sa situation.`;

const phraseTalon = (d) =>
  `Je soussigné(e) ………………………………………………, parent / tuteur de <strong>${d.nom}</strong> (${echapper(d.eleve.classe) || "—"}), `
  + `reconnais avoir reçu le préavis de renvoi du ${today()}${d.reste ? ` : reste dû <strong>${d.reste}</strong>` : ""}, `
  + `à régler avant le <strong>${d.limite}</strong>.`;

// ── A4 : plusieurs préavis par page ─────────────────────────────
// 2 ou 3 empilés sur toute la largeur, 4 en grille 2 × 2. Chaque préavis
// garde un cadre fixe ; RECU_AJUSTEMENT réduit son contenu s'il déborde.
export const PREAVIS_PAR_PAGE = [2, 3, 4];
export const PREAVIS_PAR_PAGE_DEFAUT = 3;
const normaliserParPage = (n) => (PREAVIS_PAR_PAGE.includes(Number(n)) ? Number(n) : PREAVIS_PAR_PAGE_DEFAUT);

const STYLES_A4 = (c1, parPage) => `
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:6mm;background:#fff;color:#111}
    .page{height:282mm;display:grid;gap:3mm;break-after:page;page-break-after:always;
          grid-template-columns:${parPage === 4 ? "1fr 1fr" : "1fr"};
          grid-template-rows:repeat(${parPage === 4 ? 2 : parPage},minmax(0,1fr))}
    .page:last-of-type{break-after:auto;page-break-after:auto}
    .recu{min-height:0;overflow:hidden;padding:8px 12px;border:1px dashed #94a3b8;border-radius:3px;display:flex;flex-direction:column;position:relative}
    .recu.vide{border:none}
    .recu-corps{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}
    .badge{text-align:center;background:#9b2020;color:#fff;padding:5px;font-size:13px;font-weight:900;letter-spacing:.08em;margin:4px 0 2px;border-radius:3px}
    .sous-titre{text-align:center;font-size:9.5px;font-weight:700;color:#475569;margin-bottom:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;margin-bottom:6px}
    .row{font-size:10.5px}.lbl{font-weight:bold;color:${c1}}
    .texte{font-size:11px;line-height:1.55;margin:2px 0 4px}
    .alerte{margin:4px 0;padding:7px 10px;border:1.5px solid #9b2020;border-radius:3px;background:#fdf2f2;
            font-size:11.5px;line-height:1.5;color:#7f1d1d}
    .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:12px;margin-top:auto;padding-top:8px}
    .sig{border-top:1.5px solid ${c1};padding-top:4px;text-align:center;font-size:9.5px;color:#333;font-weight:600}
    .coupe{display:flex;align-items:center;gap:6px;margin:8px 0 5px;font-size:9px;color:#64748b}
    .coupe::before,.coupe::after{content:"";flex:1;border-top:1.5px dashed #94a3b8}
    .talon{font-size:10.5px;line-height:1.6}
    .talon-titre{font-weight:800;font-size:10px;letter-spacing:.05em;color:${c1};margin-bottom:2px}
    .talon-sig{display:flex;justify-content:space-between;margin-top:6px}`;

const preavisA4 = (r, options) => {
  const { schoolInfo = {}, annee = "" } = options;
  const d = donnees(r, options);
  const e = d.eleve;
  const ligne = (lbl, val) => `<div class="row"><span class="lbl">${lbl} : </span>${val || "—"}</div>`;
  return `
  <div class="recu">
    <div class="recu-corps">
      ${enteteCompact(schoolInfo, resolveLegalFields(schoolInfo))}
      <div class="badge">PRÉAVIS DE RENVOI</div>
      <div class="sous-titre">${[annee ? `Année scolaire ${echapper(annee)}` : "", `Fait à ${echapper(schoolInfo.ville || "—")}, le ${today()}`].filter(Boolean).join(" · ")}</div>
      <div class="grid">
        ${ligne("Élève", `<strong>${d.nom}</strong>`)}
        ${ligne("Matricule", echapper(e.matricule))}
        ${ligne("Classe", echapper(e.classe))}
        ${ligne("Parent / tuteur", echapper(e.tuteur))}
        ${ligne("Téléphone", echapper(e.contactTuteur))}
      </div>
      <div class="texte">Madame, Monsieur, la scolarité de votre enfant n'est pas à jour.<br/>
        <strong>Mois impayés (${d.nbMois})</strong> : ${d.mois}${d.reste ? `<br/><strong>Reste dû</strong> : <strong>${d.reste}</strong>` : ""}</div>
      <div class="alerte">${phraseRenvoi(d)}</div>
      <div class="sigs">${blocsSignatures(schoolInfo, "preavis",
        (identite, s) => `<div class="sig">${identite}<br/><br/><br/>Signature${s.role === "principal" ? " &amp; cachet" : ""}</div>`,
        { section: d.section })}</div>
      <div class="coupe">✂ à découper — talon à rapporter signé</div>
      <div class="talon">
        <div class="talon-titre">TALON — PRÉAVIS DE RENVOI · ${d.nom}</div>
        ${phraseTalon(d)}
        <div class="talon-sig"><span>Date : ………………………</span><span>Signature du parent : ………………………………</span></div>
      </div>
    </div>
  </div>`;
};

const documentA4 = (retards, options) => {
  const { schoolInfo = {} } = options;
  const parPage = normaliserParPage(options.parPage);
  const pages = [];
  for (let i = 0; i < retards.length; i += parPage) {
    const lot = retards.slice(i, i + parPage).map((r) => preavisA4(r, options));
    // Dernière page incomplète : des emplacements vides gardent chaque
    // préavis à sa taille (même découpe que les autres pages).
    while (lot.length < parPage) lot.push(`<div class="recu vide"></div>`);
    pages.push(`<div class="page">${lot.join("")}</div>`);
  }
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <title>Préavis de renvoi — ${echapper(schoolInfo.nom || "")}</title>
  <style>${PRINT_RESET}${STYLES_A4(schoolInfo.couleur1 || "#0A1628", parPage)}</style></head><body>
    ${pages.join("")}
    ${edugestBrandHTML(schoolInfo)}
    <script>${RECU_AJUSTEMENT}${PRINT_TRIGGER}</script>
  </body></html>`;
};

// ── Ticket thermique : un préavis par élève ─────────────────────
const preavisTicket = (r, options) => {
  const { schoolInfo = {} } = options;
  const d = donnees(r, options);
  const e = d.eleve;
  const contactEcole = [schoolInfo.telephone, schoolInfo.adresse || schoolInfo.ville]
    .filter((v) => String(v || "").trim()).map(echapper).join(" · ");
  const info = (lbl, val) => `<div class="t-info"><span>${lbl}</span><b>${val || "—"}</b></div>`;
  return `
  <div class="t-preavis">
    ${schoolInfo.logo ? `<img crossOrigin="anonymous" class="t-logo" src="${schoolInfo.logo}" alt=""/>` : ""}
    <div class="t-ecole">${echapper(schoolInfo.nom)}</div>
    ${contactEcole ? `<div class="t-sous">${contactEcole}</div>` : ""}
    <div class="t-titre">Préavis de renvoi</div>
    <div class="t-sep"></div>
    ${info("Élève", d.nom)}
    ${info("Matricule", echapper(e.matricule))}
    ${info("Classe", echapper(e.classe))}
    ${info("Parent", echapper(e.tuteur))}
    ${info("Date", today())}
    <div class="t-sep"></div>
    <div class="t-groupe">Mois impayés (${d.nbMois})</div>
    <div>${d.mois}</div>
    ${d.reste ? `<div class="t-total"><span>Reste dû</span><b>${d.reste}</b></div>` : ""}
    <div class="t-sep"></div>
    <div class="t-texte">${phraseRenvoi(d)}</div>
    ${blocsSignatures(schoolInfo, "preavis", (identite) => `<div class="t-sig">${identite}<br/><br/>…………………………</div>`, { section: d.section })}
    <div class="t-coupe">- - - - - ✂ - - - - -</div>
    <div class="t-groupe">Talon à rapporter signé</div>
    <div class="t-texte">${phraseTalon(d)}</div>
    <div class="t-sig">Date : …………………<br/><br/>Signature du parent :<br/><br/>…………………………</div>
  </div>`;
};

const documentTicket = (retards, options) => {
  const { schoolInfo = {}, format } = options;
  const largeurMm = normaliserLargeur(format);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Préavis de renvoi — ${echapper(schoolInfo.nom || "")}</title>
  <style>
    ${printResetFor(`size:${largeurMm}mm auto;margin:0`)}${TICKET_STYLES(largeurMm)}
    .t-preavis{break-after:page;page-break-after:always}
    .t-preavis:last-of-type{break-after:auto;page-break-after:auto}
    .t-texte{margin:3px 0;line-height:1.4}
    .t-sig{text-align:center;margin-top:8px}
    .t-coupe{text-align:center;margin:10px 0 4px}
  </style></head><body>
    ${retards.map((r) => preavisTicket(r, options)).join("")}
    <script>${PRINT_TRIGGER}</script>
  </body></html>`;
};

/**
 * Page complète des préavis — séparée de l'ouverture de fenêtre pour être
 * testable.
 * @param {{ eleve: Record<string, any>, mois: string[], montant: number }[]} retards
 * @param {{ schoolInfo?: Record<string, any>, annee?: string, dateLimite: string,
 *   format?: string, parPage?: number }} options — `dateLimite` en AAAA-MM-JJ ;
 *   `format` : « a4 », « 58 » ou « 80 » ; `parPage` (A4) : 2, 3 ou 4
 */
export function preavisRenvoiHTML(retards = [], options = {}) {
  return options.format === "58" || options.format === "80"
    ? documentTicket(retards, options)
    : documentA4(retards, options);
}

export function imprimerPreavisRenvoi(retards = [], options = {}) {
  if (!retards.length) { alert("Aucun élève à qui remettre un préavis."); return; }
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour imprimer."); return; }
  w.document.write(preavisRenvoiHTML(retards, options));
  w.document.close();
}
