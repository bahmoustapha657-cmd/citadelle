// ══════════════════════════════════════════════════════════════
//  Modèle « Prestige » — l'esprit d'un diplôme
// ══════════════════════════════════════════════════════════════
// Double cadre (couleur 1 de l'école + filet doré), typographie classique à
// empattements, tableau à filets sans quadrillage, sceau de distinction.
// L'or est fixe : c'est lui qui donne le caractère « prestige », quelles
// que soient les couleurs de l'école.
import {
  dateDuJour, dateFr, echapper, imageSignature, libelleDistinction, libellePeriode, logoHTML,
  mentionFr, mentionsPied, nb, ordinal, periodeCourte, photoHTML, signaturesBulletin, titreBulletin,
} from "./bulletin-pro-commun.js";

const OR = "#B08D57";

// Sceau en rosette : la distinction proposée par le conseil.
const sceau = (texte, sousTexte) => `<svg width="27mm" height="27mm" viewBox="0 0 100 100" aria-hidden="true">
  <g fill="${OR}">${Array.from({ length: 24 }, (_, i) => `<circle cx="${(50 + 44 * Math.cos(i * Math.PI / 12)).toFixed(2)}" cy="${(50 + 44 * Math.sin(i * Math.PI / 12)).toFixed(2)}" r="6"/>`).join("")}</g>
  <circle cx="50" cy="50" r="42" fill="${OR}"/><circle cx="50" cy="50" r="36" fill="#fff"/>
  <circle cx="50" cy="50" r="33" fill="none" stroke="${OR}" stroke-width="1"/>
  <text x="50" y="47" font-family="Times New Roman" font-size="${texte.length > 14 ? 7.8 : 10.5}" font-style="italic" font-weight="700" fill="#1a1a1a" text-anchor="middle">${texte}</text>
  <text x="50" y="60" font-family="Times New Roman" font-size="6.4" fill="#7a6338" text-anchor="middle" letter-spacing="0.8">${sousTexte}</text>
</svg>`;

const ligneIdent = (label, valeur, large = false) =>
  `<div class="ligne${large ? " large" : ""}"><span>${label}</span><b>${valeur}</b></div>`;

export function buildBulletinPrestigeHTML(ctx) {
  const { eleve, m, si, ecole, niveau, maxNote, periode, annee, rang, classStats, evolution,
    moyennesPeriodes, assiduite, appreciation, qr, estAnnuel, densite } = ctx;
  const sexe = eleve.sexe;

  const entetes = [
    `<th class="g">Discipline</th>`, `<th>Coef.</th>`,
    m.avecDetail ? `<th>Classe</th><th>Compo.</th>` : "",
    `<th>${estAnnuel ? "Moy. annuelle" : "Moyenne"}</th>`, `<th>Points</th>`,
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

  // Une ligne de chiffres sous le ruban : classe, période précédente ou
  // récapitulatif annuel, assiduité.
  const stats = [
    classStats ? `Moyenne de la classe ${nb(classStats.moyenneClasse)} · plus forte ${nb(classStats.max)} · plus faible ${nb(classStats.min)}` : "",
    estAnnuel && moyennesPeriodes?.length
      ? moyennesPeriodes.map((p) => `${periodeCourte(p.periode)} ${nb(p.moy)}`).join(" · ")
      : (evolution ? `${periodeCourte(evolution.periodePrec)} : ${nb(evolution.moyPrec)}` : ""),
    assiduite
      ? `Absences ${assiduite.absJ + assiduite.absNJ} (dont ${assiduite.absNJ} non justifiée${assiduite.absNJ > 1 ? "s" : ""}) · Retards ${assiduite.retards}`
      : `Absences …… · Retards ……`,
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");

  const distinction = libelleDistinction(m.distinction);
  const sigs = signaturesBulletin(si, niveau, ({ titre, note, image }) =>
    `<div class="sig">${titre}<small>${note}</small>${imageSignature(image)}</div>`);

  return `
  <div class="page pro bp ${densite}" style="--c1:${ctx.c1};--c2:${ctx.c2}"><div class="cadre1"><div class="cadre2">
    <span class="coin a"></span><span class="coin b"></span><span class="coin c"></span><span class="coin d"></span>
    <div class="etat"><span class="rep">${ecole.pays}</span> · ${ecole.devise}<br/>${ecole.ministere}${ecole.tutelle ? `<br/>${ecole.tutelle}` : ""}</div>
    <div class="ecole">
      ${logoHTML(ecole.logo, 15)}
      <div class="nom">${ecole.nom}</div>
      <div class="coord">${[ecole.adresse, ecole.contact, ecole.agrement].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="orn">◆</div>
    <h1>${titreBulletin(periode)}</h1>
    <div class="per">${libellePeriode(periode)} · Année scolaire ${echapper(annee)}</div>

    <div class="ident">
      ${ligneIdent("Nom et prénoms", echapper(`${eleve.nom || ""} ${eleve.prenom || ""}`))}
      ${ligneIdent("Classe", echapper(eleve.classe || "—"))}
      <div class="photo">${photoHTML(eleve, { w: 22, h: 27, bord: OR })}</div>
      ${ligneIdent("Né(e) le", `${echapper(dateFr(eleve.dateNaissance) || "—")}${eleve.lieuNaissance ? ` à ${echapper(eleve.lieuNaissance)}` : ""}`)}
      ${ligneIdent("Effectif", classStats ? `${classStats.effectif} élèves` : "—")}
      ${ligneIdent("Matricule", echapper(eleve.matricule || "—"))}
      ${ligneIdent("N° IEN", echapper(eleve.ien || "—"))}
      ${eleve.filiation ? ligneIdent("Filiation", echapper(eleve.filiation), true) : ""}
    </div>

    <table>
      <thead><tr>${entetes}</tr></thead>
      <tbody>
        ${lignes}
        <tr class="tot"><td>Totaux</td><td>${m.totalCoef}</td>${m.avecDetail ? "<td></td><td></td>" : ""}<td></td><td>${nb(m.totalPts)}</td><td colspan="${m.avecRang ? 2 : 1}" class="g">sur ${m.totalMax}</td></tr>
      </tbody>
    </table>

    <div class="ruban">
      <div><small>${estAnnuel ? "Moyenne annuelle" : "Moyenne générale"}</small><b>${nb(m.moyGene)} <em>/ ${maxNote}</em></b></div>
      <div><small>Rang</small><b>${rang ? `${ordinal(rang.rang, sexe)} <em>sur ${rang.effectif}</em>` : "—"}</b></div>
      <div><small>Mention</small><b class="it">${mentionFr(m.mention)}</b></div>
    </div>
    <div class="stats">${stats}</div>

    <div class="bas${distinction ? "" : " seul"}">
      <div class="appr">${appreciation ? echapper(appreciation) : `<span class="vide"></span><span class="vide"></span>`}<span class="qui">Appréciation générale</span></div>
      ${distinction ? `<div class="sceau">${sceau(distinction, echapper(annee))}</div>` : ""}
    </div>

    <div class="fait">Fait à ${ecole.ville || "……………………"}, le ${dateDuJour()}</div>
    <div class="sigs">${sigs}</div>

    <div class="pied">
      <div class="qr">${qr || ""}</div>
      <div class="t">${si.devise ? `<div class="devise">${echapper(si.devise)}</div>` : ""}${mentionsPied(si, niveau, m.numero, !!qr)}</div>
      <div class="qr"></div>
    </div>
  </div></div></div>`;
}

export const STYLES_PRESTIGE = `
  .bp{padding:7mm;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a}
  .bp .cadre1{flex:1;display:flex;border:.55mm solid var(--c1);padding:1.3mm}
  .bp .cadre2{flex:1;border:.25mm solid ${OR};padding:6mm 9mm 4mm;display:flex;flex-direction:column;position:relative}
  .bp .coin{position:absolute;width:7mm;height:7mm;border-color:${OR};border-style:solid}
  .bp .coin.a{top:1.4mm;left:1.4mm;border-width:.5mm 0 0 .5mm}
  .bp .coin.b{top:1.4mm;right:1.4mm;border-width:.5mm .5mm 0 0}
  .bp .coin.c{bottom:1.4mm;left:1.4mm;border-width:0 0 .5mm .5mm}
  .bp .coin.d{bottom:1.4mm;right:1.4mm;border-width:0 .5mm .5mm 0}
  .bp .etat{text-align:center;font-size:7.8px;letter-spacing:.04em;color:#444;line-height:1.5}
  .bp .etat .rep{letter-spacing:.16em;text-transform:uppercase}
  .bp .ecole{text-align:center;margin-top:2.5mm}
  .bp .ecole .nom{font:700 19px "Times New Roman",serif;font-variant:small-caps;letter-spacing:.08em;color:var(--c1);margin-top:1.5mm}
  .bp .ecole .coord{font-size:8px;color:#666;margin-top:.6mm}
  .bp .orn{display:flex;align-items:center;gap:3mm;margin:2.4mm 18mm 1.6mm;color:${OR}}
  .bp .orn:before,.bp .orn:after{content:"";flex:1;height:.25mm;background:${OR}}
  .bp h1{margin:0;text-align:center;font:italic 400 27px "Times New Roman",serif;color:var(--c1);letter-spacing:.02em}
  .bp .per{text-align:center;font:400 11px "Times New Roman",serif;font-variant:small-caps;letter-spacing:.14em;color:#444;margin-top:.5mm}
  .bp .ident{display:grid;grid-template-columns:1fr 1fr 24mm;gap:1.4mm 7mm;margin-top:3.5mm;font-size:9.6px;align-items:end}
  .bp .ligne{display:flex;align-items:baseline;gap:1.5mm;white-space:nowrap;min-width:0}
  .bp .ligne.large{grid-column:1/span 2}
  .bp .ligne span{color:#555}
  .bp .ligne:after{content:"";order:1;flex:1;border-bottom:.3mm dotted #999;transform:translateY(-.6mm)}
  .bp .ligne b{order:2;font:700 11px "Times New Roman",serif;color:var(--c1);overflow:hidden;text-overflow:ellipsis}
  .bp .ident .photo{grid-column:3;grid-row:1/span 4}
  .bp table{width:100%;border-collapse:collapse;margin-top:4mm}
  .bp th{font:700 9.6px "Times New Roman",serif;font-variant:small-caps;letter-spacing:.06em;color:var(--c1);padding:1.6mm 1.5mm;border-top:.5mm solid var(--c1);border-bottom:.25mm solid var(--c1);text-align:center}
  .bp th.g,.bp td.g{text-align:left}
  .bp td{padding:1.4mm 1.5mm;font-size:9.6px;text-align:center;border-bottom:.2mm solid #e6e1d6;font-variant-numeric:tabular-nums}
  .bp td.m{font:700 10.6px "Times New Roman",serif;color:#1a1a1a;text-align:left}
  .bp td.moy{font-weight:700;color:var(--c1)}
  .bp td.ap{font:italic 10px "Times New Roman",serif;color:#444;text-align:left}
  .bp tr.tot td{border-top:.25mm solid var(--c1);border-bottom:.5mm solid var(--c1);font:italic 700 10.4px "Times New Roman",serif;color:var(--c1)}
  .bp tr.tot td:first-child{text-align:left}
  .bp .ruban{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:4mm;border-top:.25mm solid ${OR};border-bottom:.25mm solid ${OR}}
  .bp .ruban div{text-align:center;padding:2.2mm 0 2mm}
  .bp .ruban div+div{border-left:.25mm solid ${OR}}
  .bp .ruban small{display:block;font-size:7.6px;letter-spacing:.14em;text-transform:uppercase;color:#7a6338}
  .bp .ruban b{display:block;font:700 23px "Times New Roman",serif;color:var(--c1);line-height:1.15}
  .bp .ruban b.it{font-style:italic}
  .bp .ruban em{font-size:12px;font-style:normal;color:#666;font-weight:400}
  .bp .stats{text-align:center;font-size:8.6px;color:#555;margin-top:1.8mm;letter-spacing:.02em}
  .bp .bas{display:grid;grid-template-columns:1fr 30mm;gap:5mm;margin-top:3mm;align-items:center}
  .bp .bas.seul{grid-template-columns:1fr}
  .bp .appr{font:italic 11.2px "Times New Roman",serif;line-height:1.55;color:#222;position:relative;padding:1mm 0 0 9mm}
  .bp .appr:before{content:"\\201C";position:absolute;left:0;top:-3.5mm;font:700 36px "Times New Roman",serif;color:${OR}}
  .bp .appr .vide{display:block;border-bottom:.25mm dotted #bbb;height:5mm}
  .bp .appr .qui{display:block;font-style:normal;font-size:8.2px;letter-spacing:.1em;text-transform:uppercase;color:#7a6338;margin-top:1mm}
  .bp .sceau{text-align:center}
  .bp .fait{text-align:right;font:italic 10px "Times New Roman",serif;margin-top:3mm}
  .bp .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6mm;margin-top:2mm}
  .bp .sig{text-align:center;font:700 9.6px "Times New Roman",serif;font-variant:small-caps;letter-spacing:.06em;color:var(--c1);min-height:18mm;border-bottom:.25mm solid #999}
  .bp .sig small{display:block;font:400 7.4px Arial;font-variant:normal;letter-spacing:0;color:#888}
  .bp .pied{margin-top:auto;display:flex;align-items:center;gap:3mm;font-size:7.2px;color:#777;line-height:1.5;padding-top:2mm}
  .bp .pied .qr{width:23mm;flex-shrink:0}
  .bp .pied .qr img{display:block;width:23mm;height:23mm}
  .bp .pied .t{flex:1;text-align:center}
  .bp .devise{font:italic 700 10px "Times New Roman",serif;color:var(--c1)}
  .bp.d1 td{padding:1mm 1.5mm}
  .bp.d1 .sig{min-height:15mm}
  .bp.d2 td{padding:.7mm 1.3mm;font-size:9px}
  .bp.d2 td.m{font-size:9.8px}
  .bp.d2 .ecole .coord,.bp.d2 .orn{display:none}
  .bp.d2 .sig{min-height:14mm}
`;
