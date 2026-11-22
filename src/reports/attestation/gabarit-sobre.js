// Modèle « Sobre » de l'attestation : la mise en page d'origine — double
// filet à la couleur de l'école, en-tête officiel commun aux bulletins,
// encadré d'identité à conducteurs pointillés — avec l'encadré des résultats
// (moyenne de chaque période et moyenne annuelle).
import { today } from "../../constants.js";
import { getOfficialLegalFooterHTML, legalProfileVide, mapNiveauToCycle } from "../../legal-utils.js";
import {
  PRINT_RESET, PRINT_TRIGGER, WATERMARK_CSS, edugestBrandHTML, enteteDoc, printDir, printLang, tr, watermarkHtml,
} from "../print-helpers.js";
import { cachetOuEspace, identiteHTML, imagesHTML, imagesSignataire } from "../signatures.js";
import { DEVISE_DEFAUT, libellePeriode, partiesMoyenne, periodesNombreuses } from "./commun.js";

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

// Encadré des résultats : la moyenne de chaque période, puis la moyenne
// annuelle, en gros. Trimestres et semestres : la moyenne annuelle ferme la
// rangée, plus grande. Neuf mois : cases resserrées, la moyenne annuelle
// passe dessous, sur toute la largeur. Une période sans note garde sa case.
const resultatsHTML = (resultats, maxNote) => {
  if (!resultats) return "";
  const nombre = resultats.periodes.length;
  const mois = periodesNombreuses(resultats);
  const valeur = (moy) => {
    const p = partiesMoyenne(moy, maxNote);
    return p ? `${p.valeur}<small>/${p.sur}</small>` : "—";
  };
  const caseHTML = (classe, libelle, moy) =>
    `<div class="res-case${classe}"><div class="res-lbl">${libelle}</div><div class="res-val">${valeur(moy)}</div></div>`;
  const cases = resultats.periodes.map(({ periode, moy }) => caseHTML("", libellePeriode(periode), moy)).join("");
  const annuelle = resultats.annuelle == null ? ""
    : caseHTML(" res-annuelle", tr("reports.attestation.annualAverage"), resultats.annuelle);
  const colonnes = `repeat(${nombre},1fr)${annuelle && !mois ? " 1.45fr" : ""}`;
  return `<div class="resultats${mois ? " res-mois" : ""}">
    <div class="res-titre">${tr("reports.attestation.results", { annee: resultats.annee })}</div>
    <div class="res-grille" style="grid-template-columns:${colonnes}">${cases}${mois ? "" : annuelle}</div>
    ${mois ? annuelle : ""}
  </div>`;
};

// Choix de mise en page :
//  • le cadre double (filet fin extérieur + filet épais intérieur) distingue
//    une pièce officielle d'une page imprimée ; il tient la page entière, la
//    marge d'impression étant à 0 (@page) — bordures comprises dans sa
//    hauteur, sans quoi il dépassait la feuille et ajoutait une page blanche ;
//  • titre gravé : filets latéraux + losange, capitales très espacées ;
//  • corps en serif : une formule administrative se lit mieux, et se
//    distingue des libellés du formulaire restés en sans-serif ;
//  • conducteurs pointillés (libellé, ligne de conduite, valeur) : la
//    grammaire visuelle d'un acte ; filet et lavis dérivés de la couleur de
//    l'école (alpha hex), pas figés en bleu ;
//  • résultats : les seuls chiffres du document, donc le seul accent, en
//    gros ; le vert dit un résultat, comme les mentions des bulletins ;
//  • QR à gauche, signature à droite : le vérificateur trouve le QR au même
//    endroit que le cachet ; le visa se place entre les deux. Le pied est
//    poussé en bas de page quel que soit le nombre de lignes d'identité.
export function gabaritSobre(ctx) {
  const {
    eleve, niveau, schoolInfo, c1, c2, titre, certificat, numero, naissance, arrivee, depart,
    derniereClasse, resultats, maxNote, formuleCertifie, formuleEnrolement, signataire, visa, qr,
  } = ctx;
  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${titre} — ${eleve.nom || ""}</title>
  <meta charset="utf-8"/>
  <style>${PRINT_RESET}
  body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8mm;background:#fff;font-size:13px}
  .feuille{border:1px solid ${c1};padding:3px;min-height:280mm;box-sizing:border-box;display:flex}
  .feuille-int{border:2.5px solid ${c1};padding:11mm 12mm 8mm;flex:1;display:flex;flex-direction:column;position:relative}
  .contenu{max-width:640px;margin:0 auto;width:100%;flex:1;display:flex;flex-direction:column}

  .titre{display:flex;align-items:center;gap:12px;justify-content:center;margin:14px 0 4px}
  .titre::before,.titre::after{content:"";height:1px;background:linear-gradient(90deg,transparent,${c1});flex:1;max-width:90px}
  .titre::after{background:linear-gradient(90deg,${c1},transparent)}
  .titre h2{color:${c1};font-size:19px;text-transform:uppercase;letter-spacing:4px;margin:0;font-weight:800;white-space:nowrap}
  .losange{color:${c2};font-size:10px;letter-spacing:6px;text-align:center;margin-top:2px}
  .numero{text-align:center;font-size:10.5px;color:#64748b;font-family:"Courier New",monospace;
          letter-spacing:.08em;margin:4px 0 16px}

  .formule{font-family:Georgia,"Times New Roman",serif;line-height:1.95;font-size:14px;
           text-align:justify;margin:0 0 10px;color:#111}
  .formule strong{color:${c1}}

  .infos{margin:2px 0 12px;padding:12px 16px;border:1px solid ${c1}33;border-radius:6px;
         border-inline-start:4px solid ${c1};background:${c1}0a}
  .row{display:flex;align-items:baseline;gap:8px;font-size:13px;margin:5px 0;line-height:1.6}
  .lbl{font-weight:bold;color:${c1};flex-shrink:0}
  .lbl::after{content:" :"}
  .fil{flex:1;border-bottom:1px dotted #94a3b8;min-width:14px;transform:translateY(-3px)}
  .val{flex-shrink:0;max-width:62%;text-align:end;color:#1f2937}
  .row-longue .val{flex:1;max-width:none;text-align:start;text-wrap:balance}
  .val strong{color:${c1};font-size:14px;letter-spacing:.02em}

  .resultats{border:1px solid #86efac;border-inline-start:4px solid #16a34a;background:#f2fbf4;
             border-radius:6px;padding:8px 12px 9px;margin:0 0 12px;color:#14532d}
  .res-titre{font-weight:bold;font-size:12px;text-align:center;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px}
  .res-grille{display:grid;gap:6px;align-items:stretch}
  .res-case{background:#fff;border:1px solid #bbf7d0;border-radius:5px;padding:4px 3px;text-align:center;
            display:flex;flex-direction:column;justify-content:center}
  .res-lbl{font-size:11px;font-weight:600;color:#166534}
  .res-val{font-size:24px;font-weight:800;letter-spacing:.02em;white-space:nowrap;line-height:1.2}
  .res-val small{font-size:12px;font-weight:600;color:#4d7c0f}
  .res-annuelle{background:#16a34a;border-color:#16a34a;color:#fff}
  .res-annuelle .res-lbl{color:#fff;text-transform:uppercase;letter-spacing:.06em;font-weight:bold}
  .res-annuelle .res-val{font-size:30px;font-weight:900}
  .res-annuelle .res-val small{color:#dcfce7;font-size:14px}
  .res-mois .res-lbl{font-size:9.5px}
  .res-mois .res-val{font-size:15px}
  .res-mois .res-val small{display:none}
  .res-mois .res-annuelle{flex-direction:row;align-items:center;gap:16px;margin-top:6px;padding:4px 10px}
  .res-mois .res-annuelle .res-lbl{font-size:13px}
  .res-mois .res-annuelle .res-val{font-size:26px}
  .res-mois .res-annuelle .res-val small{display:inline}

  .issued{font-style:italic;color:#334155}
  .lieu-date{text-align:end;margin:14px 0 0;font-size:13px;font-family:Georgia,serif}

  .pied{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:auto;padding-top:22px}
  .qr{text-align:center;flex-shrink:0}
  .qr .legende{font-size:8px;color:#94a3b8;margin-top:2px;letter-spacing:.05em;text-transform:uppercase}
  .sig{border-top:2px solid ${c1};padding-top:8px;text-align:center;font-size:12px;color:#333;
       min-width:235px;font-weight:600}
  .sig.visa{min-width:170px}
  .stamp{border:2.5px solid ${c1};padding:7px 16px;display:inline-block;border-radius:4px;
         font-weight:bold;color:${c1};margin-top:8px;font-size:12px;letter-spacing:.04em}
  .devise{text-align:center;font-size:11px;margin-top:16px;font-style:italic;color:${c2};font-weight:bold}
  @media print{button{display:none}}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  <div class="feuille"><div class="feuille-int"><div class="contenu">
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <div class="titre"><h2>${titre}</h2></div>
  <div class="losange">◆ ◆ ◆</div>
  <div class="numero">${tr(certificat ? "reports.attestation.numberCertificate" : "reports.attestation.number")} ${numero}</div>
  <p class="formule">${formuleCertifie} :</p>
  <div class="infos">
    ${ligneInfo(tr("reports.studentName"), `${eleve.nom || ""} ${eleve.prenom || ""}`, true)}
    ${ligneInfo(tr("school.bulletins.matricule"), eleve.matricule)}
    ${ligneInfo(tr("reports.ien"), eleve.ien)}
    ${ligneInfo(tr("reports.dateOfBirth"), naissance)}
    ${ligneInfo(tr("reports.placeOfBirth"), eleve.lieuNaissance)}
    ${ligneInfo(tr("reports.filiation"), eleve.filiation)}
    ${ligneInfo(tr("reports.attestation.lastClass"), derniereClasse, true)}
    ${ligneInfo(tr("reports.attestation.arrival"), arrivee)}
    ${ligneInfo(tr("reports.attestation.departure"), depart)}
  </div>
  ${resultatsHTML(resultats, maxNote)}
  <p class="formule">${formuleEnrolement}.</p>
  <p class="formule issued">${tr("reports.attestation.issued")}.</p>
  <p class="lieu-date">${tr("reports.ordreMutation.issuedAt")} ${schoolInfo.ville || "—"}, ${tr("reports.ordreMutation.on")} ${today()}</p>
  <div class="pied">
    <div class="qr">${qr}<div class="legende">${tr("reports.qrVerify")}</div></div>
    ${visa ? `<div class="sig visa">${identiteHTML(visa)}${cachetOuEspace(visa)}${tr("reports.signature")}</div>` : ""}
    <div class="sig">${identiteHTML(signataire)}${imagesSignataire(signataire).length
      // Cachet et/ou signature déposés par le signataire : ils remplacent le tampon dessiné.
      ? imagesHTML(imagesSignataire(signataire), { hauteur: "22mm", lignes: 3 })
      : `<br/><div class="stamp">${schoolInfo.nom || ""}</div>`}</div>
  </div>
  <div class="devise">${schoolInfo.devise || DEVISE_DEFAUT}</div>
  ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau))}
  ${edugestBrandHTML(schoolInfo)}
  </div></div></div>
  <script>${PRINT_TRIGGER}</script></body></html>`;
}
