// ══════════════════════════════════════════════════════════════
//  Modèle « Prestige » — l'esprit d'un diplôme
// ══════════════════════════════════════════════════════════════
// Cadre guilloché à la couleur de l'école avec micro-texte de sécurité,
// emblème de l'école dans une couronne de laurier, typographie classique à
// empattements, moyenne générale dans un médaillon, sceau de distinction,
// cachet de l'école. L'or est fixe : c'est lui qui donne le caractère
// « prestige », quelles que soient les couleurs de l'école. Tous les
// ornements sont des SVG en ligne (../ornements.js) : rien n'est
// chargé depuis Internet, tout reste lisible en noir et blanc.
import {
  dateDuJour, dateFr, echapper, imageSignature, libelleDistinction, libellePeriode,
  mentionFr, mentionsPied, nb, ordinal, periodeCourte, photoHTML, signaturesBulletin, titreBulletin,
} from "./bulletin-pro-commun.js";
import { OR, OR_FONCE, SERIF, cadreGuilloche, laurier, medaillon, monogramme, rosace } from "../ornements.js";

// Sceau en rosette : la distinction proposée par le conseil.
const sceau = (texte, sousTexte) => `<svg width="27mm" height="27mm" viewBox="0 0 100 100" aria-hidden="true">
  <g fill="${OR}">${Array.from({ length: 24 }, (_, i) => `<circle cx="${(50 + 44 * Math.cos(i * Math.PI / 12)).toFixed(2)}" cy="${(50 + 44 * Math.sin(i * Math.PI / 12)).toFixed(2)}" r="6"/>`).join("")}</g>
  <circle cx="50" cy="50" r="42" fill="${OR}"/><circle cx="50" cy="50" r="36" fill="#fff"/>
  <circle cx="50" cy="50" r="33" fill="none" stroke="${OR}" stroke-width="1"/>
  <text x="50" y="47" font-family='${SERIF}' font-size="${texte.length > 14 ? 7.8 : 10.5}" font-style="italic" font-weight="700" fill="#1a1a1a" text-anchor="middle">${texte}</text>
  <text x="50" y="60" font-family='${SERIF}' font-size="6.4" fill="${OR_FONCE}" text-anchor="middle" letter-spacing="0.8">${sousTexte}</text>
</svg>`;

const ligneIdent = (label, valeur, classe = "") =>
  `<div class="ligne${classe ? ` ${classe}` : ""}"><span>${label}</span><b>${valeur}</b></div>`;

export function buildBulletinPrestigeHTML(ctx) {
  const { eleve, m, si, ecole, niveau, maxNote, periode, annee, rang, classStats, evolution,
    moyennesPeriodes, assiduite, appreciation, qr, estAnnuel, densite } = ctx;
  const sexe = eleve.sexe;

  const entetes = [
    `<th class="g">Discipline</th>`, `<th>Coef.</th>`,
    m.avecDetail ? `<th>Note de classe</th><th>Compo&shy;sition</th>` : "",
    `<th class="moy">${estAnnuel ? "Moy. annuelle" : "Moyenne"} /${maxNote}</th>`, `<th>Points</th>`,
    m.avecRang ? `<th>Rang</th>` : "",
    `<th class="g">Appréciation</th>`,
  ].join("");
  const lignes = m.lignes.map((l) => `<tr>
    <td class="m">${echapper(l.mat)}</td><td>${l.coef}</td>
    ${m.avecDetail ? `<td>${nb(l.cours)}</td><td>${nb(l.compo)}</td>` : ""}
    <td class="moy">${nb(l.moy)}</td><td>${nb(l.pts)}</td>
    ${m.avecRang ? `<td>${ordinal(l.rang, sexe)}</td>` : ""}
    <td class="ap">${mentionFr(l.mention)}</td>
  </tr>`).join("");

  // Une ligne de chiffres sous le bilan : classe, période précédente ou
  // récapitulatif annuel, assiduité.
  const stats = [
    classStats ? `Plus forte moyenne ${nb(classStats.max)} · plus faible ${nb(classStats.min)}` : "",
    estAnnuel && moyennesPeriodes?.length
      ? moyennesPeriodes.map((p) => `${periodeCourte(p.periode)} ${nb(p.moy)}`).join(" · ")
      : (evolution ? `${periodeCourte(evolution.periodePrec)} : ${nb(evolution.moyPrec)}` : ""),
    assiduite
      ? `Absences ${assiduite.absJ + assiduite.absNJ} (dont ${assiduite.absNJ} non justifiée${assiduite.absNJ > 1 ? "s" : ""}) · Retards ${assiduite.retards}`
      : `Absences …… · Retards ……`,
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");

  const distinction = libelleDistinction(m.distinction);
  const sigs = signaturesBulletin(si, niveau, ({ titre, note, image, cachet }) =>
    `<div class="sig${cachet && !image ? " cachet" : ""}"><b>${titre}</b><small>${note}</small>${imageSignature(image)}</div>`);
  const microTexte = echapper(`${si.nom || ""} · ${titreBulletin(periode)} · ${annee}`.toUpperCase());

  return `
  <div class="page pro bp ${densite}" style="--c1:${ctx.c1};--c2:${ctx.c2}">
    ${cadreGuilloche({ microTexte })}
    <div class="fili" aria-hidden="true">
      <svg viewBox="-60 -60 120 120">${rosace({ n: 48, rCentre: 19, rCercle: 31, epaisseur: 0.16, opacite: 0.13 })}</svg>
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
        <div class="embleme">${laurier(30)}${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : monogramme(si.nom)}</div>
        <div class="verif">${qr ? `${qr}<div>Authenticité vérifiable<br/>par le code QR</div>` : ""}</div>
      </div>
      <div class="ecole">
        <div class="nom">${ecole.nom}</div>
        <div class="coord">${[ecole.adresse, ecole.contact, ecole.agrement].filter(Boolean).join(" · ")}</div>
      </div>

      <div class="titre"><i></i><h1>${titreBulletin(periode)}</h1><i></i></div>
      <div class="per">${libellePeriode(periode)} · Année scolaire ${echapper(annee)}</div>

      <div class="ident">
        <div class="champs">
          ${ligneIdent("Nom et prénoms", echapper(`${eleve.nom || ""} ${eleve.prenom || ""}`), "large nomel")}
          ${ligneIdent("Classe", echapper(eleve.classe || "—"))}
          ${ligneIdent("Effectif", classStats ? `${classStats.effectif} élèves` : "—")}
          ${ligneIdent("Né(e) le", `${echapper(dateFr(eleve.dateNaissance) || "—")}${eleve.lieuNaissance ? ` à ${echapper(eleve.lieuNaissance)}` : ""}`, "large")}
          ${ligneIdent("Matricule", echapper(eleve.matricule || "—"))}
          ${ligneIdent("N° IEN", echapper(eleve.ien || "—"))}
          ${eleve.filiation ? ligneIdent("Filiation", echapper(eleve.filiation), "large") : ""}
        </div>
        <div class="photo">${photoHTML(eleve, { w: 22, h: 27, bord: OR })}</div>
      </div>

      <table>
        <thead><tr>${entetes}</tr></thead>
        <tbody>
          ${lignes}
          <tr class="tot"><td class="m">Totaux</td><td>${m.totalCoef}</td>${m.avecDetail ? "<td></td><td></td>" : ""}<td class="moy">${nb(m.moyGene)}</td><td>${nb(m.totalPts)}</td><td colspan="${m.avecRang ? 2 : 1}" class="g">sur ${m.totalMax} points</td></tr>
        </tbody>
      </table>

      <div class="bilan">
        <div class="cote g"><small>Rang</small><b>${rang ? ordinal(rang.rang, sexe) : "—"}</b><em>${rang ? `sur ${rang.effectif} élèves` : "&nbsp;"}</em></div>
        <div class="med">${medaillon(32)}<div class="val"><small>${estAnnuel ? "Moyenne annuelle" : "Moyenne générale"}</small><b>${nb(m.moyGene)}</b><em>sur ${maxNote}</em></div></div>
        <div class="cote d"><small>Mention</small><b class="it">${mentionFr(m.mention)}</b><em>${classStats ? `Moyenne de la classe ${nb(classStats.moyenneClasse)}` : "&nbsp;"}</em></div>
      </div>
      <div class="stats">${stats}</div>

      <div class="bas${distinction ? "" : " seul"}">
        <div class="appr"><span class="qui">Appréciation générale</span>${appreciation ? echapper(appreciation) : `<span class="vide"></span><span class="vide"></span>`}</div>
        ${distinction ? `<div class="sceau">${sceau(distinction, echapper(annee))}</div>` : ""}
      </div>

      <div class="fait">Fait à ${ecole.ville || "……………………"}, le ${dateDuJour()}</div>
      <div class="sigs">${sigs}</div>

      <div class="pied">
        ${si.devise ? `<div class="devise">${echapper(si.devise)}</div>` : ""}
        ${mentionsPied(si, niveau, m.numero, !!qr)}
      </div>
    </div></div>
  </div>`;
}

export const STYLES_PRESTIGE = `
  .lc-watermark{display:none}
  .bp{font-family:${SERIF};color:#1d1d1f;font-variant-numeric:lining-nums}
  .bp .cadre{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
  .bp .fili{position:absolute;left:calc(50% - 64mm);top:calc(55% - 64mm);width:128mm;height:128mm;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none}
  .bp .fili svg{position:absolute;inset:0;width:100%;height:100%}
  .bp .fili img{width:74mm;height:74mm;object-fit:contain;opacity:.065}
  .bp .corps{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;padding:12.5mm 15.5mm 12.5mm}
  .bp .ajustable{flex:1;display:flex;flex-direction:column}
  .bp .tete{display:grid;grid-template-columns:1fr 32mm 1fr;align-items:center;gap:3mm}
  .bp .etat{text-align:center;font-size:6.8px;line-height:1.45;color:#3d3d3d}
  .bp .etat .rep{font-size:8.6px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#1d1d1f}
  .bp .etat .dev{font-size:8px;margin:.4mm 0 1mm}
  .bp .etat .min{letter-spacing:.03em}
  .bp .etat .tut{margin-top:.8mm;letter-spacing:.08em;color:#555}
  .bp .embleme{position:relative;width:32mm;height:29mm;display:flex;align-items:center;justify-content:center}
  .bp .embleme .laurier{position:absolute;left:1mm;top:-.5mm;width:30mm;height:30mm}
  .bp .embleme img{position:relative;width:17.5mm;height:17.5mm;object-fit:contain;margin-top:-1mm}
  .bp .mono{position:relative;width:17mm;height:17mm;margin-top:-1mm;border-radius:50%;border:.5mm double var(--c1);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;letter-spacing:.06em;color:var(--c1)}
  .bp .verif{display:flex;flex-direction:column;align-items:center;gap:.8mm;font-size:6px;line-height:1.3;letter-spacing:.06em;color:#6b6b6b;text-align:center}
  .bp .verif img{display:block;width:23mm;height:23mm}
  .bp .ecole{text-align:center;margin-top:.8mm}
  .bp .ecole .nom{font-size:18px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--c1);line-height:1.15}
  .bp .ecole .coord{font-size:7.6px;color:#5d5d5d;margin-top:1mm;letter-spacing:.03em}
  .bp .titre{display:flex;align-items:center;gap:4.5mm;margin:2.8mm 4mm 0}
  .bp .titre i{flex:1;height:1.3mm;border-top:.35mm solid ${OR};border-bottom:.2mm solid ${OR}}
  .bp .titre h1{margin:0;font-size:19px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:var(--c1);white-space:nowrap;padding-left:.26em}
  .bp .per{text-align:center;font-size:10.6px;font-style:italic;color:#444;margin-top:.4mm;letter-spacing:.03em}
  .bp .ident{display:grid;grid-template-columns:1fr 24mm;gap:6mm;margin-top:3mm;align-items:center}
  .bp .champs{display:grid;grid-template-columns:1fr 1fr;gap:1.2mm 7mm;font-size:9.4px}
  .bp .ligne{display:flex;align-items:baseline;gap:1.6mm;white-space:nowrap;min-width:0}
  .bp .ligne.large{grid-column:1/-1}
  .bp .ligne span{color:#666;font-size:8.6px}
  .bp .ligne:after{content:"";order:1;flex:1;min-width:4mm;border-bottom:.25mm dotted #a7a7a7;transform:translateY(-.7mm)}
  .bp .ligne b{order:2;font-size:10.6px;color:var(--c1);overflow:hidden;text-overflow:ellipsis}
  .bp .ligne.nomel b{font-size:13.5px;letter-spacing:.04em}
  .bp .photo{padding:1mm;border:.3mm solid ${OR}}
  .bp table{width:100%;border-collapse:collapse;margin-top:3.4mm;font-variant-numeric:lining-nums tabular-nums}
  .bp th{font-size:7px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;line-height:1.2;color:var(--c1);padding:1.7mm 1.1mm 1.5mm;text-align:center;border-top:.6mm solid var(--c1);border-bottom:.3mm solid var(--c1);background:#f2f5f8;background:color-mix(in srgb,var(--c1) 6%,#fff)}
  .bp th.moy{background:#e6ecf2;background:color-mix(in srgb,var(--c1) 13%,#fff)}
  .bp th.g,.bp td.g{text-align:left}
  .bp td{padding:1.15mm 1.1mm;font-size:9.8px;line-height:1.2;text-align:center;border-bottom:.2mm solid #e3dccd}
  .bp tbody tr:nth-child(even) td{background:#fafbfc;background:color-mix(in srgb,var(--c1) 2.5%,#fff)}
  .bp td.m{font-size:10.2px;font-weight:700;text-align:left;padding-left:2mm}
  .bp td.moy{font-weight:700;font-size:10.6px;color:var(--c1);background:#f0f3f7!important;background:color-mix(in srgb,var(--c1) 7%,#fff)!important}
  .bp td.ap{font-style:italic;color:#444;text-align:left}
  .bp tr.tot td{font-style:italic;font-weight:700;color:var(--c1);border-top:.3mm solid var(--c1);border-bottom:.6mm solid var(--c1);background:#f2f5f8;background:color-mix(in srgb,var(--c1) 6%,#fff)}
  .bp .bilan{display:grid;grid-template-columns:1fr 32mm 1fr;align-items:center;margin-top:3.2mm}
  .bp .bilan .cote{text-align:center;padding:1.9mm 0 1.7mm;border-top:.3mm solid ${OR};border-bottom:.3mm solid ${OR};background:#f6f8fa;background:color-mix(in srgb,var(--c1) 4%,#fff)}
  .bp .bilan .cote.g{margin-right:-7mm;padding-right:7mm;border-left:.3mm solid ${OR}}
  .bp .bilan .cote.d{margin-left:-7mm;padding-left:7mm;border-right:.3mm solid ${OR}}
  .bp .bilan small,.bp .med small{display:block;font-size:6.6px;letter-spacing:.18em;text-transform:uppercase;color:${OR_FONCE}}
  .bp .bilan b{display:block;font-size:21px;line-height:1.15;color:var(--c1)}
  .bp .bilan b.it{font-style:italic}
  .bp .bilan em{display:block;font-size:8.4px;color:#555}
  .bp .med{position:relative;z-index:1;width:32mm;height:32mm;display:flex;align-items:center;justify-content:center}
  .bp .med .medaillon{position:absolute;inset:0;width:100%;height:100%}
  .bp .med .val{position:relative;text-align:center}
  .bp .med small{font-size:5.2px;letter-spacing:.1em;max-width:20mm;margin:0 auto}
  .bp .med b{font-size:23px;line-height:1.1;margin-top:.2mm}
  .bp .med em{font-size:7.6px}
  .bp .stats{text-align:center;font-size:8.2px;color:#555;margin-top:1.2mm;letter-spacing:.02em}
  .bp .bas{display:grid;grid-template-columns:1fr 26mm;gap:5mm;margin-top:2.6mm;align-items:center}
  .bp .bas.seul{grid-template-columns:1fr}
  .bp .appr{position:relative;padding:2.2mm 4mm 2.4mm 10mm;border:.25mm solid #ddd3c1;background:rgba(255,255,255,.88);font-size:10.4px;font-style:italic;line-height:1.5;color:#222}
  .bp .appr:before{content:"\\201C";position:absolute;left:2.4mm;top:.2mm;font-size:30px;font-style:normal;line-height:1;color:${OR}}
  .bp .appr .qui{display:block;font-size:6.6px;font-style:normal;letter-spacing:.18em;text-transform:uppercase;color:${OR_FONCE};margin-bottom:.6mm}
  .bp .appr .vide{display:block;border-bottom:.25mm dotted #bbb;height:5mm}
  .bp .sceau{text-align:center;line-height:0}
  .bp .sceau svg{width:25mm;height:25mm}
  .bp .fait{text-align:right;font-size:9.6px;font-style:italic;color:#333;margin-top:2.2mm}
  .bp .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:7mm;margin-top:1.4mm}
  .bp .sig{position:relative;z-index:0;text-align:center;min-height:19mm;border-bottom:.25mm solid #8f8f8f}
  .bp .sig b{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--c1)}
  .bp .sig small{display:block;font-size:7.4px;font-style:italic;color:#777}
  .bp .sig.cachet:after{content:"";position:absolute;left:50%;bottom:.8mm;width:14mm;height:14mm;margin-left:-7mm;border:.3mm dashed #d9cdb2;border-radius:50%;z-index:-1}
  .bp .pied{margin-top:auto;padding-top:2mm;text-align:center;font:6.9px/1.5 Arial,Helvetica,sans-serif;color:#7a7a7a}
  .bp .devise{font:italic 700 10px ${SERIF};letter-spacing:.05em;color:var(--c1);margin-bottom:.5mm}
  .bp.d1 td{padding:.7mm 1.1mm}
  .bp.d1 .sig{min-height:17mm}
  .bp.d2 td{padding:.42mm 1.1mm;font-size:9.3px}
  .bp.d2 td.m{font-size:9.6px}
  .bp.d2 .bilan{grid-template-columns:1fr 30mm 1fr;margin-top:2.6mm}
  .bp.d2 .med{width:30mm;height:30mm}
  .bp.d2 .med b{font-size:21px}
  .bp.d2 .bas{margin-top:2.2mm;grid-template-columns:1fr 23mm}
  .bp.d2 .sceau svg{width:23mm;height:23mm}
  .bp.d2 .sig{min-height:14mm}
  .bp.d3 .corps{padding-top:11.5mm;padding-bottom:11.5mm}
  .bp.d3 .tete{grid-template-columns:1fr 28mm 1fr}
  .bp.d3 .embleme{width:28mm;height:25mm}
  .bp.d3 .embleme .laurier{left:1mm;width:26mm;height:26mm}
  .bp.d3 .embleme img,.bp.d3 .mono{width:15mm;height:15mm}
  .bp.d3 .ecole .nom{font-size:16.5px}
  .bp.d3 .titre{margin-top:1.8mm}
  .bp.d3 .titre h1{font-size:17px}
  .bp.d3 .ident{margin-top:2.2mm}
  .bp.d3 .champs{gap:.8mm 7mm}
  .bp.d3 .photo img,.bp.d3 .photo>div{width:19mm!important;height:23mm!important}
  .bp.d3 table{margin-top:2.4mm}
  .bp.d3 th{padding:1.2mm 1.1mm 1mm}
  .bp.d3 td{padding:.3mm 1.1mm;font-size:9px}
  .bp.d3 td.m{font-size:9.2px}
  .bp.d3 .bilan{grid-template-columns:1fr 28mm 1fr;margin-top:2.2mm}
  .bp.d3 .med{width:28mm;height:28mm}
  .bp.d3 .med b{font-size:20px}
  .bp.d3 .bilan b{font-size:18px}
  .bp.d3 .bilan .cote{padding:1.2mm 0 1mm}
  .bp.d3 .bilan .cote.g{padding-right:7mm}
  .bp.d3 .bilan .cote.d{padding-left:7mm}
  .bp.d3 .bas{margin-top:2mm;grid-template-columns:1fr 22mm}
  .bp.d3 .sceau svg{width:22mm;height:22mm}
  .bp.d3 .appr{padding-top:1.6mm;padding-bottom:1.6mm;font-size:9.8px}
  .bp.d3 .fait{margin-top:1.6mm}
  .bp.d3 .sig{min-height:13mm}
`;
