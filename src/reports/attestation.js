// ══════════════════════════════════════════════════════════════
//  Attestation de niveau
// ══════════════════════════════════════════════════════════════
// Document remis à l'élève et présenté À L'EXTÉRIEUR de l'école (autre
// établissement, administration, concours). D'où : un numéro de pièce, un QR
// de vérification comme les bulletins et reçus, et une formule administrative
// en une seule phrase continue.

import { anneeScolaireDeDate, estSorti, getAnnee, today } from "../constants.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileVide,
  mapNiveauToCycle,
} from "../legal-utils.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  signataireIdentite,
  signataireSection,
  tr,
  watermarkHtml,
  edugestBrandHTML,
} from "./print-helpers.js";
import { qrPayload, qrSecuriseImgHtml } from "./qr.js";
import { formatMoyenneAnnuelle, getMoyenneAttestation } from "./attestation/attestation-moyenne.js";

// `niveau` = identifiant de section ("prescolaire" | "primaire" | "college" |
// "lycee"). Le collège et le lycée partagent le libellé « Secondaire », comme
// avant ; seule la maternelle, qui tombait dans le repli « Primaire », a
// désormais le sien.
const CLE_LABEL_NIVEAU = {
  prescolaire: "dashboard.preschool",
  primaire: "dashboard.primary",
  college: "dashboard.secondary",
  lycee: "dashboard.secondary",
};

// Numéro de pièce, même forme que le bulletin (BUL-…) : déterministe, donc
// deux impressions de la même attestation portent le même numéro.
const numeroAttestation = (eleve, schoolInfo, annee) => {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const ref = eleve.matricule || String(eleve._id || "").slice(-6).toUpperCase();
  return `ATT-${code}-${an}-${ref}`;
};

// Les dates de l'application viennent d'un <input type="date"> : elles sont
// stockées en ISO (2025-09-12). Sur une pièce administrative on écrit
// 12/09/2025. Toute valeur qui n'est pas de l'ISO est rendue telle quelle
// (saisies anciennes, imports Excel déjà au format local).
const dateFr = (valeur) => {
  const v = String(valeur ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : v;
};

// Une ligne de l'encadré d'identité : libellé, conducteur pointillé, valeur.
// Les lignes sans valeur DISPARAISSENT au lieu d'imprimer un tiret : sur une
// pièce officielle, une rubrique vide se remplit à la main ou n'existe pas.
const ligneInfo = (label, valeur, fort = false) => {
  const v = String(valeur ?? "").trim();
  if (!v) return "";
  // Valeur longue (filiation complète : « Père : … / Mère : … ») : alignée à
  // droite derrière un conducteur, elle passe à la ligne et abandonne un mot
  // orphelin contre la marge. On la déroule alors à la suite du libellé.
  const longue = v.length > 42;
  const val = fort ? `<strong>${v}</strong>` : v;
  return `<div class="row${longue ? " row-longue" : ""}">`
    + `<span class="lbl">${label}</span>`
    + (longue ? "" : `<span class="fil"></span>`)
    + `<span class="val">${val}</span></div>`;
};

// `options` : { notes, notesPrecedentes, matieres, periodes, maxNote } —
// fournis par l'onglet Attestations. Absents (appel historique), la moyenne
// annuelle est simplement omise du document.
export const imprimerAttestation = async (eleve, niveau, annee, schoolInfo = {}, options = {}) => {
  const { notes = [], notesPrecedentes = [], matieres = [], periodes = [], maxNote = 20 } = options;
  // Couleurs de l'école (Paramètres → Identité), même repli que les bulletins,
  // le livret et les cartes : le document appartient à l'ÉCOLE, pas à EduGest.
  // Le vert du bloc « moyenne annuelle » reste, lui, sémantique — comme les
  // mentions des bulletins, il dit un résultat et ne suit pas la charte.
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const niveauLabel = tr(CLE_LABEL_NIVEAU[niveau] || "dashboard.primary");
  const anneeScolaire = annee || getAnnee();
  const arrivee = dateFr(eleve.dateArrivee);
  const depart = dateFr(eleve.dateDepart);

  // Année scolaire que le document CERTIFIE — distincte de celle de l'écran.
  // Un élève parti en février 2026 dont on réimprime l'attestation en
  // 2026-2027 relève de 2025-2026 : c'est cette année-là qui doit figurer au
  // numéro de pièce et dans le QR, sans quoi la pièce se référence sous une
  // année où l'élève n'était plus là. Sans date de départ exploitable, on n'a
  // rien de mieux que l'année de l'écran.
  const anneeAttestee = (estSorti(eleve) && anneeScolaireDeDate(eleve.dateDepart)) || anneeScolaire;
  const numero = numeroAttestation(eleve, schoolInfo, anneeAttestee);

  // Moyenne de l'année en cours, ou à défaut de l'année écoulée : `anneeMoyenne`
  // dit toujours à quelle année le chiffre imprimé se rapporte.
  const { moyenne, annee: anneeMoyenne } = getMoyenneAttestation({
    eleve, matieres, periodes, niveau, annee: anneeScolaire, notes, notesPrecedentes,
  });
  const moyenneTexte = formatMoyenneAnnuelle(moyenne, maxNote);
  // Ce que le document CERTIFIE exactement.
  //
  // Pour un élève parti, l'année scolaire en cours est un contresens : celui
  // qui est arrivé en septembre 2025 et parti en février 2026 n'a jamais été
  // inscrit en 2026-2027, année de l'écran d'où l'on imprime. On atteste donc
  // la PÉRIODE réellement passée dans l'établissement, et l'année scolaire ne
  // sert plus que lorsqu'on ignore ces dates.
  //
  // Le passé se déclenche sur un statut de sortie autant que sur une date :
  // la date de départ est facultative, un élève « Transféré » sans date reste
  // un élève parti et ne peut pas être certifié inscrit aujourd'hui.
  // `fort` met en évidence ce que le document certifie — la période ou l'année.
  const fort = (v) => `<strong>${v}</strong>`;
  const formuleEnrolement = (() => {
    if (!estSorti(eleve)) {
      // Élève présent : la date d'arrivée devient une ancienneté, ce qui fait
      // de l'attestation une preuve de scolarité CONTINUE et non plus du seul
      // millésime en cours.
      return arrivee
        ? tr("reports.attestation.enrolledSince", { du: fort(arrivee), annee: fort(anneeScolaire) })
        : tr("reports.attestation.enrolled", { annee: fort(anneeScolaire) });
    }
    if (arrivee && depart) return tr("reports.attestation.enrolledFromTo", { du: fort(arrivee), au: fort(depart) });
    if (depart) return tr("reports.attestation.enrolledUntil", { au: fort(depart) });
    return tr("reports.attestation.enrolledPast", { annee: fort(anneeAttestee) });
  })();

  // Qui atteste. La formule d'ouverture nomme le signataire et son VRAI poste
  // — « Djiba Oury Diallo, La Principale » — au lieu du « Directeur » générique :
  // c'est le même responsable de section que le bloc de signature en bas de
  // page, les deux ne peuvent donc pas se contredire. Sans responsable désigné
  // dans Comptes & Postes, on retombe sur le titre générique, sans nom.
  const signataire = signataireIdentite(schoolInfo, niveau, tr("reports.director"));
  const formuleCertifie = signataire.nom
    ? tr("reports.attestation.certifiesNamed", { nom: signataire.nom, poste: signataire.titre })
    : tr("reports.attestation.certifies", { poste: signataire.titre });

  // Fenêtre ouverte AVANT l'await du QR (geste utilisateur) : sinon le
  // navigateur classe l'ouverture comme popup et la bloque.
  const w = window.open("", "_blank");
  if (!w) return;

  // QR chiffré : même scanner que les bulletins et les reçus. Il porte ce que
  // l'on peut contester sur le papier — identité, classe, année, moyenne, et
  // la période de scolarité quand elle est renseignée (qrPayload ignore les
  // champs vides, le QR ne s'alourdit donc pas pour rien).
  const qr = await qrSecuriseImgHtml(qrPayload({
    EduGest: "Attestation",
    Num: numero,
    Ecole: schoolInfo.nom,
    Eleve: `${eleve.nom || ""} ${eleve.prenom || ""}`,
    IEN: eleve.ien,
    Classe: eleve.classe,
    Annee: anneeAttestee,
    Moy: moyenneTexte,
    Du: arrivee,
    Au: depart,
  }), schoolInfo, { size: 84, alt: "QR attestation" });

  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${tr("reports.attestation.title")} — ${eleve.nom || ""}</title>
  <meta charset="utf-8"/>
  <style>${PRINT_RESET}
  /* Le cadre double (filet fin extérieur + filet épais intérieur) est ce qui
     distingue une pièce officielle d'une page imprimée : il tient la page
     entière, la marge d'impression étant à 0 (@page). */
  body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8mm;background:#fff;font-size:13px}
  .feuille{border:1px solid ${c1};padding:3px;min-height:281mm;display:flex}
  .feuille-int{border:2.5px solid ${c1};padding:11mm 12mm 8mm;flex:1;display:flex;flex-direction:column;position:relative}
  .contenu{max-width:640px;margin:0 auto;width:100%;flex:1;display:flex;flex-direction:column}

  /* Titre gravé : filets latéraux + losange, capitales très espacées. */
  .titre{display:flex;align-items:center;gap:12px;justify-content:center;margin:14px 0 4px}
  .titre::before,.titre::after{content:"";height:1px;background:linear-gradient(90deg,transparent,${c1});flex:1;max-width:90px}
  .titre::after{background:linear-gradient(90deg,${c1},transparent)}
  .titre h2{color:${c1};font-size:19px;text-transform:uppercase;letter-spacing:4px;margin:0;font-weight:800;white-space:nowrap}
  .losange{color:${c2};font-size:10px;letter-spacing:6px;text-align:center;margin-top:2px}
  .numero{text-align:center;font-size:10.5px;color:#64748b;font-family:"Courier New",monospace;
          letter-spacing:.08em;margin:4px 0 16px}

  /* Corps en serif : une formule administrative se lit mieux, et se distingue
     nettement des libellés du formulaire restés en sans-serif. */
  .formule{font-family:Georgia,"Times New Roman",serif;line-height:1.95;font-size:14px;
           text-align:justify;margin:0 0 10px;color:#111}
  .formule strong{color:${c1}}

  /* Conducteurs pointillés : le libellé, la ligne de conduite, la valeur —
     c'est la grammaire visuelle d'un acte, pas d'un écran. */
  /* Filet et lavis dérivés de la couleur de l'école (alpha hex) plutôt que
     figés en bleu : sur une école aux couleurs chaudes, un encadré bleuté
     jurait avec le reste du document. */
  .infos{margin:2px 0 12px;padding:12px 16px;border:1px solid ${c1}33;border-radius:6px;
         border-inline-start:4px solid ${c1};background:${c1}0a}
  .row{display:flex;align-items:baseline;gap:8px;font-size:13px;margin:5px 0;line-height:1.6}
  .lbl{font-weight:bold;color:${c1};flex-shrink:0}
  .lbl::after{content:" :"}
  .fil{flex:1;border-bottom:1px dotted #94a3b8;min-width:14px;transform:translateY(-3px)}
  .val{flex-shrink:0;max-width:62%;text-align:end;color:#1f2937}
  .row-longue .val{flex:1;max-width:none;text-align:start;text-wrap:balance}
  .val strong{color:${c1};font-size:14px;letter-spacing:.02em}

  /* Moyenne annuelle : le seul chiffre du document, donc le seul accent. */
  .moy{display:flex;align-items:center;justify-content:space-between;gap:14px;
       border:1px solid #86efac;border-inline-start:4px solid #16a34a;background:#f2fbf4;
       border-radius:6px;padding:9px 16px;margin:0 0 12px}
  .moy-lbl{font-weight:bold;color:#14532d;font-size:13px}
  .moy-val{font-size:20px;font-weight:800;color:#14532d;letter-spacing:.03em;white-space:nowrap}

  .issued{font-style:italic;color:#334155}
  .lieu-date{text-align:end;margin:14px 0 0;font-size:13px;font-family:Georgia,serif}

  /* QR à gauche, signature à droite : le vérificateur trouve le QR au même
     endroit que le cachet qu'il vient de regarder. Le margin-top:auto pousse
     le bloc en bas de page quel que soit le nombre de lignes d'identité. */
  .pied{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:auto;padding-top:22px}
  .qr{text-align:center;flex-shrink:0}
  .qr .legende{font-size:8px;color:#94a3b8;margin-top:2px;letter-spacing:.05em;text-transform:uppercase}
  .sig{border-top:2px solid ${c1};padding-top:8px;text-align:center;font-size:12px;color:#333;
       min-width:235px;font-weight:600}
  .stamp{border:2.5px solid ${c1};padding:7px 16px;display:inline-block;border-radius:4px;
         font-weight:bold;color:${c1};margin-top:8px;font-size:12px;letter-spacing:.04em}
  .devise{text-align:center;font-size:11px;margin-top:16px;font-style:italic;color:${c2};font-weight:bold}
  @media print{button{display:none}}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="feuille"><div class="feuille-int"><div class="contenu">
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <div class="titre"><h2>${tr("reports.attestation.title")}</h2></div>
  <div class="losange">◆ ◆ ◆</div>
  <div class="numero">${tr("reports.attestation.number")} ${numero}</div>
  <p class="formule">${formuleCertifie} :</p>
  <div class="infos">
    ${ligneInfo(tr("reports.studentName"), `${eleve.nom || ""} ${eleve.prenom || ""}`, true)}
    ${ligneInfo(tr("school.bulletins.matricule"), eleve.matricule)}
    ${ligneInfo(tr("reports.ien"), eleve.ien)}
    ${ligneInfo(tr("reports.dateOfBirth"), dateFr(eleve.dateNaissance))}
    ${ligneInfo(tr("reports.placeOfBirth"), eleve.lieuNaissance)}
    ${ligneInfo(tr("reports.filiation"), eleve.filiation)}
    ${ligneInfo(tr("reports.class"), [eleve.classe, niveauLabel].filter(Boolean).join(" — "), true)}
    ${ligneInfo(tr("reports.attestation.arrival"), arrivee)}
    ${ligneInfo(tr("reports.attestation.departure"), depart)}
  </div>
  ${moyenneTexte ? `<div class="moy">
    <span class="moy-lbl">${tr("reports.attestation.annualAverage")} — ${anneeMoyenne}</span>
    <span class="moy-val">${moyenneTexte}</span>
  </div>` : ""}
  <p class="formule">${formuleEnrolement}.</p>
  <p class="formule issued">${tr("reports.attestation.issued")}.</p>
  <p class="lieu-date">${tr("reports.ordreMutation.issuedAt")} ${schoolInfo.ville || "—"}, ${tr("reports.ordreMutation.on")} ${today()}</p>
  <div class="pied">
    <div class="qr">${qr}<div class="legende">${tr("reports.qrVerify")}</div></div>
    <div class="sig">${signataireSection(schoolInfo, niveau, tr("reports.director"))}<br/><div class="stamp">${schoolInfo.nom || ""}</div></div>
  </div>
  <div class="devise">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>
  ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau))}
  ${edugestBrandHTML(schoolInfo)}
  </div></div></div>
  <script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
};
