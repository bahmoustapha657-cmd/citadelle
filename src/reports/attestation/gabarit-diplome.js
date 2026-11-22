// Modèle « Diplôme » de l'attestation — celui du bulletin Prestige et du
// tableau d'honneur (../ornements.js) : cadre guilloché à la couleur de
// l'école avec micro-texte de sécurité, emblème dans une couronne de laurier,
// titre entre deux filets dorés, typographie à empattements, moyenne annuelle
// dans un médaillon. Tout est vectoriel et en ligne : rien n'est chargé
// d'Internet, la pièce s'imprime pareil hors ligne et reste lisible en noir
// et blanc. L'or est fixe, il donne le caractère d'apparat quelles que soient
// les couleurs de l'école.
import { today } from "../../constants.js";
import { getOfficialLegalFooterHTML, legalProfileVide, mapNiveauToCycle } from "../../legal-utils.js";
import { PRINT_RESET, PRINT_TRIGGER, edugestBrandHTML, printDir, printLang, tr } from "../print-helpers.js";
import { PIED_CSS, echapper, identiteEcole } from "../bulletins/bulletin-pro-commun.js";
import { OR, OR_FONCE, SERIF, ajusterPagesScript, cadreGuilloche, laurier, medaillon, monogramme, rosace } from "../ornements.js";
import { imagesHTML, imagesSignataire } from "../signatures.js";
import { DEVISE_DEFAUT, libellePeriode, partiesMoyenne, periodesNombreuses } from "./commun.js";

// Une ligne de l'encadré d'identité : libellé, conducteur pointillé, valeur.
// Les lignes sans valeur DISPARAISSENT au lieu d'imprimer un tiret : sur une
// pièce officielle, une rubrique vide se remplit à la main ou n'existe pas.
// `classe` : « large » (toute la largeur), « nomel » (le nom, en grand),
// « cle » (la dernière classe suivie, mise en avant).
const ligneInfo = (label, valeur, classe = "") => {
  const v = String(valeur ?? "").trim();
  if (!v) return "";
  // Valeur longue (filiation complète : « Père : … / Mère : … ») : derrière
  // un conducteur elle serait coupée ; on la déroule à la suite du libellé.
  const longue = v.length > 58 ? " longue" : "";
  return `<div class="ligne${classe ? ` ${classe}` : ""}${longue}"><span>${label}</span><b>${echapper(v)}</b></div>`;
};

// « 12,56 » en gros, « /20 » en petit.
const chiffre = (moy, maxNote) => {
  const p = partiesMoyenne(moy, maxNote);
  return p ? `<b>${p.valeur}</b><em>/${p.sur}</em>` : "<b>—</b>";
};

// Résultats : la moyenne de chaque période sur une bande entre deux filets
// dorés, la moyenne annuelle en gros dans le médaillon qui la ferme. Une
// période sans note garde sa case, avec un tiret. Sans moyenne annuelle
// (année en cours), la bande prend toute la largeur.
const resultatsHTML = (resultats, maxNote) => {
  if (!resultats) return "";
  const cases = resultats.periodes.map(({ periode, moy }) =>
    `<div class="res-case"><small>${libellePeriode(periode)}</small>${chiffre(moy, maxNote)}</div>`).join("");
  const medaille = resultats.annuelle == null ? "" : `<div class="res-med">${medaillon(36)}<div class="val">`
    + `<small>${tr("reports.attestation.annualAverage")}</small>${chiffre(resultats.annuelle, maxNote)}</div></div>`;
  return `<div class="res${periodesNombreuses(resultats) ? " res-mois" : ""}">
      <div class="res-titre"><i></i><span>${tr("reports.attestation.results", { annee: resultats.annee })}</span><i></i></div>
      <div class="res-corps${medaille ? " medaille-on" : ""}">
        <div class="res-bande" style="grid-template-columns:repeat(${resultats.periodes.length},1fr)">${cases}</div>
        ${medaille}
      </div>
    </div>`;
};

// Un bloc de signature : poste, nom, place du cachet et de la signature. Le
// cachet et la signature déposés par le titulaire (Comptes & Postes) s'y
// posent ; sans eux, un cercle pointillé marque la place du tampon.
const signatureHTML = (s) => {
  const images = imagesSignataire(s);
  return `<div class="sig"><b>${s.titre || ""}</b>${s.nom ? `<span class="nom">${s.nom}</span>` : ""}`
    + `<div class="trace${images.length ? "" : " vide"}">${images.length ? imagesHTML(images, { hauteur: "24mm", lignes: 3 }) : ""}</div>`
    + `<small>${tr("reports.signature")}</small></div>`;
};

// La page, de haut en bas :
//  • filigrane : rosace guillochée et logo de l'école, à peine visibles ;
//  • en-tête : l'État à gauche, l'emblème dans son laurier au centre, le QR
//    à droite ; le nom de l'école et ses coordonnées dessous ;
//  • titre gravé entre deux filets dorés, numéro de pièce dessous ;
//  • identité : deux colonnes à conducteurs pointillés sur un lavis de la
//    couleur de l'école, la photo à droite quand l'élève en a une ;
//  • résultats : une bande dorée de périodes, la moyenne annuelle dans le
//    médaillon qui la ferme ;
//  • formule ; lieu, date et signatures poussés en bas de page, comme sur un
//    diplôme ; puis le pied (devise, mentions légales).
// Une page trop pleine (filiation longue, pied légal chargé) est resserrée
// par ajusterPagesScript plutôt que de déborder sur une seconde feuille.
export function gabaritDiplome(ctx) {
  const {
    eleve, niveau, schoolInfo, c1, c2, titre, certificat, numero, naissance, arrivee, depart,
    derniereClasse, resultats, maxNote, formuleCertifie, formuleEnrolement, signataire, visa, qr,
  } = ctx;
  const ecole = identiteEcole(schoolInfo);
  const coordonnees = [ecole.adresse, ecole.contact, ecole.agrement].filter(Boolean).join(" · ");
  // Le visa (s'il y en a un) à gauche, le signataire principal à droite.
  const sigs = [visa, signataire].filter(Boolean).map(signatureHTML).join("");
  const microTexte = echapper(`${schoolInfo.nom || ""} · ${titre} · ${numero}`.toUpperCase());
  const photo = eleve.photo
    ? `<div class="photo"><img crossOrigin="anonymous" src="${echapper(eleve.photo)}" alt=""/></div>` : "";

  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><title>${titre} — ${echapper(eleve.nom || "")}</title>
  <meta charset="utf-8"/>
  <style>${PRINT_RESET}
  body{margin:0;padding:0;background:#fff}
  @media screen{body{background:#e5e7eb;padding:10px 0}.page.att{margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.18)}}
  @media print{button{display:none}}
  .page.att{width:210mm;min-height:296mm;box-sizing:border-box;position:relative;display:flex;flex-direction:column;
            background:#fff;font-family:${SERIF};color:#1d1d1f;font-variant-numeric:lining-nums}
  .att .cadre{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
  .att .fili{position:absolute;left:calc(50% - 62mm);top:calc(54% - 62mm);width:124mm;height:124mm;display:flex;
             align-items:center;justify-content:center;z-index:0;pointer-events:none}
  .att .fili svg{position:absolute;inset:0;width:100%;height:100%}
  .att .fili img{width:70mm;height:70mm;object-fit:contain;opacity:.06}
  .att .corps{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;padding:13.5mm 17mm 12.5mm}
  .att .ajustable{flex:1;display:flex;flex-direction:column}

  .att .tete{display:grid;grid-template-columns:1fr 32mm 1fr;align-items:center;gap:3mm}
  .att .etat{text-align:center;font-size:7.2px;line-height:1.45;color:#3d3d3d}
  .att .etat .rep{font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#1d1d1f}
  .att .etat .dev{font-size:8.2px;margin:.4mm 0 1mm}
  .att .etat .min{letter-spacing:.03em}
  .att .etat .tut{margin-top:.8mm;letter-spacing:.08em;color:#555}
  .att .embleme{position:relative;width:32mm;height:29mm;display:flex;align-items:center;justify-content:center}
  .att .embleme .laurier{position:absolute;left:1mm;top:-.5mm;width:30mm;height:30mm}
  .att .embleme img{position:relative;width:17.5mm;height:17.5mm;object-fit:contain;margin-top:-1mm}
  .att .mono{position:relative;width:17mm;height:17mm;margin-top:-1mm;border-radius:50%;border:.5mm double var(--c1);display:flex;
             align-items:center;justify-content:center;font-size:17px;font-weight:700;letter-spacing:.06em;color:var(--c1)}
  .att .verif{display:flex;flex-direction:column;align-items:center;gap:.8mm;font:6px/1.3 Arial,Helvetica,sans-serif;
              letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;text-align:center}
  .att .verif img{display:block;width:22mm;height:22mm}
  .att .ecole{text-align:center;margin-top:1mm}
  .att .ecole .nom{font-size:18.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--c1);line-height:1.15}
  .att .ecole .coord{font-size:7.8px;color:#5d5d5d;margin-top:1mm;letter-spacing:.03em}

  .att .titre{display:flex;align-items:center;gap:5mm;margin:6mm 2mm 0}
  .att .titre i{flex:1;height:1.3mm;border-top:.35mm solid ${OR};border-bottom:.2mm solid ${OR}}
  .att .titre h1{margin:0;font-size:23px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--c1);
                 white-space:nowrap;padding-inline-start:.24em}
  .att .numero{text-align:center;font-size:8.4px;letter-spacing:.22em;text-transform:uppercase;color:${OR_FONCE};margin-top:1.4mm}
  .att .numero b{letter-spacing:.12em;color:#3d3d3d}

  .att .formule{font-size:13px;line-height:1.75;text-align:justify;margin:5.5mm 0 0}
  .att .formule strong{color:var(--c1)}
  .att .formule.issued{font-style:italic;color:#444;margin-top:1.2mm}

  .att .ident{display:grid;grid-template-columns:1fr;gap:5mm;align-items:center;margin-top:3.2mm;padding:4.2mm 5.5mm 4.4mm;
              border:.3mm solid ${c1}33;border-inline-start:1.1mm solid var(--c1);background:${c1}0a;border-radius:1mm}
  .att .ident.illustree{grid-template-columns:1fr 24mm}
  .att .champs{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 8mm;font-size:10px}
  .att .ligne{display:flex;align-items:baseline;gap:1.6mm;white-space:nowrap;min-width:0}
  .att .ligne.large{grid-column:1/-1}
  .att .ligne span{color:#5f5f5f;font-size:9.4px}
  .att .ligne:after{content:"";order:1;flex:1;min-width:4mm;border-bottom:.25mm dotted #a7a7a7;transform:translateY(-.7mm)}
  .att .ligne b{order:2;font-size:11.2px;color:#1d1d1f;overflow:hidden;text-overflow:ellipsis}
  .att .ligne.nomel b{font-size:15px;letter-spacing:.05em;color:var(--c1)}
  .att .ligne.cle b{font-size:13.5px;color:var(--c1)}
  .att .ligne.longue{white-space:normal}
  .att .ligne.longue:after{display:none}
  .att .ligne.longue b{order:0;flex:1}
  .att .photo{padding:1mm;border:.3mm solid ${OR};background:#fff}
  .att .photo img{display:block;width:22mm;height:27mm;object-fit:cover}

  .att .res{margin-top:6.5mm}
  .att .res-titre{display:flex;align-items:center;gap:3mm;font-size:8px;font-weight:700;letter-spacing:.2em;
                  text-transform:uppercase;color:${OR_FONCE}}
  .att .res-titre i{flex:1;border-top:.25mm solid ${OR}}
  .att .res-corps{display:grid;grid-template-columns:1fr;align-items:center;margin-top:1.4mm}
  .att .res-corps.medaille-on{grid-template-columns:1fr 36mm}
  .att .res-bande{display:grid;border-top:.4mm solid ${OR};border-bottom:.4mm solid ${OR};
                  background:#f6f8fa;background:color-mix(in srgb,var(--c1) 5%,#fff)}
  .att .medaille-on .res-bande{margin-inline-end:-10mm;padding-inline-end:10mm}
  .att .res-case{text-align:center;padding:2.6mm 1mm 2.3mm;border-inline-start:.25mm solid #e3d6bb}
  .att .res-case:first-child{border-inline-start:0}
  .att .res-case small{display:block;font-size:7.4px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
                       color:${OR_FONCE};margin-bottom:.6mm}
  .att .res-case b{font-size:25px;line-height:1.1;color:var(--c1)}
  .att .res-case em,.att .res-med em{font-style:normal;font-size:10px;color:#6b6b6b;margin-inline-start:.4mm}
  .att .res-mois .res-case{padding:2mm .4mm 1.8mm}
  .att .res-mois .res-case small{font-size:6.2px;letter-spacing:.05em}
  .att .res-mois .res-case b{font-size:14px}
  .att .res-mois .res-case em{display:none}
  .att .res-med{position:relative;z-index:1;width:36mm;height:36mm;display:flex;align-items:center;justify-content:center}
  .att .res-med .medaillon{position:absolute;inset:0;width:100%;height:100%}
  .att .res-med .val{position:relative;text-align:center;line-height:1}
  .att .res-med small{display:block;max-width:21mm;margin:0 auto 1mm;font-size:6.2px;font-weight:700;letter-spacing:.13em;
                      line-height:1.3;text-transform:uppercase;color:${OR_FONCE}}
  .att .res-med b{font-size:29px;color:var(--c1)}
  .att .res-med em{display:block;margin:.6mm 0 0}

  .att .cloture{margin-top:auto;padding-top:7mm}
  .att .fait{text-align:end;font-size:11px;font-style:italic;color:#333}
  .att .sigs{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:2mm}
  .att .sigs.seul .sig{grid-column:2}
  .att .sig{text-align:center}
  .att .sig b{display:block;font-size:8.6px;letter-spacing:.14em;text-transform:uppercase;color:var(--c1)}
  .att .sig .nom{display:block;font-size:11.5px;font-weight:700;margin-top:.7mm}
  .att .sig .trace{position:relative;min-height:24mm;display:flex;align-items:center;justify-content:center}
  .att .sig .trace>div{width:100%}
  .att .sig .trace.vide:before{content:"";width:18mm;height:18mm;border:.3mm dashed #d9cdb2;border-radius:50%}
  .att .sig small{display:block;border-top:.25mm solid #8f8f8f;padding-top:.8mm;font-size:7.8px;font-style:italic;color:#777}

  .att .pied{padding-top:5mm;text-align:center;font:6.9px/1.5 Arial,Helvetica,sans-serif;color:#7a7a7a}
  .att .devise{font:italic 700 10.5px ${SERIF};letter-spacing:.05em;color:${c2};margin-bottom:.8mm}
  ${PIED_CSS}
  </style></head><body>
  <div class="page att" style="--c1:${c1};--c2:${c2}">
    ${cadreGuilloche({ microTexte })}
    <div class="fili" aria-hidden="true">
      <svg viewBox="-60 -60 120 120">${rosace({ n: 48, rCentre: 19, rCercle: 31, epaisseur: 0.16, opacite: 0.12 })}</svg>
      ${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : ""}
    </div>
    <div class="corps"><div class="ajustable">
      <div class="tete">
        <div class="etat">
          <div class="rep">${ecole.pays}</div>
          <div class="dev">${ecole.devise}</div>
          <div class="min">${ecole.ministere}</div>
          ${ecole.tutelle ? `<div class="tut">${ecole.tutelle}</div>` : ""}
        </div>
        <div class="embleme">${laurier(30)}${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : monogramme(schoolInfo.nom)}</div>
        <div class="verif">${qr}<div>${tr("reports.qrVerify")}</div></div>
      </div>
      <div class="ecole">
        <div class="nom">${ecole.nom}</div>
        ${coordonnees ? `<div class="coord">${coordonnees}</div>` : ""}
      </div>

      <div class="titre"><i></i><h1>${titre}</h1><i></i></div>
      <div class="numero">${tr(certificat ? "reports.attestation.numberCertificate" : "reports.attestation.number")} <b>${numero}</b></div>

      <p class="formule">${formuleCertifie} :</p>
      <div class="ident${photo ? " illustree" : ""}">
        <div class="champs">
          ${ligneInfo(tr("reports.studentName"), `${eleve.nom || ""} ${eleve.prenom || ""}`, "large nomel")}
          ${ligneInfo(tr("school.bulletins.matricule"), eleve.matricule)}
          ${ligneInfo(tr("reports.ien"), eleve.ien)}
          ${ligneInfo(tr("reports.dateOfBirth"), naissance)}
          ${ligneInfo(tr("reports.placeOfBirth"), eleve.lieuNaissance)}
          ${ligneInfo(tr("reports.filiation"), eleve.filiation, "large")}
          ${ligneInfo(tr("reports.attestation.lastClass"), derniereClasse, "large cle")}
          ${ligneInfo(tr("reports.attestation.arrival"), arrivee)}
          ${ligneInfo(tr("reports.attestation.departure"), depart)}
        </div>
        ${photo}
      </div>

      ${resultatsHTML(resultats, maxNote)}

      <p class="formule">${formuleEnrolement}.</p>
      <p class="formule issued">${tr("reports.attestation.issued")}.</p>
      <div class="cloture">
        <div class="fait">${tr("reports.ordreMutation.issuedAt")} ${ecole.ville || "—"}, ${tr("reports.ordreMutation.on")} ${today()}</div>
        <div class="sigs${visa ? "" : " seul"}">${sigs}</div>
      </div>

      <div class="pied">
        <div class="devise">${echapper(schoolInfo.devise || DEVISE_DEFAUT)}</div>
        ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau))}
        ${edugestBrandHTML(schoolInfo)}
      </div>
    </div></div>
  </div>
  <script>${ajusterPagesScript(".page.att", 297)}${PRINT_TRIGGER}</script></body></html>`;
}
