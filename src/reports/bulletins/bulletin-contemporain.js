// ══════════════════════════════════════════════════════════════
//  Modèle « Contemporain » — lecture rapide pour les parents
// ══════════════════════════════════════════════════════════════
// Chiffres clés en tête (moyenne, rang, mention), position de l'élève par
// rapport à la classe dans chaque matière, courbe de progression. Moderne
// mais sobre : filets et contours, aucun aplat de couleur lourd.
import {
  compteur, dateDuJour, dateFr, echapper, imageSignature, libelleDistinction, libellePeriode, logoHTML,
  mentionFr, mentionsPied, nb, ordinal, periodeCourte, photoHTML, signaturesBulletin, titreBulletin,
} from "./bulletin-pro-commun.js";

// Petite courbe des moyennes générales de la période (mm). Les périodes pas
// encore notées gardent leur étiquette, sans point.
function courbe(moyennesPeriodes, maxNote, moyClasse) {
  const W = 54, H = 17, n = moyennesPeriodes.length;
  const x = (i) => (n === 1 ? W / 2 : 6 + (i * (W - 12)) / (n - 1));
  const y = (v) => H - 2 - (Math.max(0, Math.min(maxNote, v)) / maxNote) * (H - 5);
  const points = moyennesPeriodes.map((p, i) => ({ ...p, i })).filter((p) => p.moy != null);
  const ligneClasse = moyClasse != null
    ? `<line x1="2" x2="${W - 2}" y1="${y(moyClasse)}" y2="${y(moyClasse)}" stroke="#bbb" stroke-width=".25" stroke-dasharray="1 1"/>
       <text x="2" y="${y(moyClasse) + 2.6}" font-size="2.2" fill="#999">classe ${nb(moyClasse)}</text>`
    : "";
  const petites = n > 4;
  return `<svg width="${W}mm" height="${H + 5}mm" viewBox="0 0 ${W} ${H + 5}" aria-hidden="true">
    ${ligneClasse}
    ${points.length > 1 ? `<polyline points="${points.map((p) => `${x(p.i)},${y(p.moy)}`).join(" ")}" fill="none" stroke="var(--c1)" stroke-width=".6"/>` : ""}
    ${points.map((p) => `<circle cx="${x(p.i)}" cy="${y(p.moy)}" r="1.1" fill="var(--c1)"/>
      ${petites ? "" : `<text x="${x(p.i)}" y="${y(p.moy) - 2}" font-size="2.6" font-weight="700" fill="var(--c1)" text-anchor="middle">${nb(p.moy)}</text>`}`).join("")}
    ${moyennesPeriodes.map((p, i) => `<text x="${x(i)}" y="${H + 3.5}" font-size="${petites ? 2 : 2.4}" fill="#777" text-anchor="middle">${echapper(periodeCourte(p.periode))}</text>`).join("")}
  </svg>`;
}

const ligneCarte = (label, valeur) => `<div class="r"><span>${label}</span><b>${valeur}</b></div>`;

export function buildBulletinContemporainHTML(ctx) {
  const { eleve, m, si, ecole, niveau, maxNote, periode, annee, rang, classStats, evolution,
    moyennesPeriodes, assiduite, appreciation, qr, estAnnuel, densite } = ctx;
  const sexe = eleve.sexe;
  const pct = (v) => `${Math.max(0, Math.min(100, (v / maxNote) * 100)).toFixed(1)}%`;

  const entetes = [
    `<th class="g">Matière${m.avecProf ? " · professeur" : ""}</th>`, `<th>Coef.</th>`,
    m.avecDetail ? `<th>Classe</th><th>Compo.</th>` : "",
    `<th>${estAnnuel ? "Moy. ann." : "Moyenne"}</th>`, `<th>Points</th>`,
    m.avecRang ? `<th>Rang</th>` : "",
    m.avecMoyClasse ? `<th>Position / classe</th>` : "",
    `<th class="g">Appréciation</th>`,
  ].join("");
  const lignes = m.lignes.map((l) => `<tr>
    <td class="m">${echapper(l.mat)}${m.avecProf ? `<small>${echapper(l.prof) || "&nbsp;"}</small>` : ""}</td><td>${l.coef}</td>
    ${m.avecDetail ? `<td>${nb(l.cours)}</td><td>${nb(l.compo)}</td>` : ""}
    <td class="moy">${nb(l.moy)}</td><td>${nb(l.pts)}</td>
    ${m.avecRang ? `<td>${ordinal(l.rang, sexe)}</td>` : ""}
    ${m.avecMoyClasse ? `<td><div class="pos">${l.moyClasse != null ? `<span class="c" style="left:${pct(l.moyClasse)}"></span>` : ""}${l.moy != null ? `<span class="e" style="left:${pct(l.moy)}"></span>` : ""}</div></td>` : ""}
    <td class="ap">${mentionFr(l.mention)}</td>
  </tr>`).join("");
  const colsApres = (m.avecRang ? 1 : 0) + (m.avecMoyClasse ? 1 : 0) + 1;

  // Courbe : toutes les périodes de l'année en abscisse, des points jusqu'à
  // la période imprimée seulement — un bulletin du 1er trimestre réimprimé
  // en avril ne montre pas les trimestres suivants.
  const idx = moyennesPeriodes ? moyennesPeriodes.findIndex((p) => p.periode === periode) : -1;
  const serie = (moyennesPeriodes || []).map((p, i) => (!estAnnuel && idx >= 0 && i > idx ? { ...p, moy: null } : p));
  const progression = serie.length
    ? courbe(serie, maxNote, classStats?.moyenneClasse ?? null)
    : `<div class="vide">${evolution ? `${periodeCourte(evolution.periodePrec)} : ${nb(evolution.moyPrec)} → ${nb(evolution.moyActu)}` : "—"}</div>`;

  const distinction = libelleDistinction(m.distinction);
  const sigs = signaturesBulletin(si, niveau, ({ titre, note, image }) =>
    `<div class="sig">${titre}<small>${note}</small>${imageSignature(image)}</div>`);

  return `
  <div class="page pro bc ${densite}" style="--c1:${ctx.c1};--c2:${ctx.c2}">
    <div class="head">
      <div class="marque">${ecole.logo ? `<div class="logo">${logoHTML(ecole.logo, 15)}</div>` : ""}<div><div class="nom">${ecole.nom}</div><div class="coord">${[ecole.adresse, ecole.contact].filter(Boolean).join(" · ")}${ecole.agrement ? `<br/>${ecole.agrement}` : ""}</div></div></div>
      <div class="etat"><b>${ecole.pays.toUpperCase()}</b><br/>${ecole.devise}<br/>${ecole.ministere}${ecole.tutelle ? `<br/>${ecole.tutelle}` : ""}</div>
    </div>

    <div class="titre">
      <div><div class="surt">${titreBulletin(periode)}</div><h1>${libellePeriode(periode)} · ${echapper(annee)}</h1></div>
      ${qr ? `<div class="ref"><div>N° ${echapper(m.numero)}<br/>Scannez pour vérifier<br/>l'authenticité</div>${qr}</div>` : ""}
    </div>

    <div class="eleve">
      ${photoHTML(eleve, { w: 20, h: 25, bord: "#d5dbe1" })}
      <div class="qui"><div class="nom">${echapper(`${eleve.nom || ""} ${eleve.prenom || ""}`)}</div>
        <div class="infos">${[
          `<b>${echapper(eleve.classe || "—")}</b>${classStats ? ` · ${classStats.effectif} élèves` : ""}`,
          [eleve.matricule && `Matricule ${echapper(eleve.matricule)}`, eleve.ien && `IEN ${echapper(eleve.ien)}`].filter(Boolean).join(" · "),
          eleve.dateNaissance ? `Né(e) le ${echapper(dateFr(eleve.dateNaissance))}${eleve.lieuNaissance ? ` à ${echapper(eleve.lieuNaissance)}` : ""}` : "",
          eleve.filiation ? echapper(eleve.filiation) : "",
        ].filter(Boolean).map((ligne) => `<span>${ligne}</span>`).join("")}</div></div>
      <div class="kpis">
        <div class="kpi fort"><small>${estAnnuel ? "Moy. annuelle" : "Moyenne"}</small><b>${nb(m.moyGene)}<em>/${maxNote}</em></b></div>
        <div class="kpi"><small>Rang</small><b>${rang ? `${ordinal(rang.rang, sexe)}<em>/${rang.effectif}</em>` : "—"}</b></div>
        <div class="kpi"><small>Mention</small><b class="txt">${mentionFr(m.mention)}</b></div>
      </div>
    </div>

    <table>
      <thead><tr>${entetes}</tr></thead>
      <tbody>
        ${lignes}
        <tr class="tot"><td>Totaux</td><td>${m.totalCoef}</td>${m.avecDetail ? "<td></td><td></td>" : ""}<td>${nb(m.moyGene)}</td><td>${nb(m.totalPts)}</td><td colspan="${colsApres}" class="g leg">sur ${m.totalMax} points${m.avecMoyClasse ? " &nbsp;·&nbsp; ● élève &nbsp;| moyenne de la classe" : ""}</td></tr>
      </tbody>
    </table>

    <div class="grille">
      <div class="carte"><h3>Progression</h3>${progression}</div>
      ${classStats ? `<div class="carte"><h3>La classe</h3>
        ${ligneCarte("Moyenne", nb(classStats.moyenneClasse))}${ligneCarte("Plus forte", nb(classStats.max))}${ligneCarte("Plus faible", nb(classStats.min))}${ligneCarte("Effectif", classStats.effectif)}</div>` : ""}
      <div class="carte"><h3>Assiduité</h3>
        ${ligneCarte("Absences justifiées", compteur(assiduite, "absJ"))}${ligneCarte("Non justifiées", compteur(assiduite, "absNJ"))}${ligneCarte("Retards", compteur(assiduite, "retards"))}${ligneCarte("Conduite", "……………")}</div>
    </div>

    <div class="appr"><h3>Appréciation générale</h3>${appreciation ? echapper(appreciation) : `<span class="vide"></span><span class="vide"></span>`}
      ${distinction ? `<div><span class="badge">★ ${distinction}</span></div>` : ""}</div>

    <div class="fait">Fait à ${ecole.ville || "……………………"}, le ${dateDuJour()}</div>
    <div class="sigs">${sigs}</div>

    <div class="pied">${si.devise ? `<div class="devise">${echapper(si.devise)}</div>` : ""}${mentionsPied(si, niveau, m.numero, !!qr)}</div>
  </div>`;
}

export const STYLES_CONTEMPORAIN = `
  .bc{padding:11mm 12mm 7mm;font-size:9.6px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a}
  .bc .head{display:flex;justify-content:space-between;align-items:center;gap:6mm;padding-bottom:3mm;border-bottom:.7mm solid var(--c2)}
  .bc .marque{display:flex;gap:3mm;align-items:center;min-width:0}
  .bc .marque .logo{flex-shrink:0}
  .bc .marque .nom{font:800 14.5px Arial;color:var(--c1);letter-spacing:.01em;text-transform:uppercase}
  .bc .marque .coord{font-size:8px;color:#666;line-height:1.5;margin-top:.5mm}
  .bc .etat{text-align:right;font-size:7.8px;color:#555;line-height:1.5;max-width:80mm}
  .bc .etat b{color:#222;letter-spacing:.06em}
  .bc .titre{display:flex;justify-content:space-between;align-items:flex-end;margin-top:4.5mm}
  .bc .surt{font:700 8.4px Arial;letter-spacing:.2em;color:var(--c1);opacity:.75;text-transform:uppercase}
  .bc h1{margin:.6mm 0 0;font:800 22px Arial;color:var(--c1);letter-spacing:-.01em}
  .bc .ref{display:flex;gap:2.5mm;align-items:center;font-size:7px;color:#777;text-align:right;line-height:1.35}
  .bc .ref img{display:block;width:23mm;height:23mm}
  .bc .eleve{display:grid;grid-template-columns:22mm 1fr auto;gap:4mm;align-items:center;margin-top:4mm;padding:3mm;border:.3mm solid #e1e6eb;border-radius:2mm}
  .bc .eleve .nom{font:800 15px Arial;color:var(--c1)}
  .bc .eleve .infos{font-size:9px;color:#444;line-height:1.55;margin-top:.4mm}
  .bc .eleve .infos span{display:block}
  .bc .kpis{display:flex;gap:2mm}
  .bc .kpi{border:.3mm solid #d5dbe1;border-radius:1.6mm;padding:1.8mm 3mm;text-align:center;min-width:21mm}
  .bc .kpi.fort{border:.5mm solid var(--c2)}
  .bc .kpi small{display:block;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#777}
  .bc .kpi b{display:block;font:800 17px Arial;color:var(--c1);line-height:1.2;font-variant-numeric:tabular-nums}
  .bc .kpi b.txt{font-size:12.5px;line-height:1.65}
  .bc .kpi em{font-style:normal;font-size:9px;color:#888;font-weight:400}
  .bc table{width:100%;border-collapse:collapse;margin-top:4mm}
  .bc th{font:700 7.4px Arial;letter-spacing:.1em;text-transform:uppercase;color:#666;padding:1.4mm 1.4mm 1.6mm;border-bottom:.45mm solid var(--c1);text-align:center}
  .bc th.g,.bc td.g{text-align:left}
  .bc td{padding:1.7mm 1.4mm;font-size:9.4px;text-align:center;border-bottom:.2mm solid #e5e9ee;font-variant-numeric:tabular-nums}
  .bc td.m{font-weight:700;color:var(--c1);text-align:left}
  .bc td.m small{display:block;font-weight:400;color:#888;font-size:7.6px}
  .bc td.moy{font-weight:800;color:var(--c1);font-size:10.2px}
  .bc td.ap{text-align:left;font-size:8.8px;color:#444}
  .bc .pos{position:relative;width:20mm;height:1.6mm;background:#e8ecf0;border-radius:1mm;margin:0 auto}
  .bc .pos .c{position:absolute;top:-.7mm;width:.4mm;height:3mm;background:#888}
  .bc .pos .e{position:absolute;top:-.5mm;width:2.6mm;height:2.6mm;border-radius:50%;background:var(--c1);margin-left:-1.3mm}
  .bc tr.tot td{border-bottom:0;border-top:.45mm solid var(--c1);font-weight:800;color:var(--c1)}
  .bc tr.tot td:first-child{text-align:left}
  .bc tr.tot td.leg{font-size:7.4px;font-weight:400;color:#777}
  .bc .grille{display:grid;grid-template-columns:1.2fr;grid-auto-flow:column;grid-auto-columns:1fr;gap:3mm;margin-top:4mm}
  .bc .carte{border:.3mm solid #e1e6eb;border-radius:1.6mm;padding:2.2mm 2.6mm}
  .bc .carte h3,.bc .appr h3{margin:0 0 1.4mm;font:700 7.4px Arial;letter-spacing:.12em;text-transform:uppercase;color:var(--c1);opacity:.8}
  .bc .carte .r{display:flex;justify-content:space-between;font-size:9.2px;padding:.8mm 0;color:#333}
  .bc .carte .r b{color:var(--c1);font-variant-numeric:tabular-nums}
  .bc .carte .vide{font-size:9px;color:#555;padding-top:2mm}
  .bc .appr{margin-top:4mm;border-left:.9mm solid var(--c2);padding:1.6mm 3mm;background:#f5f7f9;font-size:10px;line-height:1.5;color:#222}
  .bc .appr .vide{display:block;border-bottom:.25mm dotted #bbb;height:5mm}
  .bc .badge{display:inline-block;border:.3mm solid var(--c2);color:var(--c1);border-radius:4mm;padding:.5mm 2.6mm;font-size:8.4px;font-weight:700;margin-top:1mm}
  .bc .fait{text-align:right;font-size:9px;color:#444;margin-top:3mm}
  .bc .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:5mm;margin-top:1.5mm}
  .bc .sig{font-size:8.6px;font-weight:700;color:var(--c1);min-height:22mm;border-top:.35mm solid var(--c1);padding-top:1.2mm}
  .bc .sig small{display:block;font-weight:400;color:#777;font-size:7.4px}
  .bc .pied{margin-top:auto;padding-top:1.6mm;border-top:.2mm solid #e1e6eb;text-align:center;font-size:7.2px;color:#888;line-height:1.5}
  .bc .devise{font:italic 700 9px Arial;color:var(--c1)}
  .bc.d1 td{padding:1.2mm 1.4mm}
  .bc.d1 td.m small,.bc.d2 td.m small{display:inline;margin-left:1.5mm}
  .bc.d1 .sig{min-height:18mm}
  .bc.d2 td{padding:.8mm 1.3mm;font-size:8.8px}
  .bc.d2 .sig{min-height:15mm}
`;
