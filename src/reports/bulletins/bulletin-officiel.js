// ══════════════════════════════════════════════════════════════
//  Modèle « Officiel » — le bulletin administratif guinéen
// ══════════════════════════════════════════════════════════════
// Tableau quadrillé, encadrés « Résultats / Classe / Assiduité », cases du
// conseil de classe, zones de signature avec cachet. Aucun aplat lourd :
// il s'imprime net en noir et blanc et consomme peu d'encre.
import {
  DECISIONS_FIN_ANNEE, DISTINCTIONS, SANCTIONS, compteur, dateDuJour, dateFr, echapper, imageSignature,
  libellePeriode, logoHTML, mentionFr, mentionsPied, nb, ordinal, periodeCourte, photoHTML,
  signaturesBulletin, titreBulletin,
} from "./bulletin-pro-commun.js";

const caseCochee = (label, cochee) =>
  `<span class="case"><i>${cochee ? "✕" : ""}</i>${cochee ? `<b>${label}</b>` : label}</span>`;

const ligneBloc = (label, valeur) => `<div class="r"><span>${label}</span><b>${valeur}</b></div>`;

export function buildBulletinOfficielHTML(ctx) {
  const { eleve, m, si, ecole, niveau, maxNote, periode, annee, rang, classStats, evolution,
    moyennesPeriodes, assiduite, appreciation, qr, estAnnuel, densite } = ctx;
  const sexe = eleve.sexe;

  const colonnes = [
    `<th class="g">Matières</th>`,
    `<th style="width:10mm">Coef.</th>`,
    m.avecDetail ? `<th style="width:14mm">Notes de classe</th><th style="width:13mm">Compo&shy;sition</th>` : "",
    `<th style="width:15mm">${estAnnuel ? "Moy. annuelle" : "Moyenne"} /${maxNote}</th>`,
    `<th style="width:15mm">Moy. × Coef.</th>`,
    m.avecRang ? `<th style="width:10mm">Rang</th>` : "",
    `<th style="width:20mm">Appréciation</th>`,
    m.avecProf ? `<th class="g">Professeur</th>` : "",
  ].join("");

  const lignes = m.lignes.map((l) => `<tr>
    <td class="m">${echapper(l.mat)}</td><td>${l.coef}</td>
    ${m.avecDetail ? `<td>${nb(l.cours)}</td><td>${nb(l.compo)}</td>` : ""}
    <td class="moy">${nb(l.moy)}</td><td>${nb(l.pts)}</td>
    ${m.avecRang ? `<td>${ordinal(l.rang, sexe)}</td>` : ""}
    <td class="ap">${mentionFr(l.mention)}</td>
    ${m.avecProf ? `<td class="p">${echapper(l.prof)}</td>` : ""}
  </tr>`).join("");
  // Cellules après « Moy. × Coef. » : rang, appréciation, professeur.
  const apresPoints = 1 + (m.avecRang ? 1 : 0) + (m.avecProf ? 1 : 0);

  const blocClasse = classStats ? `<div class="bloc"><h3>Résultats de la classe</h3>
    ${ligneBloc("Moyenne de la classe", nb(classStats.moyenneClasse))}
    ${ligneBloc("Plus forte moyenne", nb(classStats.max))}
    ${ligneBloc("Plus faible moyenne", nb(classStats.min))}
    ${ligneBloc("Effectif", classStats.effectif)}
  </div>` : "";

  const recap = estAnnuel && moyennesPeriodes?.length
    ? `<div class="recap">Moyennes des périodes : ${moyennesPeriodes.map((p) => `${periodeCourte(p.periode)} <b>${nb(p.moy)}</b>`).join(" · ")} · Année <b>${nb(m.moyGene)}</b></div>`
    : "";

  const cases = [
    ...DISTINCTIONS.map((d) => caseCochee(d.label, m.distinction === d.id)),
    ...(estAnnuel ? DECISIONS_FIN_ANNEE : SANCTIONS).map((s) => caseCochee(s, false)),
  ].join("");

  const sigs = signaturesBulletin(si, niveau, ({ titre, note, image }) =>
    `<div class="sig">${titre}<small>${note}</small>${imageSignature(image)}</div>`);

  return `
  <div class="page pro bo ${densite}" style="--c1:${ctx.c1};--c2:${ctx.c2}">
    <div class="head">
      <div class="g"><b>${ecole.pays.toUpperCase()}</b><br/>${ecole.devise}<br/>${ecole.ministere}${ecole.tutelle ? `<br/>${ecole.tutelle}` : ""}</div>
      <div>${logoHTML(ecole.logo, 22)}</div>
      <div class="d"><span class="nom">${ecole.nom}</span>${[ecole.agrement, ecole.adresse, ecole.contact].filter(Boolean).join("<br/>")}</div>
    </div>

    <div class="titre">
      <div class="cadre"><h1>${titreBulletin(periode).toUpperCase()}</h1><div class="sous">${libellePeriode(periode)} — Année scolaire ${echapper(annee)}</div></div>
      ${qr ? `<div class="qr">${qr}<div>N° ${echapper(m.numero)}</div></div>` : ""}
    </div>

    <table class="ident">
      <tr><td class="l">Nom et prénoms</td><td class="v nom">${echapper(`${eleve.nom || ""} ${eleve.prenom || ""}`)}</td><td class="l">Classe</td><td class="v">${echapper(eleve.classe || "—")}</td><td class="photo" rowspan="${eleve.filiation ? 4 : 3}">${photoHTML(eleve, { w: 21, h: 26, bord: "#9aa3ad" })}</td></tr>
      <tr><td class="l">Né(e) le</td><td class="v">${echapper(dateFr(eleve.dateNaissance) || "—")}${eleve.lieuNaissance ? ` à ${echapper(eleve.lieuNaissance)}` : ""}</td><td class="l">Effectif</td><td class="v">${classStats ? `${classStats.effectif} élèves` : "—"}</td></tr>
      <tr><td class="l">Matricule</td><td class="v">${echapper(eleve.matricule || "—")}</td><td class="l">N° IEN</td><td class="v">${echapper(eleve.ien || "—")}</td></tr>
      ${eleve.filiation ? `<tr><td class="l">Filiation</td><td class="v" colspan="3">${echapper(eleve.filiation)}</td></tr>` : ""}
    </table>

    <table class="notes">
      <thead><tr>${colonnes}</tr></thead>
      <tbody>
        ${lignes}
        <tr class="tot"><td class="m">TOTAUX</td><td>${m.totalCoef}</td>${m.avecDetail ? "<td></td><td></td>" : ""}<td></td><td>${nb(m.totalPts)}</td><td colspan="${apresPoints}" class="g">sur ${m.totalMax} points</td></tr>
      </tbody>
    </table>

    <div class="blocs">
      <div class="bloc"><h3>Résultats de l'élève</h3>
        <div class="r"><span>${estAnnuel ? "Moyenne annuelle" : "Moyenne générale"}</span><span class="gros">${nb(m.moyGene)} <small>/ ${maxNote}</small></span></div>
        ${ligneBloc("Rang", rang ? `${ordinal(rang.rang, sexe)} sur ${rang.effectif}` : "—")}
        ${ligneBloc("Mention", mentionFr(m.mention))}
        ${evolution && !estAnnuel ? ligneBloc(`Moyenne ${periodeCourte(evolution.periodePrec)}`, nb(evolution.moyPrec)) : ""}
      </div>
      ${blocClasse}
      <div class="bloc"><h3>Assiduité et conduite</h3>
        ${ligneBloc("Absences justifiées", compteur(assiduite, "absJ"))}
        ${ligneBloc("Absences non justifiées", compteur(assiduite, "absNJ"))}
        ${ligneBloc("Retards", compteur(assiduite, "retards"))}
        ${ligneBloc("Conduite", "……………")}
      </div>
    </div>
    ${recap}

    <div class="duo">
      <div class="bloc"><h3>${estAnnuel ? "Décision de fin d'année" : "Décision du conseil des professeurs"}</h3><div class="cases">${cases}</div></div>
      <div class="bloc"><h3>Appréciation générale</h3><div class="appr">${appreciation ? echapper(appreciation) : `<span class="vide"></span><span class="vide"></span><span class="vide"></span>`}</div></div>
    </div>

    <div class="fait">Fait à ${ecole.ville || "……………………"}, le ${dateDuJour()}</div>
    <div class="sigs">${sigs}</div>

    <div class="pied">
      ${si.devise ? `<div class="devise">${echapper(si.devise)}</div>` : ""}
      ${mentionsPied(si, niveau, m.numero, !!qr)}
    </div>
  </div>`;
}

export const STYLES_OFFICIEL = `
  .bo{padding:10mm 11mm 7mm;font-size:9.6px;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif}
  .bo table{width:100%;border-collapse:collapse}
  .bo .head{display:grid;grid-template-columns:1fr 24mm 1fr;gap:4mm;align-items:center;padding-bottom:3mm;border-bottom:1.2mm double var(--c1)}
  .bo .head .g{font-size:8.6px;line-height:1.45;color:#222}
  .bo .head .g b{font-size:9.6px;letter-spacing:.04em}
  .bo .head .d{text-align:right;font-size:8.6px;line-height:1.45;color:#333}
  .bo .head .d .nom{font:700 13.5px "Times New Roman",Times,serif;color:var(--c1);letter-spacing:.02em;line-height:1.2;display:block;margin-bottom:1mm;text-transform:uppercase}
  .bo .titre{display:flex;gap:4mm;align-items:stretch;margin:3.5mm 0 3mm}
  .bo .titre .cadre{flex:1;border:.9mm double var(--c1);text-align:center;padding:2.2mm 0 1.8mm;display:flex;flex-direction:column;justify-content:center}
  .bo .titre h1{margin:0;font:700 21px "Times New Roman",Times,serif;letter-spacing:.16em;color:var(--c1)}
  .bo .titre .sous{font-size:9.4px;letter-spacing:.12em;margin-top:.8mm;text-transform:uppercase;color:#333}
  .bo .titre .qr{text-align:center;font-size:6.6px;color:#555;line-height:1.25;flex-shrink:0}
  .bo .titre .qr img{display:block;width:23mm;height:23mm;margin:0 auto .5mm}
  .bo .ident td{border:.25mm solid #9aa3ad;padding:1.6mm 2mm;font-size:9.4px}
  .bo .ident td.l{background:#f1f3f6;color:#444;width:24mm;font-size:8.6px}
  .bo .ident td.v{font-weight:700}
  .bo .ident td.nom{font-size:11px}
  .bo .ident td.photo{width:25mm;padding:1mm;text-align:center;vertical-align:middle}
  .bo .notes{margin-top:3mm}
  .bo .notes th{background:#eef0f3;background:color-mix(in srgb,var(--c1) 9%,#fff);color:var(--c1);border:.25mm solid #7d8792;padding:1.5mm 1.2mm;font-size:8.2px;line-height:1.15;text-transform:uppercase;letter-spacing:.02em;text-align:center}
  .bo .notes th.g,.bo .notes td.g{text-align:left}
  .bo .notes td{border:.25mm solid #9aa3ad;padding:1.9mm 1.6mm;font-size:9.4px;text-align:center;font-variant-numeric:tabular-nums}
  .bo .notes td.m{text-align:left;font-weight:700}
  .bo .notes td.p{text-align:left;font-size:8.2px;color:#444}
  .bo .notes td.ap{text-align:left;font-size:8.8px}
  .bo .notes td.moy{font-weight:700}
  .bo .notes tr.tot td{background:#eef0f3;background:color-mix(in srgb,var(--c1) 9%,#fff);font-weight:700;color:var(--c1)}
  .bo .blocs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2.5mm;margin-top:3mm}
  .bo .bloc{border:.25mm solid #7d8792}
  .bo .bloc h3{margin:0;background:var(--c1);color:#fff;font-size:8px;letter-spacing:.08em;text-transform:uppercase;padding:1.2mm 2mm}
  .bo .bloc .r{display:flex;justify-content:space-between;align-items:baseline;padding:1.3mm 2mm;border-top:.2mm solid #e1e5ea;font-size:9.2px}
  .bo .bloc h3+.r{border-top:0}
  .bo .bloc .r b{font-variant-numeric:tabular-nums}
  .bo .bloc .gros{font:700 17px "Times New Roman",serif;color:var(--c1)}
  .bo .bloc .gros small{font-size:10px}
  .bo .recap{margin-top:2mm;padding:1.4mm 2mm;border:.25mm solid #c3c9d0;font-size:9px;text-align:center}
  .bo .duo{display:grid;grid-template-columns:1fr 1.25fr;gap:2.5mm;margin-top:2.5mm}
  .bo .cases{padding:1.6mm 2mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,auto);grid-auto-flow:column;gap:1.1mm 3mm;font-size:9px}
  .bo .case{display:flex;align-items:center;gap:1.6mm}
  .bo .case i{width:3.2mm;height:3.2mm;border:.3mm solid #333;display:inline-flex;align-items:center;justify-content:center;font:700 9px Arial;font-style:normal;flex-shrink:0}
  .bo .appr{padding:2mm 2.4mm;font-size:9.8px;line-height:1.55;font-style:italic;min-height:16mm}
  .bo .appr .vide{display:block;border-bottom:.25mm dotted #9aa3ad;height:4.6mm}
  .bo .fait{text-align:right;font-size:9.4px;margin:3mm 1mm 1.5mm}
  .bo .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4mm}
  .bo .sig{text-align:center;font-size:9px;font-weight:700;color:var(--c1);min-height:23mm;border:.25mm solid #c3c9d0;padding-top:1.4mm}
  .bo .sig small{display:block;font-weight:400;color:#666;font-size:7.6px}
  .bo .pied{margin-top:auto;padding-top:1.6mm;border-top:.25mm solid #c3c9d0;text-align:center;font-size:7.4px;color:#666;line-height:1.5}
  .bo .devise{font:italic 700 10px "Times New Roman",serif;color:var(--c1);margin-bottom:.6mm}
  .bo.d1 .notes td{padding:1.1mm 1.5mm}
  .bo.d1 .bloc .r{padding:1.1mm 2mm}
  .bo.d1 .sig{min-height:20mm}
  .bo.d2 .notes td{padding:.9mm 1.3mm;font-size:8.8px}
  .bo.d2 .bloc .r{padding:.9mm 2mm}
  .bo.d2 .sig{min-height:18mm}
`;
